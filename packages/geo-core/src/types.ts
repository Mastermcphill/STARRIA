// ---------------------------------------------------------------------------
// geo-core — types
// ---------------------------------------------------------------------------

/** Macro-regions used for geo-diversity grouping. */
export type GeoRegion =
  | 'AF' // Africa
  | 'EU' // Europe
  | 'NA' // North America
  | 'SA' // South America
  | 'AS' // Asia
  | 'OC' // Oceania
  | 'AN' // Antarctica
  | 'XX'; // Unknown

export interface GeoLocation {
  /** ISO 3166-1 alpha-2, uppercase (e.g. "NG", "US"). */
  readonly country: string;
  readonly region: GeoRegion;
}

/** A request-scoped geo hint resolved from header / IP / explicit input. */
export interface GeoHint {
  readonly country?: string;
  readonly ip?: string;
}
