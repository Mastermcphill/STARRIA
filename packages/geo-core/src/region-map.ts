// ---------------------------------------------------------------------------
// geo-core — country → macro-region mapping
// Not exhaustive; covers STARRIA's launch markets plus common countries.
// Unmapped countries resolve to 'XX' (unknown) and are treated conservatively.
// ---------------------------------------------------------------------------

import type { GeoRegion } from './types';

export const COUNTRY_REGION: Readonly<Record<string, GeoRegion>> = {
  // Africa
  NG: 'AF', GH: 'AF', KE: 'AF', ZA: 'AF', EG: 'AF', ET: 'AF', TZ: 'AF',
  UG: 'AF', CM: 'AF', CI: 'AF', SN: 'AF', MA: 'AF', DZ: 'AF', RW: 'AF',
  // Europe
  GB: 'EU', IE: 'EU', FR: 'EU', DE: 'EU', ES: 'EU', IT: 'EU', PT: 'EU',
  NL: 'EU', BE: 'EU', SE: 'EU', NO: 'EU', DK: 'EU', FI: 'EU', PL: 'EU',
  UA: 'EU', RU: 'EU', CH: 'EU', AT: 'EU', GR: 'EU', RO: 'EU',
  // North America
  US: 'NA', CA: 'NA', MX: 'NA', CU: 'NA', JM: 'NA', DO: 'NA', GT: 'NA',
  // South America
  BR: 'SA', AR: 'SA', CO: 'SA', CL: 'SA', PE: 'SA', VE: 'SA', EC: 'SA',
  // Asia
  IN: 'AS', CN: 'AS', JP: 'AS', KR: 'AS', ID: 'AS', PH: 'AS', PK: 'AS',
  BD: 'AS', VN: 'AS', TH: 'AS', MY: 'AS', SG: 'AS', AE: 'AS', SA: 'AS',
  TR: 'AS', IL: 'AS',
  // Oceania
  AU: 'OC', NZ: 'OC', FJ: 'OC', PG: 'OC',
};

export function countryToRegion(country?: string): GeoRegion {
  if (!country) return 'XX';
  return COUNTRY_REGION[country.trim().toUpperCase()] ?? 'XX';
}
