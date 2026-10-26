import { CatalogService } from '../src/core/services/CatalogService';

describe('CatalogService Unit Tests', () => {
  it('filters satellites by name case-insensitively', () => {
    const satellites = CatalogService.DEFAULT_SATELLITES;
    const result = CatalogService.filterSatellites(satellites, 'starlink');
    expect(result.length).toBe(1);
    expect(result[0].name).toContain('STARLINK');
  });

  it('filters satellites by NORAD ID', () => {
    const satellites = CatalogService.DEFAULT_SATELLITES;
    const result = CatalogService.filterSatellites(satellites, '25544');
    expect(result.length).toBe(1);
    expect(result[0].noradId).toBe(25544);
  });

  it('returns all satellites when query is empty', () => {
    const satellites = CatalogService.DEFAULT_SATELLITES;
    const result = CatalogService.filterSatellites(satellites, '   ');
    expect(result.length).toBe(satellites.length);
  });

  it('loads category with fallback when offline', async () => {
    const result = await CatalogService.loadCategory('iss');
    expect(result).toBeDefined();
    expect(result.satellites.length).toBeGreaterThan(0);
    expect(result.satellites.some(s => s.noradId === 25544)).toBe(true);
  });
});
