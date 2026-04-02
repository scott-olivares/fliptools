import type { InsertComp } from "@workspace/db";
import type { CompFilters, CompProvider } from "./mockCompProvider.js";

const RENTCAST_BASE = "https://api.rentcast.io/v1";

// ─── Cost-protection: property lookup cache ──────────────────────────────────
// Caches /v1/properties results by normalized address for 24 hours so that
// re-selecting the same address on the New Deal form never double-bills.
const PROPERTY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const propertyCache = new Map<string, { data: PropertyLookupResult; expiresAt: number }>();

function cacheKey(address: string): string {
  return address.trim().toLowerCase();
}
// ─────────────────────────────────────────────────────────────────────────────

function getApiKey(): string | null {
  return process.env.RENTCAST_API_KEY ?? null;
}

function mapPropertyType(type: string | undefined): string {
  if (!type) return "SFR";
  const t = type.toLowerCase();
  if (t.includes("single") || t.includes("sfr")) return "SFR";
  if (t.includes("condo")) return "Condo";
  if (t.includes("townhouse") || t.includes("townhome")) return "Townhouse";
  if (t.includes("multi")) return "Multi-Family";
  return "SFR";
}

function lotSqftToAcres(sqft: number | undefined | null): number | null {
  if (!sqft) return null;
  return parseFloat((sqft / 43560).toFixed(3));
}

interface RentCastProperty {
  formattedAddress?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  latitude?: number;
  longitude?: number;
  lastSalePrice?: number;
  lastSaleDate?: string;
}

interface RentCastComp {
  formattedAddress: string;
  latitude?: number;
  longitude?: number;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  lotSize?: number;
  yearBuilt?: number;
  propertyType?: string;
  price?: number;
  status?: string;       // "Active" | "Inactive" | "Pending"
  listingType?: string;
  listedDate?: string;
  removedDate?: string;  // date listing was removed (proxy for sale date)
  lastSeenDate?: string;
  distance?: number;
  daysOld?: number;
  correlation?: number;
}

interface RentCastAvmResponse {
  price?: number;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  comparables?: RentCastComp[];
}

export interface PropertyLookupResult {
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSize: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  latitude: number | null;
  longitude: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
}

export function isRentCastConfigured(): boolean {
  return !!getApiKey();
}

export async function lookupProperty(address: string): Promise<PropertyLookupResult | null> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("RENTCAST_API_KEY is not configured");

  // ── Cost-protection: return cached result if still fresh ──────────────────
  const key = cacheKey(address);
  const cached = propertyCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.info(`[RentCast] cache hit — property lookup for "${address}"`);
    return cached.data;
  }
  // ─────────────────────────────────────────────────────────────────────────

  console.info(`[RentCast] → GET /v1/properties  address="${address}"`);
  const url = `${RENTCAST_BASE}/properties?address=${encodeURIComponent(address)}&limit=1`;
  const response = await fetch(url, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid RentCast API key");
    if (response.status === 404 || response.status === 400) return null;
    throw new Error(`RentCast API error ${response.status}`);
  }

  const data: RentCastProperty[] = await response.json();
  if (!data || data.length === 0) return null;

  const prop = data[0];
  const result: PropertyLookupResult = {
    beds: prop.bedrooms ?? null,
    baths: prop.bathrooms ?? null,
    sqft: prop.squareFootage ?? null,
    lotSize: lotSqftToAcres(prop.lotSize),
    yearBuilt: prop.yearBuilt ?? null,
    propertyType: mapPropertyType(prop.propertyType),
    latitude: prop.latitude ?? null,
    longitude: prop.longitude ?? null,
    lastSalePrice: prop.lastSalePrice ?? null,
    lastSaleDate: prop.lastSaleDate ?? null,
  };

  // ── Cost-protection: store in cache ──────────────────────────────────────
  propertyCache.set(key, { data: result, expiresAt: Date.now() + PROPERTY_CACHE_TTL_MS });
  // ─────────────────────────────────────────────────────────────────────────

  return result;
}

export const rentcastCompProvider: CompProvider = {
  name: "RentCast",

  async getCompsForProperty(subjectAddress: string, filters?: CompFilters): Promise<InsertComp[]> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("RENTCAST_API_KEY is not configured");

    const radius = filters?.radiusMiles ?? 0.5;
    const daysOld = Math.min((filters?.monthsBack ?? 6) * 30, 365);

    // /v1/avm/value uses its own correlation algorithm to select the best comps.
    // Do NOT pass sqft/beds/baths filters — they over-constrain the AVM and cause
    // "insufficient comparables" errors. Only scope by geography and recency.
    const params = new URLSearchParams({
      address: subjectAddress,
      maxRadius: String(radius),
      daysOld: String(daysOld),
      compCount: "20",
    });

    // ── Cost-protection: log every outbound AVM call ───────────────────────
    console.info(`[RentCast] → GET /v1/avm/value  address="${subjectAddress}"  radius=${radius}mi  daysOld=${daysOld}`);
    // ─────────────────────────────────────────────────────────────────────────

    const url = `${RENTCAST_BASE}/avm/value?${params}`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Invalid RentCast API key");
      if (response.status === 404) return []; // no AVM data for this address
      if (response.status === 400) {
        const body = await response.text().catch(() => "");
        throw new Error(`RentCast comp lookup failed: ${body || response.status}`);
      }
      throw new Error(`RentCast API error ${response.status}`);
    }

    const data: RentCastAvmResponse = await response.json();
    if (!data.comparables || data.comparables.length === 0) return [];

    // Guard: strip out the subject property if RentCast ever returns it as its own comp
    const normalizedSubject = subjectAddress.trim().toLowerCase();
    const comparables = data.comparables.filter(
      (c) => c.formattedAddress.trim().toLowerCase() !== normalizedSubject
    );
    if (comparables.length < data.comparables.length) {
      console.warn(`[RentCast] filtered out subject property from its own comparables: "${subjectAddress}"`);
    }

    console.info(`[RentCast] ← received ${comparables.length} comparables for "${subjectAddress}"`);

    return comparables.map((c): InsertComp => {
      // "Inactive" = listing removed (sold/off market). "Active"/"Pending" = still listed.
      const statusLower = (c.status ?? "").toLowerCase();
      const isSold = statusLower === "inactive" || statusLower === "sold";
      const isPending = statusLower === "pending";
      const listingStatus = isSold ? "sold" : isPending ? "pending" : "active";
      const soldDate = isSold ? (c.removedDate ?? c.lastSeenDate ?? null) : null;

      return {
        address: c.formattedAddress,
        salePrice: isSold ? (c.price ?? null) : null,
        listPrice: !isSold ? (c.price ?? null) : null,
        sqft: c.squareFootage ?? null,
        lotSize: lotSqftToAcres(c.lotSize),
        beds: c.bedrooms ?? null,
        baths: c.bathrooms ?? null,
        distanceMiles: c.distance ?? null,
        soldDate,
        listingStatus,
        propertyType: mapPropertyType(c.propertyType),
        condition: "unknown",
        source: "rentcast",
        latitude: c.latitude ?? null,
        longitude: c.longitude ?? null,
        dataSource: "rentcast",
      };
    });
  },
};
