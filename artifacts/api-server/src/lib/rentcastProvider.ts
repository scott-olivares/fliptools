import type { InsertComp } from "@workspace/db";
import type { CompFilters, CompProvider } from "./mockCompProvider.js";

const RENTCAST_BASE = "https://api.rentcast.io/v1";

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
  listedDate?: string;
  removedDate?: string;
  lastSaleDate?: string;
  distance?: number;
  correlation?: number;
}

interface RentCastComparablesResponse {
  comparables: RentCastComp[];
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
  return {
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
}

export const rentcastCompProvider: CompProvider = {
  name: "RentCast",

  async getCompsForProperty(subjectAddress: string, filters?: CompFilters): Promise<InsertComp[]> {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("RENTCAST_API_KEY is not configured");

    const radius = filters?.radiusMiles ?? 0.5;
    const daysOld = Math.min((filters?.monthsBack ?? 6) * 30, 365);

    const params = new URLSearchParams({
      address: subjectAddress,
      maxRadius: String(radius),
      daysOld: String(daysOld),
      compCount: "20",
    });

    if (filters?.subjectSqft) {
      const sqft = filters.subjectSqft;
      const pct = (filters.sqftSimilarityPct ?? 20) / 100;
      params.set("squareFootageMin", String(Math.round(sqft * (1 - pct))));
      params.set("squareFootageMax", String(Math.round(sqft * (1 + pct))));
    }

    if (filters?.subjectBeds != null) {
      params.set("bedroomsMin", String(Math.max(0, filters.subjectBeds - 1)));
      params.set("bedroomsMax", String(filters.subjectBeds + 1));
    }

    if (filters?.subjectBaths != null) {
      params.set("bathroomsMin", String(Math.max(0, filters.subjectBaths - 1)));
      params.set("bathroomsMax", String(filters.subjectBaths + 1));
    }

    const url = `${RENTCAST_BASE}/avm/sale/comparables?${params}`;
    const response = await fetch(url, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error("Invalid RentCast API key");
      if (response.status === 400) {
        const body = await response.text().catch(() => "");
        throw new Error(`RentCast comp lookup failed: ${body || response.status}`);
      }
      throw new Error(`RentCast API error ${response.status}`);
    }

    const data: RentCastComparablesResponse = await response.json();
    if (!data.comparables || data.comparables.length === 0) return [];

    return data.comparables.map((c): InsertComp => ({
      address: c.formattedAddress,
      salePrice: c.price ?? null,
      listPrice: null,
      sqft: c.squareFootage ?? null,
      lotSize: lotSqftToAcres(c.lotSize),
      beds: c.bedrooms ?? null,
      baths: c.bathrooms ?? null,
      distanceMiles: c.distance ?? null,
      soldDate: c.removedDate || c.lastSaleDate || c.listedDate || null,
      listingStatus: "sold",
      propertyType: mapPropertyType(c.propertyType),
      condition: "unknown",
      source: "rentcast",
      latitude: c.latitude ?? null,
      longitude: c.longitude ?? null,
      dataSource: "rentcast",
    }));
  },
};
