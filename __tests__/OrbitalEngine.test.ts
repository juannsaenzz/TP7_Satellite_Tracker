import { Sgp4Engine } from '../src/core/orbital/Sgp4Engine';
import { GroundTrackService } from '../src/core/orbital/GroundTrackService';
import { FootprintService } from '../src/core/orbital/FootprintService';
import { PassPredictorService } from '../src/core/orbital/PassPredictorService';
import { ObserverLocation } from '../src/domain/models/Geoposition';

describe('Orbital Engine Unit Tests', () => {
  // Real ISS TLE sample
  const ISS_TLE_1 = '1 25544U 98067A   24080.52840278  .00014674  00000+0  26653-3 0  9997';
  const ISS_TLE_2 = '2 25544  51.6418  50.9328 0004547 348.6533 133.4542 15.49880145444655';

  const observer: ObserverLocation = {
    latitude: -34.6037, // Buenos Aires
    longitude: -58.3816,
    altitudeMeters: 25,
  };

  it('correctly parses TLE and computes orbital period', () => {
    const satrec = Sgp4Engine.parseTle(ISS_TLE_1, ISS_TLE_2);
    expect(satrec).toBeDefined();

    const period = Sgp4Engine.getOrbitalPeriodMinutes(satrec);
    // ISS period is approximately 92.9 minutes
    expect(period).toBeGreaterThan(90);
    expect(period).toBeLessThan(95);
  });

  it('calculates valid geoposition (subsatellite point)', () => {
    const satrec = Sgp4Engine.parseTle(ISS_TLE_1, ISS_TLE_2);
    const testDate = new Date('2024-03-20T12:00:00Z');

    const pos = Sgp4Engine.getGeoposition(satrec, testDate);
    expect(pos).not.toBeNull();
    expect(pos!.latitude).toBeGreaterThanOrEqual(-90);
    expect(pos!.latitude).toBeLessThanOrEqual(90);
    expect(pos!.longitude).toBeGreaterThanOrEqual(-180);
    expect(pos!.longitude).toBeLessThanOrEqual(180);
    // ISS altitude is between 400 and 430 km
    expect(pos!.altitude).toBeGreaterThan(390);
    expect(pos!.altitude).toBeLessThan(440);
  });

  it('calculates look angles from observer location', () => {
    const satrec = Sgp4Engine.parseTle(ISS_TLE_1, ISS_TLE_2);
    const testDate = new Date('2024-03-20T12:00:00Z');

    const look = Sgp4Engine.getLookAngles(satrec, testDate, observer);
    expect(look).not.toBeNull();
    expect(look!.azimuth).toBeGreaterThanOrEqual(0);
    expect(look!.azimuth).toBeLessThan(360);
    expect(look!.elevation).toBeGreaterThanOrEqual(-90);
    expect(look!.elevation).toBeLessThanOrEqual(90);
    expect(look!.rangeKm).toBeGreaterThan(300);
  });

  it('splits ground track at antimeridian crossing', () => {
    const continuousAcrossAntimeridian = [
      { latitude: 10, longitude: 178 },
      { latitude: 12, longitude: 179 },
      { latitude: 14, longitude: -179 }, // jump from 179 to -179
      { latitude: 16, longitude: -178 },
    ];

    const segments = GroundTrackService.splitAtAntimeridian(continuousAcrossAntimeridian);
    expect(segments.length).toBe(2);
    expect(segments[0][segments[0].length - 1].longitude).toBe(180);
    expect(segments[1][0].longitude).toBe(-180);
  });

  it('calculates footprint radius and polygon accurately', () => {
    const altitudeKm = 420; // ISS approx
    const footprint = FootprintService.calculateFootprintRadius(altitudeKm, 0);

    // Theoretical horizon radius for 420km altitude is approx 2200-2400 km
    expect(footprint.radiusKm).toBeGreaterThan(2000);
    expect(footprint.radiusKm).toBeLessThan(2500);

    const polygon = FootprintService.generateFootprintPolygon(0, 0, altitudeKm, 10, 16);
    expect(polygon.length).toBe(17); // 16 segments + closing point
  });

  it('predicts upcoming passes using coarse-to-fine search', () => {
    const satrec = Sgp4Engine.parseTle(ISS_TLE_1, ISS_TLE_2);
    const startDate = new Date('2024-03-20T00:00:00Z');

    const passes = PassPredictorService.predictPasses(satrec, 25544, 'ISS', observer, {
      startDate,
      daysAhead: 5,
      minElevationDeg: 10,
    });

    expect(Array.isArray(passes)).toBe(true);
    if (passes.length > 0) {
      const firstPass = passes[0];
      expect(firstPass.satelliteId).toBe(25544);
      expect(firstPass.maxElevation.elevation).toBeGreaterThanOrEqual(10);
      expect(firstPass.los.time.getTime()).toBeGreaterThan(firstPass.aos.time.getTime());
      expect(firstPass.trajectory.length).toBeGreaterThan(2);
    }
  });
});
