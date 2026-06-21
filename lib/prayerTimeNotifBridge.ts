import { NotificationService, PrayerTimeEntry, PrayerName } from './notificationService';

// Your existing prayer times format (from Aladhan API or wherever)
export interface RawPrayerTimes {
  Fajr: string;    // "05:23"
  Sunrise: string; // "06:45"
  Dhuhr: string;   // "12:15"
  Asr: string;     // "15:30"
  Maghrib: string; // "18:05"
  Isha: string;    // "19:30"
}

function timeStringToDate(timeStr: string): Date {
  const [h, m] = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function convertToNotifFormat(raw: RawPrayerTimes): PrayerTimeEntry[] {
  const map: { key: PrayerName; label: string; raw: string }[] = [
    { key: 'fajr',    label: 'Fajr',    raw: raw.Fajr },
    { key: 'sunrise', label: 'Sunrise', raw: raw.Sunrise },
    { key: 'dhuhr',   label: 'Dhuhr',   raw: raw.Dhuhr },
    { key: 'asr',     label: 'Asr',     raw: raw.Asr },
    { key: 'maghrib', label: 'Maghrib', raw: raw.Maghrib },
    { key: 'isha',    label: 'Isha',    raw: raw.Isha },
  ];

  return map.map((p) => ({
    name: p.key,
    label: p.label,
    time: timeStringToDate(p.raw),
  }));
}

// Call this whenever prayer times are fetched.
//
// When coordinates are available we schedule a rolling multi-day window so
// notifications keep firing even if the app isn't opened for several days. If
// the window can't be built (offline / API down) we fall back to scheduling just
// today from the times we already have in hand.
export async function scheduleFromPrayerTimes(
  raw: RawPrayerTimes,
  coords?: { lat: number; lng: number },
): Promise<void> {
  if (coords) {
    const ok = await NotificationService.scheduleRollingWindow(coords);
    if (ok) return;
  }
  const entries = convertToNotifFormat(raw);
  await NotificationService.schedulePrayerNotifications(entries);
}
