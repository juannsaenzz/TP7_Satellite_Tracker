import { EARTH_RADIUS_KM } from './Sgp4Engine';
import { LatLng } from './GroundTrackService';

export class FootprintService {
  /**
   * Calculates Earth central angular radius (theta) in radians.
   *
   * @param altitudeKm Satellite altitude above Earth's surface (km)
   * @param minElevationDeg Minimum elevation mask in degrees (e.g. 0° or 10°)
   */
  public static calculateAngularRadiusRadians(altitudeKm: number, minElevationDeg: number = 0): number {
    const epsRad = (minElevationDeg * Math.PI) / 180.0;
    const ratio = (EARTH_RADIUS_KM / (EARTH_RADIUS_KM + altitudeKm)) * Math.cos(epsRad);

    // Clamp ratio to [-1, 1] to prevent NaN
    const clampedRatio = Math.max(-1, Math.min(1, ratio));
    const theta = Math.acos(clampedRatio) - epsRad;

    return Math.max(0, theta);
  }

  /**
   * Returns surface ground distance radius in kilometers and meters.
   */
  public static calculateFootprintRadius(
    altitudeKm: number,
    minElevationDeg: number = 0
  ): { radiusKm: number; radiusMeters: number } {
    const thetaRad = this.calculateAngularRadiusRadians(altitudeKm, minElevationDeg);
    const radiusKm = EARTH_RADIUS_KM * thetaRad;
    return {
      radiusKm,
      radiusMeters: radiusKm * 1000.0,
    };
  }

  /**
   * Generates a circular polygon on the sphere around the sub-satellite point.
   *
   * @param centerLat Sub-satellite latitude in degrees
   * @param centerLon Sub-satellite longitude in degrees
   * @param altitudeKm Satellite altitude in km
   * @param minElevationDeg Minimum elevation angle (default 0)
   * @param numPoints Number of polygon vertices (default 64)
   */
  public static generateFootprintPolygon(
    centerLat: number,
    centerLon: number,
    altitudeKm: number,
    minElevationDeg: number = 0,
    numPoints: number = 64
  ): LatLng[] {
    const thetaRad = this.calculateAngularRadiusRadians(altitudeKm, minElevationDeg);
    if (thetaRad <= 0) return [];

    const lat0 = (centerLat * Math.PI) / 180.0;
    const lon0 = (centerLon * Math.PI) / 180.0;

    const coords: LatLng[] = [];

    for (let i = 0; i <= numPoints; i++) {
      const alpha = (i * 2 * Math.PI) / numPoints; // bearing angle [0, 2PI]

      const sinLat = Math.sin(lat0) * Math.cos(thetaRad) + Math.cos(lat0) * Math.sin(thetaRad) * Math.cos(alpha);
      const lat = Math.asin(Math.max(-1, Math.min(1, sinLat)));

      const y = Math.sin(alpha) * Math.sin(thetaRad) * Math.cos(lat0);
      const x = Math.cos(thetaRad) - Math.sin(lat0) * Math.sin(lat);
      const dLon = Math.atan2(y, x);

      let lon = lon0 + dLon;

      // Normalize longitude to [-PI, PI]
      while (lon > Math.PI) lon -= 2 * Math.PI;
      while (lon < -Math.PI) lon += 2 * Math.PI;

      coords.push({
        latitude: (lat * 180.0) / Math.PI,
        longitude: (lon * 180.0) / Math.PI,
      });
    }

    return coords;
  }
}
