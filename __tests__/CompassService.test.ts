import { CompassService } from '../src/core/sensors/CompassService';

describe('CompassService Unit Tests (RF-07)', () => {
  it('detects locked target when device heading and pitch match look angles', () => {
    const targetAz = 45.0;
    const targetEl = 60.0;
    const deviceHeading = 46.0;
    const devicePitch = 59.0;

    const delta = CompassService.computeOrientationDelta(targetAz, targetEl, deviceHeading, devicePitch);

    expect(delta.isLocked).toBe(true);
    expect(delta.relativeHeadingDeg).toBe(-1.0); // device is at 46, target at 45 -> turn left 1
    expect(delta.relativePitchDeg).toBe(1.0); // device is at 59, target at 60 -> tilt up 1
  });

  it('correctly handles 0/360 boundary wrapping', () => {
    // Target is at North-Northwest (355°), Device points at North-Northeast (5°)
    const targetAz = 355.0;
    const targetEl = 40.0;
    const deviceHeading = 5.0;
    const devicePitch = 40.0;

    const delta = CompassService.computeOrientationDelta(targetAz, targetEl, deviceHeading, devicePitch);

    // Difference should be -10 degrees (turn left 10 degrees), NOT -350
    expect(delta.relativeHeadingDeg).toBe(-10.0);
    expect(delta.relativePitchDeg).toBe(0.0);
    expect(delta.isLocked).toBe(false);
  });

  it('generates guidance string', () => {
    const targetAz = 90.0; // East
    const targetEl = 45.0;
    const deviceHeading = 60.0;
    const devicePitch = 20.0;

    const delta = CompassService.computeOrientationDelta(targetAz, targetEl, deviceHeading, devicePitch);
    const guidance = CompassService.getGuidanceText(delta);

    expect(guidance).toContain('Turn right');
    expect(guidance).toContain('Tilt up');
  });
});
