import { SkyChartProjection } from '../src/core/orbital/SkyChartProjection';

describe('SkyChartProjection Unit Tests', () => {
  const center = 150;
  const radius = 120;

  it('projects Zenith (90° elevation) directly at center', () => {
    const point = SkyChartProjection.project(0, 90, center, center, radius);
    expect(point.x).toBe(center);
    expect(point.y).toBe(center);
  });

  it('projects North Horizon (Az: 0°, El: 0°) at top edge', () => {
    const point = SkyChartProjection.project(0, 0, center, center, radius);
    expect(point.x).toBe(center);
    expect(point.y).toBe(center - radius);
  });

  it('projects East Horizon (Az: 90°, El: 0°) at right edge', () => {
    const point = SkyChartProjection.project(90, 0, center, center, radius);
    expect(point.x).toBe(center + radius);
    expect(point.y).toBe(center);
  });

  it('projects South Horizon (Az: 180°, El: 0°) at bottom edge', () => {
    const point = SkyChartProjection.project(180, 0, center, center, radius);
    expect(point.x).toBe(center);
    expect(point.y).toBe(center + radius);
  });

  it('projects West Horizon (Az: 270°, El: 0°) at left edge', () => {
    const point = SkyChartProjection.project(270, 0, center, center, radius);
    expect(point.x).toBe(center - radius);
    expect(point.y).toBe(center);
  });

  it('builds SVG path d string from trajectory points', () => {
    const trajectory = [
      { azimuth: 45, elevation: 10 },
      { azimuth: 90, elevation: 45 },
      { azimuth: 135, elevation: 10 },
    ];
    const pathString = SkyChartProjection.buildSvgPath(trajectory, center, center, radius);
    expect(pathString.startsWith('M ')).toBe(true);
    expect(pathString.includes('L ')).toBe(true);
  });
});
