// ============================================
// createBusinessSchema — location validation
// ============================================
//
// `location` used to bypass the schema entirely: the route read it through an
// untyped cast, so any string was accepted and persisted. Because a location
// supersedes its city for both demand and rent, a bogus or mismatched value is
// not cosmetic.

import { describe, it, expect } from 'vitest';
import { createBusinessSchema } from '@/lib/errors/validation';
import { LOCATIONS, getLocationsForCity } from '@/lib/game/expansion';

const base = { type: 'TEA_STALL', city: 'DHAKA', name: 'Cha Ghor' };

describe('createBusinessSchema', () => {
  it('accepts a business with no location (city-level fallback)', () => {
    const parsed = createBusinessSchema.parse(base);
    expect(parsed.location).toBeUndefined();
    expect(parsed.name).toBe('Cha Ghor');
  });

  it('accepts every real location paired with its own city', () => {
    for (const loc of LOCATIONS) {
      const parsed = createBusinessSchema.parse({
        ...base,
        city: loc.cityId,
        location: loc.id,
      });
      expect(parsed.location).toBe(loc.id);
    }
  });

  it('rejects an unknown location id', () => {
    expect(() =>
      createBusinessSchema.parse({ ...base, location: 'ATLANTIS_CENTRAL' }),
    ).toThrow();
  });

  it('rejects a location from a different city', () => {
    const dhaka = getLocationsForCity('DHAKA')[0];
    const chattogram = getLocationsForCity('CHITTAGONG')[0];

    expect(dhaka).toBeDefined();
    expect(chattogram).toBeDefined();

    // Claiming a Dhaka address while taking Chattogram's footfall and rent.
    expect(() =>
      createBusinessSchema.parse({ ...base, city: 'DHAKA', location: chattogram.id }),
    ).toThrow();

    expect(() =>
      createBusinessSchema.parse({ ...base, city: 'CHITTAGONG', location: dhaka.id }),
    ).toThrow();
  });

  it('rejects every cross-city pairing, not just the first', () => {
    for (const loc of LOCATIONS) {
      const wrongCity = LOCATIONS.find((l) => l.cityId !== loc.cityId)!.cityId;
      expect(() =>
        createBusinessSchema.parse({ ...base, city: wrongCity, location: loc.id }),
      ).toThrow();
    }
  });

  it('still rejects an unknown city or business type', () => {
    expect(() => createBusinessSchema.parse({ ...base, city: 'LONDON' })).toThrow();
    expect(() => createBusinessSchema.parse({ ...base, type: 'CASINO' })).toThrow();
  });

  it('trims and length-checks the name', () => {
    expect(createBusinessSchema.parse({ ...base, name: '  Padma Store  ' }).name)
      .toBe('Padma Store');
    expect(() => createBusinessSchema.parse({ ...base, name: '   ' })).toThrow();
    expect(() => createBusinessSchema.parse({ ...base, name: 'x'.repeat(51) })).toThrow();
  });
});
