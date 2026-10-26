export interface PassPoint {
  time: Date;
  azimuth: number; // degrees
  elevation: number; // degrees
  rangeKm?: number;
}

export interface PassPrediction {
  satelliteId: number;
  satelliteName: string;
  aos: PassPoint; // Acquisition of Signal (elevation >= minElevation)
  maxElevation: PassPoint; // Culmination point
  los: PassPoint; // Loss of Signal (elevation drops below minElevation)
  durationSeconds: number;
  trajectory: PassPoint[]; // Intermediate sampled points for Sky Chart
}
