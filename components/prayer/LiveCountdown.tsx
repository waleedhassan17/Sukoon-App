/**
 * LiveCountdown — a self-contained HH:MM:SS ticker.
 *
 * Owns its own 1-second interval so only this tiny <Text> re-renders each
 * second (a ticking parent would re-render the whole screen). It does not decide
 * what happens when the time arrives: usePrayerTimes schedules a single timer
 * for the next prayer and rolls over to the following one.
 */

import React, { useEffect, useState } from 'react';
import { Text, TextProps } from 'react-native';
import { formatCountdown, spokenCountdown } from '@/lib/prayerFormat';

export default function LiveCountdown({
  target,
  style,
  ...textProps
}: Omit<TextProps, 'children'> & {
  /** Epoch ms of the moment being counted down to. */
  target: number;
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
      {...textProps}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
      accessibilityRole="timer"
      // The visual ticks every second; screen readers get a calm, minute-level phrase.
      accessibilityLabel={spokenCountdown(remaining)}
    >
      {formatCountdown(remaining)}
    </Text>
  );
}
