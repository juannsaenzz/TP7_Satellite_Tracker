export type SatelliteCategory = 'starlink' | 'iss' | 'gps' | 'weather' | 'science' | 'other';

export interface Satellite {
  noradId: number;
  name: string;
  tleLine1: string;
  tleLine2: string;
  epoch?: Date;
  updatedAt: number; // epoch ms
  source: 'celestrak' | 'space-track' | 'wheretheiss' | 'n2yo' | 'custom';
  category?: SatelliteCategory;
}
