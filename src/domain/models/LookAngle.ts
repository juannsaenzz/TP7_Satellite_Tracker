export interface LookAngle {
  azimuth: number; // degrees [0, 360) clockwise from True North
  elevation: number; // degrees [-90, 90] above horizon
  rangeKm: number; // slant range in kilometers
}
