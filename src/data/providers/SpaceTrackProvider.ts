import { IDataProvider } from '../../domain/repositories/IDataProvider';
import { Satellite, SatelliteCategory } from '../../domain/models/Satellite';

export interface SpaceTrackCredentials {
  identity?: string;
  password?: string;
}

export class SpaceTrackProvider implements IDataProvider {
  public readonly name = 'Space-Track';

  private credentials: SpaceTrackCredentials = {};
  private sessionCookie: string | null = null;
  private lastRequestTimeMs: number = 0;
  // Strict Space-Track rate limit: 20 req/min (enforce 3000ms min interval)
  private readonly minIntervalMs: number = 3000;

  constructor(credentials?: SpaceTrackCredentials) {
    if (credentials) {
      this.credentials = credentials;
    }
  }

  public setCredentials(credentials: SpaceTrackCredentials): void {
    this.credentials = credentials;
    this.sessionCookie = null; // Invalidate session on credentials change
  }

  public hasCredentials(): boolean {
    return Boolean(this.credentials.identity && this.credentials.password);
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

  private async authenticate(): Promise<boolean> {
    if (!this.hasCredentials()) {
      return false;
    }

    try {
      const response = await fetch('https://www.space-track.org/ajaxauth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `identity=${encodeURIComponent(this.credentials.identity!)}&password=${encodeURIComponent(
          this.credentials.password!
        )}`,
      });

      if (!response.ok) return false;

      // Extract cookie header if returned
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        this.sessionCookie = setCookie;
      }
      return true;
    } catch {
      return false;
    }
  }

  public async getCatalog(category: SatelliteCategory = 'iss'): Promise<Satellite[]> {
    // Space-Track rate limits discourage large full-catalogue downloads from mobile clients;
    // this method returns empty when not authenticated, delegating to CelesTrak.
    if (!this.hasCredentials()) {
      return [];
    }
    return [];
  }

  public async getOrbitalData(noradId: number): Promise<{ line1: string; line2: string; name: string } | null> {
    if (!this.hasCredentials()) {
      return null;
    }

    await this.enforceRateLimit();

    if (!this.sessionCookie) {
      const authenticated = await this.authenticate();
      if (!authenticated) return null;
    }

    const url = `https://www.space-track.org/basicspacedata/query/class/gp/NORAD_CAT_ID/${noradId}/orderby/EPOCH%20desc/limit/1/format/tle`;

    try {
      const headers: Record<string, string> = {};
      if (this.sessionCookie) {
        headers['Cookie'] = this.sessionCookie;
      }

      const response = await fetch(url, { headers });
      if (response.status === 401 || response.status === 403) {
        // Session expired, retry login once
        this.sessionCookie = null;
        const reauthenticated = await this.authenticate();
        if (!reauthenticated) return null;
        const retryResponse = await fetch(url, {
          headers: this.sessionCookie ? { Cookie: this.sessionCookie } : {},
        });
        if (!retryResponse.ok) return null;
        const text = await retryResponse.text();
        return this.parseSingleTle(text, noradId);
      }

      if (!response.ok) return null;
      const text = await response.text();
      return this.parseSingleTle(text, noradId);
    } catch {
      return null;
    }
  }

  public parseSingleTle(rawText: string, noradId: number): { line1: string; line2: string; name: string } | null {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length >= 2) {
      if (lines[0].startsWith('1 ') && lines[1].startsWith('2 ')) {
        return {
          name: `NORAD ${noradId}`,
          line1: lines[0],
          line2: lines[1],
        };
      } else if (lines.length >= 3 && lines[1].startsWith('1 ') && lines[2].startsWith('2 ')) {
        return {
          name: lines[0],
          line1: lines[1],
          line2: lines[2],
        };
      }
    }
    return null;
  }
}
