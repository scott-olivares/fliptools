/**
 * Mock Comp Data Provider
 *
 * This module simulates a comp data provider (MLS/brokerage feed).
 * To plug in a real provider later, implement the same interface and swap
 * this module out in the routes that call it.
 *
 * Interface for a real provider:
 *   getCompsForProperty(subjectAddress: string, filters: CompFilters): Promise<InsertComp[]>
 */

import { InsertComp } from "@workspace/db";

export interface CompFilters {
  radiusMiles?: number;
  monthsBack?: number;
  sqftSimilarityPct?: number;
  subjectSqft?: number;
}

export interface CompProvider {
  name: string;
  getCompsForProperty(subjectAddress: string, filters?: CompFilters): Promise<InsertComp[]>;
}

export const mockCompProvider: CompProvider = {
  name: "Mock Provider (Sample Data)",

  async getCompsForProperty(_subjectAddress: string, _filters?: CompFilters): Promise<InsertComp[]> {
    return MOCK_COMPS;
  },
};

export const MOCK_COMPS: InsertComp[] = [
  {
    address: "4821 Rosewood Dr",
    salePrice: 485000,
    listPrice: null,
    sqft: 1820,
    lotSize: 0.18,
    beds: 3,
    baths: 2,
    distanceMiles: 0.3,
    soldDate: "2025-11-15",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "remodeled",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "5103 Elmhurst Ln",
    salePrice: 498000,
    listPrice: null,
    sqft: 1950,
    lotSize: 0.22,
    beds: 3,
    baths: 2,
    distanceMiles: 0.45,
    soldDate: "2025-10-28",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "remodeled",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "4777 Birchwood Ave",
    salePrice: 462000,
    listPrice: null,
    sqft: 1700,
    lotSize: 0.15,
    beds: 3,
    baths: 2,
    distanceMiles: 0.28,
    soldDate: "2025-12-05",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "remodeled",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "5240 Maple Creek Ct",
    salePrice: null,
    listPrice: 479000,
    sqft: 1880,
    lotSize: 0.2,
    beds: 3,
    baths: 2,
    distanceMiles: 0.5,
    soldDate: null,
    listingStatus: "pending",
    propertyType: "SFR",
    condition: "remodeled",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "4910 Sprucewood Way",
    salePrice: null,
    listPrice: 469000,
    sqft: 1790,
    lotSize: 0.17,
    beds: 3,
    baths: 2,
    distanceMiles: 0.38,
    soldDate: null,
    listingStatus: "active",
    propertyType: "SFR",
    condition: "remodeled",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "5088 Clearfield Blvd",
    salePrice: null,
    listPrice: 459000,
    sqft: 1810,
    lotSize: 0.16,
    beds: 3,
    baths: 2,
    distanceMiles: 0.42,
    soldDate: null,
    listingStatus: "active",
    propertyType: "SFR",
    condition: "remodeled",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "4695 Pinecrest Dr",
    salePrice: 390000,
    listPrice: null,
    sqft: 1780,
    lotSize: 0.19,
    beds: 3,
    baths: 2,
    distanceMiles: 0.35,
    soldDate: "2025-09-20",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "average",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "5330 Walnut Ridge Rd",
    salePrice: 375000,
    listPrice: null,
    sqft: 1650,
    lotSize: 0.14,
    beds: 3,
    baths: 1,
    distanceMiles: 0.47,
    soldDate: "2025-08-10",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "average",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
  {
    address: "4842 Foxglove Ter",
    salePrice: 360000,
    listPrice: null,
    sqft: 1600,
    lotSize: 0.12,
    beds: 3,
    baths: 2,
    distanceMiles: 0.29,
    soldDate: "2025-10-01",
    listingStatus: "sold",
    propertyType: "SFR",
    condition: "unknown",
    source: "mock",
    latitude: null,
    longitude: null,
    dataSource: "mock",
  },
];
