import { Geoposition } from '../../domain/models/Geoposition';
import { EARTH_RADIUS_KM, Sgp4Engine } from '../../core/orbital/Sgp4Engine';
import { WhereTheIssProvider } from '../providers/WhereTheIssProvider';
import { OrbitalCacheService } from '../cache/OrbitalCacheService';

export interface ValidationReport {
  noradId: number;
  satelliteName: string;
  calculatedPosition: Geoposition;
  referencePosition: Geoposition;
  referenceProvider: string;
  errorKm: number;
  surfaceErrorKm: number;
  altitudeDifferenceKm: number;
  dataAgeHours: number;
  isStale: boolean;
  evaluatedAt: Date;
}

export class ValidationService {
  private static readonly whereTheIss = new WhereTheIssProvider();

  /**
   * Compares locally calculated SGP4 position against live Where The ISS At? reference data.
   */
  public static async validateIss(tleLine1: string, tleLine2: string, tleUpdatedAt: number): Promise<ValidationReport | null> {
    const referencePos = await this.whereTheIss.getValidationPosition(25544);
    if (!referencePos) return null;

    const evaluationDate = new Date(referencePos.timestamp);
    const satrec = Sgp4Engine.parseTle(tleLine1, tleLine2);
    const calculatedPos = Sgp4Engine.getGeoposition(satrec, evaluationDate);
    if (!calculatedPos) return null;

    const errors = this.computeDistanceErrors(calculatedPos, referencePos);
    const dataAgeHours = OrbitalCacheService.getAgeHours(tleUpdatedAt);

    return {
      noradId: 25544,
      satelliteName: 'ISS (ZARYA)',
      calculatedPosition: calculatedPos,
      referencePosition: referencePos,
      referenceProvider: 'WhereTheIss (REST API)',
      errorKm: errors.distance3dKm,
      surfaceErrorKm: errors.surfaceKm,
      altitudeDifferenceKm: errors.altitudeDiffKm,
      dataAgeHours,
      isStale: OrbitalCacheService.isStale(tleUpdatedAt),
      evaluatedAt: evaluationDate,
    };
  }

  /**
   * Computes great-circle surface distance and 3D Euclidean distance between two geopositions.
   */
  public static computeDistanceErrors(
    pos1: Geoposition,
    pos2: Geoposition
  ): { surfaceKm: number; altitudeDiffKm: number; distance3dKm: number } {
    const lat1Rad = (pos1.latitude * Math.PI) / 180.0;
    const lat2Rad = (pos2.latitude * Math.PI) / 180.0;
    const dLat = lat2Rad - lat1Rad;
    const dLon = ((pos2.longitude - pos1.longitude) * Math.PI) / 180.0;

    // Haversine surface distance
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const surfaceKm = EARTH_RADIUS_KM * c;

    const altitudeDiffKm = Math.abs(pos1.altitude - pos2.altitude);

    // Exact 3D Euclidean distance in ECEF coordinates
    const r1 = EARTH_RADIUS_KM + pos1.altitude;
    const x1 = r1 * Math.cos(lat1Rad) * Math.cos((pos1.longitude * Math.PI) / 180.0);
    const y1 = r1 * Math.cos(lat1Rad) * Math.sin((pos1.longitude * Math.PI) / 180.0);
    const z1 = r1 * Math.sin(lat1Rad);

    const r2 = EARTH_RADIUS_KM + pos2.altitude;
    const x2 = r2 * Math.cos(lat2Rad) * Math.cos((pos2.longitude * Math.PI) / 180.0);
    const y2 = r2 * Math.cos(lat2Rad) * Math.sin((pos2.longitude * Math.PI) / 180.0);
    const z2 = r2 * Math.sin(lat2Rad);

    const distance3dKm = Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2);

    return {
      surfaceKm: Math.round(surfaceKm * 1000) / 1000,
      altitudeDiffKm: Math.round(altitudeDiffKm * 1000) / 1000,
      distance3dKm: Math.round(distance3dKm * 1000) / 1000,
    };
  }
}
