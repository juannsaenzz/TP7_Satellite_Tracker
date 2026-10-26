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
});
