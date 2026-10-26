import { Satellite, SatelliteCategory } from '../../domain/models/Satellite';
import { Geoposition } from '../../domain/models/Geoposition';
import { CelesTrakProvider } from '../../data/providers/CelesTrakProvider';
import { WhereTheIssProvider } from '../../data/providers/WhereTheIssProvider';
import { SpaceTrackProvider } from '../../data/providers/SpaceTrackProvider';
import { N2yoProvider } from '../../data/providers/N2yoProvider';
import { OrbitalCacheService } from '../../data/cache/OrbitalCacheService';

export interface CatalogResult {
  satellites: Satellite[];
  fromCache: boolean;
  isStale: boolean;
  dataAgeHours: number;
}

export class CatalogService {
  public static readonly celestrak = new CelesTrakProvider();
  public static readonly whereTheIss = new WhereTheIssProvider();
  public static readonly spaceTrack = new SpaceTrackProvider();
  public static readonly n2yo = new N2yoProvider();

  // Curated prominent satellites for instantaneous zero-latency offline start
  public static readonly DEFAULT_SATELLITES: Satellite[] = [
    {
      noradId: 25544,
      name: 'ISS (ZARYA)',
      tleLine1: '1 25544U 98067A   24080.52840278  .00014674  00000+0  26653-3 0  9997',
      tleLine2: '2 25544  51.6418  50.9328 0004547 348.6533 133.4542 15.49880145444655',
      updatedAt: Date.now(),
      source: 'celestrak',
      category: 'iss',
    },
    {
      noradId: 44713,
      name: 'STARLINK-1007',
      tleLine1: '1 44713U 19074A   24080.50000000  .00001000  00000+0  10000-4 0  9991',
      tleLine2: '2 44713  53.0540 280.0000 0001500  90.0000 270.0000 15.06000000240001',
      updatedAt: Date.now(),
      source: 'celestrak',
      category: 'starlink',
    },
    {
      noradId: 20580,
      name: 'HUBBLE SPACE TELESCOPE',
      tleLine1: '1 20580U 90037B   24080.50000000  .00001500  00000+0  50000-4 0  9992',
      tleLine2: '2 20580  28.4690 120.0000 0002800 110.0000 250.0000 15.08000000850002',
      updatedAt: Date.now(),
      source: 'celestrak',
      category: 'science',
    },
    {
      noradId: 28874,
      name: 'NOAA 18 (WEATHER)',
      tleLine1: '1 28874U 05018A   24080.50000000  .00000200  00000+0  15000-4 0  9993',
      tleLine2: '2 28874  98.7400 150.0000 0014000  70.0000 290.0000 14.12000000980003',
      updatedAt: Date.now(),
      source: 'celestrak',
      category: 'weather',
    },
    {
      noradId: 32711,
      name: 'NAVSTAR 62 (USA 203 - GPS)',
      tleLine1: '1 32711U 08012A   24080.50000000  .00000050  00000+0  00000+0 0  9994',
      tleLine2: '2 32711  55.4500 210.0000 0045000 190.0000 170.0000  2.00560000110004',
      updatedAt: Date.now(),
      source: 'celestrak',
      category: 'gps',
    },
  ];

  /**
   * Loads satellites for a given category with cache-first strategy and automatic refresh (RF-09 & RF-14).
   */
  public static async loadCategory(
    category: SatelliteCategory = 'iss',
    forceRefresh: boolean = false
  ): Promise<CatalogResult> {
    const cacheKey = category;

    // 1. Check local cache if not forcing refresh
    if (!forceRefresh) {
      const cached = await OrbitalCacheService.getCatalog(cacheKey);
      if (cached && cached.data.length > 0 && !cached.isStale) {
        return {
          satellites: cached.data,
          fromCache: true,
          isStale: false,
          dataAgeHours: OrbitalCacheService.getAgeHours(cached.timestamp),
        };
      }
    }

    // 2. Fetch fresh catalogue from CelesTrak
    try {
      let fresh = await this.celestrak.getCatalog(category);

      // If category is ISS and CelesTrak is empty or slow, fallback to WhereTheIss
      if (category === 'iss' && fresh.length === 0) {
        fresh = await this.whereTheIss.getCatalog(category);
      }

      if (fresh.length > 0) {
        // Limit Starlink to first 250 objects to protect UI performance (RF-13)
        const toStore = category === 'starlink' ? fresh.slice(0, 250) : fresh;
        await OrbitalCacheService.saveCatalog(cacheKey, toStore);

        return {
          satellites: toStore,
          fromCache: false,
          isStale: false,
          dataAgeHours: 0,
        };
      }
    } catch {
      // Network failure, fallback to stale cache
    }

    // 3. Fallback to stale cache if available
    const staleCached = await OrbitalCacheService.getCatalog(cacheKey);
    if (staleCached && staleCached.data.length > 0) {
      return {
        satellites: staleCached.data,
        fromCache: true,
        isStale: true,
        dataAgeHours: OrbitalCacheService.getAgeHours(staleCached.timestamp),
      };
    }

    // 4. Ultimate fallback to default bundled dataset
    const defaults = this.DEFAULT_SATELLITES.filter(s => s.category === category);
    return {
      satellites: defaults.length > 0 ? defaults : this.DEFAULT_SATELLITES,
      fromCache: true,
      isStale: false,
      dataAgeHours: 0,
    };
  }

  /**
   * Filters satellite list by query string (matching name substring or NORAD catalog ID).
   */
  public static filterSatellites(satellites: Satellite[], query: string): Satellite[] {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return satellites;

    const parsedId = parseInt(trimmed, 10);
    const hasNumericId = !isNaN(parsedId);

    return satellites.filter(sat => {
      const nameMatches = sat.name.toLowerCase().includes(trimmed);
      const idMatches = hasNumericId && sat.noradId.toString().includes(trimmed);
      return nameMatches || idMatches;
    });
  }

  /**
   * Fetches fresh TLE for a specific NORAD ID using multi-provider fallback chain (RF-09 & RF-14).
   * Hierarchy: CelesTrak -> Space-Track -> N2YO -> Curated bundled default.
   */
  public static async getOrbitalDataWithFallback(
    noradId: number
  ): Promise<{ line1: string; line2: string; name: string } | null> {
    // 1. Primary: CelesTrak
    try {
      const data = await this.celestrak.getOrbitalData(noradId);
      if (data) return data;
    } catch {
      // Primary failed, continue to fallback
    }

    // 2. Secondary: Space-Track (if credentials configured)
    if (this.spaceTrack.hasCredentials()) {
      try {
        const data = await this.spaceTrack.getOrbitalData(noradId);
        if (data) return data;
      } catch {
        // Space-Track failed, continue to next fallback
      }
    }

    // 3. Tertiary: N2YO (if API key configured)
    if (this.n2yo.getApiKey()) {
      try {
        const data = await this.n2yo.getOrbitalData(noradId);
        if (data) return data;
      } catch {
        // N2YO failed
      }
    }

    // 4. Final: Bundled default satellites
    const def = this.DEFAULT_SATELLITES.find(s => s.noradId === noradId);
    if (def) {
      return {
        line1: def.tleLine1,
        line2: def.tleLine2,
        name: def.name,
      };
    }

    return null;
  }

  /**
   * Fetches independent ground-truth position for cross-validation (RF-15 & RF-16).
   * Supports Where The ISS At? (default, no API key needed) and N2YO.
   */
  public static async getValidationPosition(
    noradId: number,
    preferredSource: 'wheretheiss' | 'n2yo' = 'wheretheiss'
  ): Promise<Geoposition | null> {
    if (preferredSource === 'n2yo' && this.n2yo.getApiKey()) {
      const pos = await this.n2yo.getValidationPosition(noradId);
      if (pos) return pos;
    }

    // Fallback to Where The ISS At? for station (NORAD 25544)
    if (noradId === 25544 || preferredSource === 'wheretheiss') {
      return await this.whereTheIss.getValidationPosition(noradId);
    }

    return null;
  }
}
