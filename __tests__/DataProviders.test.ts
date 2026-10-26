import { ValidationService } from '../src/data/validation/ValidationService';
import { CelesTrakProvider } from '../src/data/providers/CelesTrakProvider';
import { Geoposition } from '../src/domain/models/Geoposition';

describe('Data Providers & Validation Unit Tests', () => {
  it('parses multi-line TLE blocks correctly', () => {
    const rawTle = `
ISS (ZARYA)
1 25544U 98067A   24080.52840278  .00014674  00000+0  26653-3 0  9997
2 25544  51.6418  50.9328 0004547 348.6533 133.4542 15.49880145444655
STARLINK-1007
1 44713U 19074A   24080.50000000  .00001000  00000+0  10000-4 0  9991
2 44713  53.0540 280.0000 0001500  90.0000 270.0000 15.06000000240001
    `;

    const provider = new CelesTrakProvider();
    const satellites = provider.parseTleCatalogue(rawTle, 'starlink');

    expect(satellites.length).toBe(2);
    expect(satellites[0].name).toBe('ISS (ZARYA)');
    expect(satellites[0].noradId).toBe(25544);
    expect(satellites[1].name).toBe('STARLINK-1007');
    expect(satellites[1].noradId).toBe(44713);
  });

  it('computes 3D Euclidean and surface distance errors accurately', () => {
    const pos1: Geoposition = {
      latitude: -34.6037,
      longitude: -58.3816,
      altitude: 420.0,
      timestamp: Date.now(),
    };
    // 0.1 degree offset (~11 km) and 2 km altitude difference
    const pos2: Geoposition = {
      latitude: -34.5037,
      longitude: -58.3816,
      altitude: 422.0,
      timestamp: Date.now(),
    };

    const errors = ValidationService.computeDistanceErrors(pos1, pos2);
    expect(errors.surfaceKm).toBeGreaterThan(10);
    expect(errors.surfaceKm).toBeLessThan(12);
    expect(errors.altitudeDiffKm).toBe(2.0);
    expect(errors.distance3dKm).toBeGreaterThan(errors.surfaceKm);
  });

  it('validates SpaceTrackProvider credential handling and TLE parsing', () => {
    const { SpaceTrackProvider } = require('../src/data/providers/SpaceTrackProvider');
    const provider = new SpaceTrackProvider();
    expect(provider.hasCredentials()).toBe(false);

    provider.setCredentials({ identity: 'test@example.com', password: 'secretpassword' });
    expect(provider.hasCredentials()).toBe(true);

    const rawTle = `ISS (ZARYA)
1 25544U 98067A   24080.52840278  .00014674  00000+0  26653-3 0  9997
2 25544  51.6418  50.9328 0004547 348.6533 133.4542 15.49880145444655`;

    const parsed = provider.parseSingleTle(rawTle, 25544);
    expect(parsed).not.toBeNull();
    expect(parsed?.name).toBe('ISS (ZARYA)');
    expect(parsed?.line1).toContain('1 25544U');
    expect(parsed?.line2).toContain('2 25544');
  });

  it('validates N2yoProvider API key configuration and fallback when missing key', async () => {
    const { N2yoProvider } = require('../src/data/providers/N2yoProvider');
    const provider = new N2yoProvider();
    expect(provider.getApiKey()).toBe('');

    // When API key is empty, returns null safely without throwing
    const orbital = await provider.getOrbitalData(25544);
    expect(orbital).toBeNull();

    const validation = await provider.getValidationPosition(25544);
    expect(validation).toBeNull();

    provider.setApiKey('DEMO-API-KEY-12345');
    expect(provider.getApiKey()).toBe('DEMO-API-KEY-12345');
  });

  it('falls back to bundled satellite in CatalogService when online providers are unreachable', async () => {
    const { CatalogService } = require('../src/core/services/CatalogService');
    // Query a known curated satellite from bundled fallback
    const result = await CatalogService.getOrbitalDataWithFallback(25544);
    expect(result).not.toBeNull();
    expect(result?.name).toBe('ISS (ZARYA)');
    expect(result?.line1).toContain('1 25544U');
  });
});

