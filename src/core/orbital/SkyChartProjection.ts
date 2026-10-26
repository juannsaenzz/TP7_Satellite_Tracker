export interface PolarPoint {
  x: number;
  y: number;
}

export class SkyChartProjection {
  /**
   * Projects topocentric azimuth and elevation to 2D Cartesian coordinates on a polar sky chart.
   *
   * @param azimuthDeg Azimuth in degrees [0, 360) clockwise from True North
   * @param elevationDeg Elevation in degrees [0, 90] above horizon
   * @param centerX Chart center X coordinate
   * @param centerY Chart center Y coordinate
   * @param radius Chart outer radius (horizon, elevation = 0°)
   */
  public static project(
    azimuthDeg: number,
    elevationDeg: number,
    centerX: number,
    centerY: number,
    radius: number
  ): PolarPoint {
    // Clamp elevation to [0, 90]
    const clampedEl = Math.max(0, Math.min(90, elevationDeg));

    // Distance from center: 0 at Zenith (90°), radius at Horizon (0°)
    const r = radius * (1.0 - clampedEl / 90.0);

    const azRad = (azimuthDeg * Math.PI) / 180.0;

    // North (0°) points UP (-y), East (90°) points RIGHT (+x)
    const x = centerX + r * Math.sin(azRad);
    const y = centerY - r * Math.cos(azRad);

    return {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
    };
  }

  /**
   * Converts a sequence of trajectory points into an SVG Path `d` string.
   */
  public static buildSvgPath(
    points: { azimuth: number; elevation: number }[],
    centerX: number,
    centerY: number,
    radius: number
  ): string {
    if (points.length === 0) return '';

    const first = this.project(points[0].azimuth, points[0].elevation, centerX, centerY, radius);
    let d = `M ${first.x} ${first.y}`;

    for (let i = 1; i < points.length; i++) {
      const p = this.project(points[i].azimuth, points[i].elevation, centerX, centerY, radius);
      d += ` L ${p.x} ${p.y}`;
    }

    return d;
  }
}
