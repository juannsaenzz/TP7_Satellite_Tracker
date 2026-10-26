import { GroundTrackService } from '../src/core/orbital/GroundTrackService';
import { Sgp4Engine } from '../src/core/orbital/Sgp4Engine';
import { FootprintService } from '../src/core/orbital/FootprintService';

describe('WorldMap & Geographic Layer Unit Tests', () => {
  const ISS_TLE_1 = '1 25544U 98067A   24080.52840278  .00014674  00000+0  26653-3 0  9997';
  const ISS_TLE_2 = '2 25544  51.6418  50.9328 0004547 348.6533 133.4542 15.49880145444655';

  it('calculates past and future ground track with antimeridian resolution', () => {
    const satrec = Sgp4Engine.parseTle(ISS_TLE_1, ISS_TLE_2);
    const date = new Date('2024-03-20T12:00:00Z');

    const result = GroundTrackService.calculateGroundTrack(satrec, date, 60);

    expect(result.pastSegments.length).toBeGreaterThan(0);
    expect(result.futureSegments.length).toBeGreaterThan(0);
    expect(result.periodMinutes).toBeGreaterThan(90);

    // Verify coordinates stay within legal boundaries
    result.pastSegments.forEach(segment => {
      segment.forEach(point => {
        expect(point.latitude).toBeGreaterThanOrEqual(-90);
        expect(point.latitude).toBeLessThanOrEqual(90);
        expect(point.longitude).toBeGreaterThanOrEqual(-180);
        expect(point.longitude).toBeLessThanOrEqual(180);
      });
    });
  });

  it('generates footprint polygon vertices with correct boundary clamping', () => {
    const polygon = FootprintService.generateFootprintPolygon(0, 0, 420, 10, 32);
    expect(polygon.length).toBe(33); // 32 segments + closing point

    polygon.forEach(pt => {
      expect(pt.latitude).toBeGreaterThanOrEqual(-90);
      expect(pt.latitude).toBeLessThanOrEqual(90);
      expect(pt.longitude).toBeGreaterThanOrEqual(-180);
      expect(pt.longitude).toBeLessThanOrEqual(180);
    });
  });
});
