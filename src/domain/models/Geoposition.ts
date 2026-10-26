export interface Geoposition {
  latitude: number; // degrees [-90, 90]
  longitude: number; // degrees [-180, 180]
  altitude: number; // km
  timestamp: number; // unix epoch ms
}

export interface ObserverLocation {
  latitude: number; // degrees [-90, 90]
  longitude: number; // degrees [-180, 180]
  altitudeMeters: number; // meters above sea level
}
