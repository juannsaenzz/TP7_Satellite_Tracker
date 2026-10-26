import * as satellite from 'satellite.js';
import { ObserverLocation } from '../../domain/models/Geoposition';
import { PassPoint, PassPrediction } from '../../domain/models/PassPrediction';
import { Sgp4Engine } from './Sgp4Engine';

export interface PredictPassesOptions {
  startDate?: Date;
  daysAhead?: number; // default 2 days
  minElevationDeg?: number; // default 10 degrees
  maxPasses?: number; // default 10 passes
  trajectorySampleStepSeconds?: number; // default 15s for sky chart points
}

export class PassPredictorService {
  /**
   * Predicts visible satellite passes over an observer's location using a coarse-to-fine refinement search.
   */
  public static predictPasses(
    satrec: satellite.SatRec,
    satelliteId: number,
    satelliteName: string,
    observer: ObserverLocation,
    options: PredictPassesOptions = {}
  ): PassPrediction[] {
    const startDate = options.startDate || new Date();
    const daysAhead = options.daysAhead ?? 2;
    const minElevation = options.minElevationDeg ?? 10.0;
    const maxPasses = options.maxPasses ?? 10;
    const trajStepSec = options.trajectorySampleStepSeconds ?? 15;

    const startTimeMs = startDate.getTime();
    const endTimeMs = startTimeMs + daysAhead * 24 * 60 * 60 * 1000;

    const passes: PassPrediction[] = [];

    // Coarse search: 60-second step
    const coarseStepMs = 60 * 1000;
    let t = startTimeMs;

    let inPass = false;
    let coarseAosTime = 0;

    // Check if initially in pass
    const initialLook = Sgp4Engine.getLookAngles(satrec, new Date(t), observer);
    if (initialLook && initialLook.elevation >= minElevation) {
      inPass = true;
      coarseAosTime = t;
    }

    while (t < endTimeMs && passes.length < maxPasses) {
      t += coarseStepMs;
      const look = Sgp4Engine.getLookAngles(satrec, new Date(t), observer);
      if (!look) continue;

      const isAbove = look.elevation >= minElevation;

      if (!inPass && isAbove) {
        // Entering a pass window
        inPass = true;
        coarseAosTime = t - coarseStepMs;
      } else if (inPass && !isAbove) {
        // Exiting the pass window
        inPass = false;
        const coarseLosTime = t;

        // Refine AOS and LOS with binary search to 1-second precision
        const refinedAosTime = this.findCrossingTime(
          satrec,
          observer,
          coarseAosTime,
          coarseAosTime + coarseStepMs,
          minElevation,
          true
        );

        const refinedLosTime = this.findCrossingTime(
          satrec,
          observer,
          coarseLosTime - coarseStepMs,
          coarseLosTime,
          minElevation,
          false
        );

        if (refinedLosTime > refinedAosTime) {
          const pass = this.buildPass(
            satrec,
            satelliteId,
            satelliteName,
            observer,
            refinedAosTime,
            refinedLosTime,
            trajStepSec
          );
          if (pass.maxElevation.elevation >= minElevation) {
            passes.push(pass);
          }
        }
      }
    }

    return passes;
  }

  /**
   * Refines the crossing timestamp (elevation == minElevation) using binary search (up to 1s precision).
   */
  private static findCrossingTime(
    satrec: satellite.SatRec,
    observer: ObserverLocation,
    t1: number,
    t2: number,
    targetElevation: number,
    isRising: boolean
  ): number {
    let low = t1;
    let high = t2;

    // Binary search iterations (~10 iterations achieves < 100ms precision for a 60s window)
    for (let iter = 0; iter < 12; iter++) {
      const mid = Math.round((low + high) / 2);
      const look = Sgp4Engine.getLookAngles(satrec, new Date(mid), observer);
      if (!look) break;

      if (isRising) {
        if (look.elevation < targetElevation) {
          low = mid;
        } else {
          high = mid;
        }
      } else {
        if (look.elevation >= targetElevation) {
          low = mid;
        } else {
          high = mid;
        }
      }
    }

    return Math.round((low + high) / 2);
  }

  /**
   * Builds the complete pass prediction with culmination and trajectory points for sky chart plotting.
   */
  private static buildPass(
    satrec: satellite.SatRec,
    satelliteId: number,
    satelliteName: string,
    observer: ObserverLocation,
    aosTime: number,
    losTime: number,
    trajStepSeconds: number
  ): PassPrediction {
    const aosLook = Sgp4Engine.getLookAngles(satrec, new Date(aosTime), observer) || {
      azimuth: 0,
      elevation: 0,
      rangeKm: 0,
    };
    const losLook = Sgp4Engine.getLookAngles(satrec, new Date(losTime), observer) || {
      azimuth: 0,
      elevation: 0,
      rangeKm: 0,
    };

    const aosPoint: PassPoint = {
      time: new Date(aosTime),
      azimuth: aosLook.azimuth,
      elevation: aosLook.elevation,
      rangeKm: aosLook.rangeKm,
    };

    const losPoint: PassPoint = {
      time: new Date(losTime),
      azimuth: losLook.azimuth,
      elevation: losLook.elevation,
      rangeKm: losLook.rangeKm,
    };

    // Sample trajectory and find maximum elevation point
    const trajectory: PassPoint[] = [aosPoint];
    let maxElevationPoint: PassPoint = aosPoint;

    const trajStepMs = Math.max(5000, trajStepSeconds * 1000);
    for (let t = aosTime + trajStepMs; t < losTime; t += trajStepMs) {
      const look = Sgp4Engine.getLookAngles(satrec, new Date(t), observer);
      if (look) {
        const point: PassPoint = {
          time: new Date(t),
          azimuth: look.azimuth,
          elevation: look.elevation,
          rangeKm: look.rangeKm,
        };
        trajectory.push(point);

        if (point.elevation > maxElevationPoint.elevation) {
          maxElevationPoint = point;
        }
      }
    }

    trajectory.push(losPoint);

    return {
      satelliteId,
      satelliteName,
      aos: aosPoint,
      maxElevation: maxElevationPoint,
      los: losPoint,
      durationSeconds: Math.round((losTime - aosTime) / 1000),
      trajectory,
    };
  }
}
