import { IDataProvider } from '../../domain/repositories/IDataProvider';
import { Satellite, SatelliteCategory } from '../../domain/models/Satellite';

export class CelesTrakProvider implements IDataProvider {
  public readonly name = 'CelesTrak';

  private static getGroupUrl(category?: SatelliteCategory): string {
    switch (category) {
      case 'starlink':
        // Supplementary ephemeris-derived Starlink TLEs as required by Section 1 & 4.2
        return 'https://celestrak.org/NORAD/elements/supplemental/sup-gp.php?FILE=starlink&FORMAT=tle';
      case 'iss':
        return 'https://celestrak.org/NORAD/elements/gp.php?GROUP=stations&FORMAT=tle';
      case 'gps':
        return 'https://celestrak.org/NORAD/elements/gp.php?GROUP=gps-ops&FORMAT=tle';
      case 'weather':
        return 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle';
      case 'science':
        return 'https://celestrak.org/NORAD/elements/gp.php?GROUP=science&FORMAT=tle';
      default:
        return 'https://celestrak.org/NORAD/elements/gp.php?GROUP=visual&FORMAT=tle';
    }
  }

  public async getCatalog(category: SatelliteCategory = 'iss'): Promise<Satellite[]> {
    const url = CelesTrakProvider.getGroupUrl(category);
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      const text = await response.text();
      return this.parseTleCatalogue(text, category);
    } catch {
      return [];
    }
  }

  public async getOrbitalData(noradId: number): Promise<{ line1: string; line2: string; name: string } | null> {
    const url = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${noradId}&FORMAT=tle`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const text = await response.text();
      const list = this.parseTleCatalogue(text);
      if (list.length > 0) {
        return {
          line1: list[0].tleLine1,
          line2: list[0].tleLine2,
          name: list[0].name,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Parses 3-line or 2-line TLE blocks into Satellite domain entities.
   */
  public parseTleCatalogue(rawText: string, category?: SatelliteCategory): Satellite[] {
    const lines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0);

    const satellites: Satellite[] = [];
    let i = 0;

    while (i < lines.length) {
      if (lines[i].startsWith('1 ') && i + 1 < lines.length && lines[i + 1].startsWith('2 ')) {
        // 2-line format without explicit name header
        const line1 = lines[i];
        const line2 = lines[i + 1];
        const noradId = parseInt(line2.substring(2, 7).trim(), 10);
        satellites.push({
          noradId,
          name: `NORAD ${noradId}`,
          tleLine1: line1,
          tleLine2: line2,
          updatedAt: Date.now(),
          source: 'celestrak',
          category,
        });
        i += 2;
      } else if (
        i + 2 < lines.length &&
        lines[i + 1].startsWith('1 ') &&
        lines[i + 2].startsWith('2 ')
      ) {
        // Standard 3-line format: Name, Line 1, Line 2
        const name = lines[i];
        const line1 = lines[i + 1];
        const line2 = lines[i + 2];
        const noradId = parseInt(line2.substring(2, 7).trim(), 10);
        satellites.push({
          noradId,
          name,
          tleLine1: line1,
          tleLine2: line2,
          updatedAt: Date.now(),
          source: 'celestrak',
          category,
        });
        i += 3;
      } else {
        i++;
      }
    }

    return satellites;
  }
}
