import { IDataProvider } from '../../domain/repositories/IDataProvider';
import { Satellite, SatelliteCategory } from '../../domain/models/Satellite';
import { Geoposition } from '../../domain/models/Geoposition';

export class WhereTheIssProvider implements IDataProvider {
  public readonly name = 'WhereTheIss';
  private static readonly BASE_URL = 'https://api.wheretheiss.at/v1/satellites/25544';

  public async getCatalog(_category?: SatelliteCategory): Promise<Satellite[]> {
    const tle = await this.getOrbitalData(25544);
    if (!tle) return [];

    return [
      {
        noradId: 25544,
        name: tle.name || 'ISS (ZARYA)',
        tleLine1: tle.line1,
        tleLine2: tle.line2,
        updatedAt: Date.now(),
        source: 'wheretheiss',
        category: 'iss',
      },
    ];
  }

  public async getOrbitalData(noradId: number): Promise<{ line1: string; line2: string; name: string } | null> {
    if (noradId !== 25544) return null;

    try {
      const response = await fetch(`${WhereTheIssProvider.BASE_URL}/tles`);
      if (!response.ok) return null;
      const data = await response.json();
      return {
        line1: data.line1,
        line2: data.line2,
        name: data.name || 'ISS (ZARYA)',
      };
    } catch {
      return null;
    }
  }

  /**
   * Fetches the real-time ground truth position for ISS validation (RF-15).
   */
  public async getValidationPosition(noradId: number): Promise<Geoposition | null> {
    if (noradId !== 25544) return null;

    try {
      const response = await fetch(WhereTheIssProvider.BASE_URL);
      if (!response.ok) return null;
      const data = await response.json();

      return {
        latitude: parseFloat(data.latitude),
        longitude: parseFloat(data.longitude),
        altitude: parseFloat(data.altitude), // in km
        timestamp: data.timestamp * 1000, // API returns seconds, convert to ms
      };
    } catch {
      return null;
    }
  }
}
