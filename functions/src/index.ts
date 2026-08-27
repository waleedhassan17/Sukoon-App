/**
 * Sukoon Cloud Functions entry point.
 *
 * Functions exported here become deployable units. Each is implemented in its
 * own file (one concern per file, ~150 lines max) and re-exported below.
 */

export { onPrayerWrite } from './onPrayerWrite';
export { streakSweep } from './streakSweep';
export { createInvite } from './createInvite';
export { acceptInvite } from './acceptInvite';
export { removeFriend } from './removeFriend';
export { blockFriend } from './blockFriend';
