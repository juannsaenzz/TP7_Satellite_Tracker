export interface OrientationDelta {
  relativeHeadingDeg: number; // [-180, 180]: negative = turn left, positive = turn right
  relativePitchDeg: number; // negative = tilt down, positive = tilt up
  isLocked: boolean; // within tolerance
  targetDistanceAngleDeg: number; // total angular separation
}

export class CompassService {
  public static readonly LOCK_TOLERANCE_DEG = 7.0; // degrees of tolerance for target lock

  /**
   * Computes the relative orientation offset between device heading/pitch and the satellite look angles.
   *
   * @param targetAzimuth Satellite azimuth in degrees [0, 360) from True North
   * @param targetElevation Satellite elevation in degrees [-90, 90] above horizon
   * @param deviceHeading Device compass heading in degrees [0, 360)
   * @param devicePitch Device tilt angle in degrees [0, 90] (0 = flat horizontal, 90 = vertical up)
   */
  public static computeOrientationDelta(
    targetAzimuth: number,
    targetElevation: number,
    deviceHeading: number,
    devicePitch: number = 0
  ): OrientationDelta {
    // 1. Heading offset [-180, 180]
    let deltaHeading = (targetAzimuth - deviceHeading) % 360;
    while (deltaHeading > 180) deltaHeading -= 360;
    while (deltaHeading < -180) deltaHeading += 360;

    // 2. Pitch offset (clamp target elevation to positive for pointing in sky)
    const effectiveTargetEl = Math.max(0, targetElevation);
    const deltaPitch = effectiveTargetEl - devicePitch;

    // 3. Angular separation via spherical direct approximation
    const targetDistanceAngleDeg = Math.sqrt(deltaHeading ** 2 + deltaPitch ** 2);

    const isLocked =
      Math.abs(deltaHeading) <= this.LOCK_TOLERANCE_DEG &&
      Math.abs(deltaPitch) <= this.LOCK_TOLERANCE_DEG;

    return {
      relativeHeadingDeg: Math.round(deltaHeading * 10) / 10,
      relativePitchDeg: Math.round(deltaPitch * 10) / 10,
      isLocked,
      targetDistanceAngleDeg: Math.round(targetDistanceAngleDeg * 10) / 10,
    };
  }

  /**
   * Returns human-readable directional guidance instructions.
   */
  public static getGuidanceText(delta: OrientationDelta): string {
    if (delta.isLocked) {
      return 'OBJETIVO FIJADO • APUNTAR DIRECTO AL SATÉLITE';
    }

    const instructions: string[] = [];

    if (Math.abs(delta.relativeHeadingDeg) > 4) {
      if (delta.relativeHeadingDeg > 0) {
        instructions.push(`Girar a la derecha ${Math.round(delta.relativeHeadingDeg)}°`);
      } else {
        instructions.push(`Girar a la izquierda ${Math.round(Math.abs(delta.relativeHeadingDeg))}°`);
      }
    }

    if (Math.abs(delta.relativePitchDeg) > 4) {
      if (delta.relativePitchDeg > 0) {
        instructions.push(`Inclinar hacia arriba ${Math.round(delta.relativePitchDeg)}°`);
      } else {
        instructions.push(`Inclinar hacia abajo ${Math.round(Math.abs(delta.relativePitchDeg))}°`);
      }
    }

    return instructions.length > 0 ? instructions.join(' • ') : 'ALINEANDO...';
  }
}
