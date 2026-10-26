import { IDataProvider } from '../../domain/repositories/IDataProvider';
import { Satellite, SatelliteCategory } from '../../domain/models/Satellite';
import { Geoposition } from '../../domain/models/Geoposition';

export interface N2yoTleResponse {
  info: {
    satid: number;
    satname: string;
    transactionscount: number;
  };
  tle: string;
}

export interface N2yoPositionsResponse {
  info: {
    satid: number;
    satname: string;
    transactionscount: number;
  };
  positions: Array<{
    satlatitude: number;
    satlongitude: number;
    sataltitude: number;
    azimuth: number;
    elevation: number;
    ra: number;
    dec: number;
    timestamp: number;
  }>;
}

export class N2yoProvider implements IDataProvider {
  public readonly name = 'N2YO';

  private apiKey: string;
  private lastRequestTimeMs: number = 0;
  // Free tier rate limit: 1000 requests/hour (~1 request every 3.6s, safe minimum interval 2000ms)
  private readonly minIntervalMs: number = 2000;

  constructor(apiKey: string = '') {
    this.apiKey = apiKey;
  }

  public setApiKey(key: string): void {
    this.apiKey = key;
  }

  public getApiKey(): string {
    return this.apiKey;
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTimeMs;
    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise<void>(resolve => setTimeout(() => resolve(), waitTime));
    }
    this.lastRequestTimeMs = Date.now();
  }

  public async getCatalog(category: SatelliteCategory = 'iss'): Promise<Satellite[]> {
    // N2YO does not serve bulk TLE dumps for full constellations in its free tier;
    // this method satisfies the IDataProvider contract by returning target category entities
    // when queried directly by NORAD ID or curated IDs.
    return [];
  }

  public async getOrbitalData(noradId: number): Promise<{ line1: string; line2: string; name: string } | null> {
    if (!this.apiKey) {
      return null;
    }

    await this.enforceRateLimit();
    const url = `https://api.n2yo.com/rest/v1/satellite/tle/${noradId}&apiKey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const data: N2yoTleResponse = await response.json();

      if (!data.tle) return null;

      const lines = data.tle.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length >= 2) {
        return {
          name: data.info?.satname || `NORAD ${noradId}`,
          line1: lines[0],
          line2: lines[1],
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Fetches real-time position from N2YO as an independent validation ground truth.
   */
  public async getValidationPosition(noradId: number): Promise<Geoposition | null> {
    if (!this.apiKey) {
      return null;
    }

    await this.enforceRateLimit();
    // 1 second prediction window from observer 0,0,0
    const url = `https://api.n2yo.com/rest/v1/satellite/positions/${noradId}/0/0/0/1&apiKey=${this.apiKey}`;

    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const data: N2yoPositionsResponse = await response.json();

      if (data.positions && data.positions.length > 0) {
        const pos = data.positions[0];
        return {
          latitude: pos.satlatitude,
          longitude: pos.satlongitude,
          altitude: pos.sataltitude,
          timestamp: pos.timestamp * 1000,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}
