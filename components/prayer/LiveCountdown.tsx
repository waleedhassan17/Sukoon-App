/**
 * LiveCountdown — a self-contained HH:MM:SS ticker.
 *
 * Owns its own 1-second interval so only this tiny <Text> re-renders each
 * second (a ticking parent would re-render the whole screen). It does not decide
 * what happens when the time arrives: usePrayerTimes schedules a single timer
 * for the next prayer and rolls over to the following one.
 */

import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleProp } from 'react-native';
import { formatCountdown, spokenCountdown } from '@/lib/prayerFormat';

export default function LiveCountdown({
  target,
  style,
}: {
  /** Epoch ms of the moment being counted down to. */
  target: number;
  style?: StyleProp<TextStyle>;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  const remaining = Math.max(0, target - now);

  return (
    <Text
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      accessibilityRole="timer"
      // The visual ticks every second; screen readers get a calm, minute-level phrase.
      accessibilityLabel={spokenCountdown(remaining)}
    >
      {formatCountdown(remaining)}
    </Text>
  );
}
