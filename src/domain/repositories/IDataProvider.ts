import { Satellite, SatelliteCategory } from '../models/Satellite';
import { Geoposition } from '../models/Geoposition';

export interface IDataProvider {
  readonly name: string;
  getCatalog(category?: SatelliteCategory): Promise<Satellite[]>;
  getOrbitalData(noradId: number): Promise<{ line1: string; line2: string; name: string } | null>;
  getValidationPosition?(noradId: number): Promise<Geoposition | null>;
}
