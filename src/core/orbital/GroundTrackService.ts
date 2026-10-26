import * as satellite from 'satellite.js';
import { Geoposition } from '../../domain/models/Geoposition';
import { Sgp4Engine } from './Sgp4Engine';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface GroundTrackResult {
  pastSegments: LatLng[][];
  futureSegments: LatLng[][];
  currentPosition: Geoposition | null;
  periodMinutes: number;
}

export class GroundTrackService {
  /**
   * Generates past and future ground track polylines split across antimeridian boundaries.
   *
   * @param satrec Initialized SatRec
   * @param referenceDate Current time (reference)
   * @param stepSeconds Interval between points in seconds (default 30s)
   */
  public static calculateGroundTrack(
    satrec: satellite.SatRec,
    referenceDate: Date = new Date(),
    stepSeconds: number = 30
  ): GroundTrackResult {
    const periodMinutes = Sgp4Engine.getOrbitalPeriodMinutes(satrec);
    const halfPeriodMs = (periodMinutes / 2) * 60 * 1000;
    const stepMs = stepSeconds * 1000;

    const refTime = referenceDate.getTime();
    const currentPosition = Sgp4Engine.getGeoposition(satrec, referenceDate);

    // 1. Calculate past trajectory: from refTime - halfPeriodMs to refTime
    const pastPoints: LatLng[] = [];
    for (let t = refTime - halfPeriodMs; t <= refTime; t += stepMs) {
      const pos = Sgp4Engine.getGeoposition(satrec, new Date(t));
      if (pos) {
        pastPoints.push({ latitude: pos.latitude, longitude: pos.longitude });
      }
    }

    // 2. Calculate future trajectory: from refTime to refTime + halfPeriodMs
    const futurePoints: LatLng[] = [];
    for (let t = refTime; t <= refTime + halfPeriodMs; t += stepMs) {
      const pos = Sgp4Engine.getGeoposition(satrec, new Date(t));
      if (pos) {
        futurePoints.push({ latitude: pos.latitude, longitude: pos.longitude });
      }
    }

    return {
      pastSegments: this.splitAtAntimeridian(pastPoints),
      futureSegments: this.splitAtAntimeridian(futurePoints),
      currentPosition,
      periodMinutes,
    };
  }

  /**
   * Splits a continuous sequence of coordinates into segments when crossing the ±180° antimeridian.
   * Interpolates the crossing boundary to ensure smooth visual rendering on maps.
   */
  public static splitAtAntimeridian(points: LatLng[]): LatLng[][] {
    if (points.length === 0) return [];

    const segments: LatLng[][] = [];
    let currentSegment: LatLng[] = [points[0]];

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      const lonDiff = curr.longitude - prev.longitude;

      if (Math.abs(lonDiff) > 180) {
        // Crossing detected:
        // If prev was positive (e.g. 179) and curr is negative (e.g. -179), lonDiff is ~ -358
        // If prev was negative (e.g. -179) and curr is positive (e.g. 179), lonDiff is ~ +358
        const crossingSign = prev.longitude > 0 ? 1 : -1;
        const boundaryLon1 = crossingSign * 180;
        const boundaryLon2 = -crossingSign * 180;

        // Calculate fraction of crossing
        const dLon1 = Math.abs(boundaryLon1 - prev.longitude);
        const dLon2 = Math.abs(curr.longitude - boundaryLon2);
        const totalDLon = dLon1 + dLon2;
        const frac = totalDLon > 0 ? dLon1 / totalDLon : 0.5;

        const crossingLat = prev.latitude + (curr.latitude - prev.latitude) * frac;

        // Close current segment at boundary
        currentSegment.push({ latitude: crossingLat, longitude: boundaryLon1 });
        segments.push(currentSegment);

        // Start new segment from the other boundary side
        currentSegment = [{ latitude: crossingLat, longitude: boundaryLon2 }, curr];
      } else {
        currentSegment.push(curr);
      }
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments;
  }
}
