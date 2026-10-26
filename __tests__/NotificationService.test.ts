import { NotificationService } from '../src/core/notifications/NotificationService';
import { PassPrediction } from '../src/domain/models/PassPrediction';

describe('NotificationService Unit Tests (RF-06)', () => {
  const mockPass: PassPrediction = {
    satelliteId: 25544,
    satelliteName: 'ISS (ZARYA)',
    aos: {
      time: new Date(Date.now() + 60 * 60 * 1000), // 1 hour in future
      azimuth: 220,
      elevation: 10,
    },
    maxElevation: {
      time: new Date(Date.now() + 65 * 60 * 1000),
      azimuth: 140,
      elevation: 58,
    },
    los: {
      time: new Date(Date.now() + 70 * 60 * 1000),
      azimuth: 60,
      elevation: 10,
    },
    durationSeconds: 600,
    trajectory: [],
  };

  it('schedules a future pass notification with lead time', async () => {
    const result = await NotificationService.schedulePassAlert(mockPass, 10);
    expect(result).not.toBeNull();
    expect(result!.notificationId).toContain('pass_25544');
    expect(result!.triggerTime.getTime()).toBeLessThan(mockPass.aos.time.getTime());
  });

  it('does not schedule an alert if trigger time is in the past', async () => {
    const pastPass: PassPrediction = {
      ...mockPass,
      aos: { ...mockPass.aos, time: new Date(Date.now() - 5000) },
    };
    const result = await NotificationService.schedulePassAlert(pastPass, 10);
    expect(result).toBeNull();
  });

  it('sends an immediate test notification successfully', async () => {
    const id = await NotificationService.sendImmediateTestAlert('ISS (ZARYA)');
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });
});
