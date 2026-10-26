import * as satellite from 'satellite.js';
import { Geoposition, ObserverLocation } from '../../domain/models/Geoposition';
import { LookAngle } from '../../domain/models/LookAngle';

export const EARTH_RADIUS_KM = 6371.0;

export class Sgp4Engine {
  /**
   * Parses two-line element set (TLE) strings into a SatRec object.
   */
  public static parseTle(line1: string, line2: string): satellite.SatRec {
    const satrec = satellite.twoline2satrec(line1.trim(), line2.trim());
    if (satrec.error) {
      throw new Error(`Failed to parse TLE with error code: ${satrec.error}`);
    }
    return satrec;
  }

  /**
   * Computes the orbital period of the satellite in minutes.
   */
  public static getOrbitalPeriodMinutes(satrec: satellite.SatRec): number {
    // satrec.no is mean motion in radians per minute
    if (!satrec.no || satrec.no <= 0) {
      return 95.0; // default LEO fallback
    }
    return (2 * Math.PI) / satrec.no;
  }

  /**
   * Calculates sub-satellite point (geoposition: lat, lon, alt) for a given date.
   */
  public static getGeoposition(satrec: satellite.SatRec, date: Date): Geoposition | null {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity || !positionAndVelocity.position) {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    if (typeof positionEci !== 'object' || !('x' in positionEci)) {
      return null;
    }

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionEci, gmst);

    const latDeg = satellite.degreesLat(geodetic.latitude);
    let lonDeg = satellite.degreesLong(geodetic.longitude);

    // Normalize longitude to [-180, 180]
    while (lonDeg > 180) lonDeg -= 360;
    while (lonDeg < -180) lonDeg += 360;

    return {
      latitude: latDeg,
      longitude: lonDeg,
      altitude: geodetic.height, // in km
      timestamp: date.getTime(),
    };
  }

  /**
   * Calculates topocentric LookAngles (Azimuth, Elevation, Range) relative to an observer.
   */
  public static getLookAngles(
    satrec: satellite.SatRec,
    date: Date,
    observer: ObserverLocation
  ): LookAngle | null {
    const positionAndVelocity = satellite.propagate(satrec, date);
    if (!positionAndVelocity || !positionAndVelocity.position) {
      return null;
    }

    const positionEci = positionAndVelocity.position;
    if (typeof positionEci !== 'object' || !('x' in positionEci)) {
      return null;
    }

    const gmst = satellite.gstime(date);
    const positionEcf = satellite.eciToEcf(positionEci, gmst);

    const observerGeodetic = {
      latitude: satellite.degreesToRadians(observer.latitude),
      longitude: satellite.degreesToRadians(observer.longitude),
      height: (observer.altitudeMeters || 0) / 1000.0, // convert meters to km
    };

    const lookAngles = satellite.ecfToLookAngles(observerGeodetic, positionEcf);

    const azimuthDeg = (satellite.radiansToDegrees(lookAngles.azimuth) + 360) % 360;
    const elevationDeg = satellite.radiansToDegrees(lookAngles.elevation);

    return {
      azimuth: azimuthDeg,
      elevation: elevationDeg,
      rangeKm: lookAngles.rangeSat,
    };
  }
}
