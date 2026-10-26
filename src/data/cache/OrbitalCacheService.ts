import AsyncStorage from '@react-native-async-storage/async-storage';
import { Satellite } from '../../domain/models/Satellite';

export interface CachedItem<T> {
  data: T;
  timestamp: number; // epoch ms
}

export class OrbitalCacheService {
  public static readonly DEFAULT_TTL_HOURS = 18;

  public static isStale(timestamp: number, ttlHours: number = OrbitalCacheService.DEFAULT_TTL_HOURS): boolean {
    const ageMs = Date.now() - timestamp;
    return ageMs > ttlHours * 60 * 60 * 1000;
  }

  public static getAgeHours(timestamp: number): number {
    return Math.max(0, (Date.now() - timestamp) / (60 * 60 * 1000));
  }

  public static async saveCatalog(category: string, satellites: Satellite[]): Promise<void> {
    const item: CachedItem<Satellite[]> = {
      data: satellites,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`@cat_${category}`, JSON.stringify(item));
  }

  public static async getCatalog(
    category: string,
    ttlHours: number = OrbitalCacheService.DEFAULT_TTL_HOURS
  ): Promise<{ data: Satellite[]; timestamp: number; isStale: boolean } | null> {
    try {
      const raw = await AsyncStorage.getItem(`@cat_${category}`);
      if (!raw) return null;
      const item: CachedItem<Satellite[]> = JSON.parse(raw);
      return {
        data: item.data,
        timestamp: item.timestamp,
        isStale: this.isStale(item.timestamp, ttlHours),
      };
    } catch {
      return null;
    }
  }

  public static async saveTle(
    noradId: number,
    data: { line1: string; line2: string; name: string }
  ): Promise<void> {
    const item: CachedItem<{ line1: string; line2: string; name: string }> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(`@tle_${noradId}`, JSON.stringify(item));
  }

  public static async getTle(
    noradId: number,
    ttlHours: number = OrbitalCacheService.DEFAULT_TTL_HOURS
  ): Promise<{ data: { line1: string; line2: string; name: string }; timestamp: number; isStale: boolean } | null> {
    try {
      const raw = await AsyncStorage.getItem(`@tle_${noradId}`);
      if (!raw) return null;
      const item: CachedItem<{ line1: string; line2: string; name: string }> = JSON.parse(raw);
      return {
        data: item.data,
        timestamp: item.timestamp,
        isStale: this.isStale(item.timestamp, ttlHours),
      };
    } catch {
      return null;
    }
  }
}
