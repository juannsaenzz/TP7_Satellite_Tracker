import notifee, { AndroidImportance, TriggerType, TimestampTrigger } from '@notifee/react-native';
import { PassPrediction } from '../../domain/models/PassPrediction';
import { colors } from '../../presentation/theme/colors';

export class NotificationService {
  public static readonly CHANNEL_ID = 'satellite_passes';

  /**
   * Initializes the Android notification channel for satellite pass reminders.
   */
  public static async initialize(): Promise<void> {
    try {
      await notifee.createChannel({
        id: this.CHANNEL_ID,
        name: 'Satellite Passes',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
        lights: true,
        lightColor: colors.primary,
      });
    } catch (err) {
      console.warn('Failed to create notification channel:', err);
    }
  }

  /**
   * Requests runtime notification permission on Android 13+ and iOS.
   */
  public static async requestPermission(): Promise<boolean> {
    try {
      const settings = await notifee.requestPermission();
      return settings.authorizationStatus >= 1;
    } catch {
      return false;
    }
  }

  /**
   * Schedules a reminder notification N minutes before a satellite pass acquisition (AOS).
   *
   * @param pass Pass prediction details
   * @param leadMinutes Minutes before AOS to fire the alert (default 10)
   */
  public static async schedulePassAlert(
    pass: PassPrediction,
    leadMinutes: number = 10
  ): Promise<{ notificationId: string; triggerTime: Date } | null> {
    await this.initialize();
    await this.requestPermission();

    const aosMs = pass.aos.time.getTime();
    const triggerMs = aosMs - leadMinutes * 60 * 1000;

    // If trigger time has already passed, return null
    if (triggerMs <= Date.now()) {
      return null;
    }

    const trigger: TimestampTrigger = {
      type: TriggerType.TIMESTAMP,
      timestamp: triggerMs,
    };

    const notificationId = `pass_${pass.satelliteId}_${aosMs}`;

    await notifee.createTriggerNotification(
      {
        id: notificationId,
        title: `Alerta de pase: ${pass.satelliteName}`,
        body: `¡Pase comenzando en ${leadMinutes} min! Elevación máx. ${pass.maxElevation.elevation.toFixed(0)}° a las ${pass.maxElevation.time.toLocaleTimeString()}.`,
        android: {
          channelId: this.CHANNEL_ID,
          smallIcon: 'ic_launcher',
          color: colors.primary,
          pressAction: {
            id: 'default',
          },
        },
      },
      trigger
    );

    return {
      notificationId,
      triggerTime: new Date(triggerMs),
    };
  }

  /**
   * Sends an immediate test notification to demonstrate the pass reminder mechanism on the device.
   */
  public static async sendImmediateTestAlert(satelliteName: string = 'ISS (ZARYA)'): Promise<string> {
    await this.initialize();
    await this.requestPermission();

    const notificationId = `test_${Date.now()}`;

    await notifee.displayNotification({
      id: notificationId,
      title: `Alerta de prueba de pase: ${satelliteName}`,
      body: `¡Pase visible en 10 minutos! Elevación máx. 68° a las ${new Date(Date.now() + 10 * 60 * 1000).toLocaleTimeString()}.`,
      android: {
        channelId: this.CHANNEL_ID,
        smallIcon: 'ic_launcher',
        color: colors.primary,
        pressAction: {
          id: 'default',
        },
      },
    });

    return notificationId;
  }

  /**
   * Cancels a scheduled pass notification by ID.
   */
  public static async cancelAlert(notificationId: string): Promise<void> {
    try {
      await notifee.cancelNotification(notificationId);
    } catch (err) {
      console.warn('Failed to cancel notification:', err);
    }
  }
}
