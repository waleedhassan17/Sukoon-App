/**
 * prayerBackgroundTask — GLOBAL-SCOPE definition of the background top-up task.
 *
 * expo-task-manager requires `defineTask` to run in the global scope of the JS
 * bundle, because when the OS wakes the app in the background no React tree is
 * mounted — an effect/component never runs. If the task is not defined at that
 * moment the OS logs a warning and *unregisters it*, which is exactly how the
 * old setup silently stopped refilling the notification window for users who
 * didn't open the app.
 *
 * Import this module at the very top of `app/_layout.tsx` (a root module that
 * is evaluated in every JS context, including headless background launches).
 *
 * The task is only a bonus: the schedule itself (lib/prayerSchedule.ts) already
 * covers weeks ahead, and it is computed offline so this run needs no network.
 */

// Same name the app has always registered, so installs that already have the
// task registered with the OS start working as soon as this update lands.
export const PRAYER_TASK_NAME = 'SUKOON_PRAYER_RESCHEDULE';

try {
  // Lazy requires: these native modules are absent in Expo Go / web.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const TaskManager = require('expo-task-manager');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const BackgroundFetch = require('expo-background-fetch');

  if (TaskManager && BackgroundFetch && !TaskManager.isTaskDefined(PRAYER_TASK_NAME)) {
    TaskManager.defineTask(PRAYER_TASK_NAME, async () => {
      try {
        // Required lazily so importing this file never drags in the whole
        // notification service (and never creates an import cycle).
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { NotificationService } = require('./notificationService');
        const result = await NotificationService.syncSchedule();
        return result?.ok && result.changed
          ? BackgroundFetch.BackgroundFetchResult.NewData
          : BackgroundFetch.BackgroundFetchResult.NoData;
      } catch {
        return BackgroundFetch.BackgroundFetchResult.Failed;
      }
    });
  }
} catch {
  // Native modules unavailable — nothing to define.
}
