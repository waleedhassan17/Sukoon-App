/**
 * AudiobookPlayer — chapter-playlist playback engine for the Listen feature.
 *
 * Sibling of the Quran engine (lib/audioPlayer.ts): same expo-av foundation and
 * singleton pattern, but built for long-form listening:
 *   - chapter playlist with auto-advance
 *   - resume from saved position (persisted every 10s + on pause/stop)
 *   - speed 0.75x–2x
 *   - sleep timer (custom minutes or end-of-chapter)
 *   - skip back 15s / forward 30s
 *   - plays downloaded files when present (offline mode)
 *   - counts listening seconds into ListenStats (streaks/badges)
 *   - AudioFocus: never plays over Quran recitation or the Azan
 *
 * Background playback works via `staysActiveInBackground` (same behaviour as
 * the existing Quran player). Lock-screen/media-notification controls need a
 * native media-session module — flagged in docs/audiobooks-implementation-plan.md.
 */

import { Audio, AVPlaybackStatus, AVPlaybackStatusSuccess, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import { AudioFocus } from '../audioFocus';
import { ListenAnalytics } from './analytics';
import { getBundledSource } from './bundledAudio';
import { DownloadManager } from './downloads';
import { ListenProgress } from './progress';
import { ListenStats } from './stats';
import { Book, Chapter } from './types';

export type AudiobookSpeed = 0.75 | 1.0 | 1.25 | 1.5 | 1.75 | 2.0;
export const AUDIOBOOK_SPEEDS: AudiobookSpeed[] = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export type SleepTimerMode = { kind: 'off' } | { kind: 'minutes'; endAt: number } | { kind: 'endOfChapter' };

export interface AudiobookPlayerState {
  book: Book | null;
  chapters: Chapter[];
  chapterIndex: number;
  isPlaying: boolean;
  isBuffering: boolean;
  isLoaded: boolean;
  positionMs: number;
  durationMs: number;
  speed: AudiobookSpeed;
  sleepTimer: SleepTimerMode;
  /** ms remaining on a minutes-based sleep timer (for UI). */
  sleepRemainingMs: number;
  error: string | null;
}

const INITIAL_STATE: AudiobookPlayerState = {
  book: null,
  chapters: [],
  chapterIndex: 0,
  isPlaying: false,
  isBuffering: false,
  isLoaded: false,
  positionMs: 0,
  durationMs: 0,
  speed: 1.0,
  sleepTimer: { kind: 'off' },
  sleepRemainingMs: 0,
  error: null,
};

const PROGRESS_SAVE_INTERVAL_MS = 10_000;
const SKIP_BACK_MS = 15_000;
const SKIP_FORWARD_MS = 30_000;
/** A chapter counts as completed within this tail margin. */
const COMPLETION_TAIL_MS = 3_000;

type Listener = (state: AudiobookPlayerState) => void;

class AudiobookPlayerService {
  private sound: Audio.Sound | null = null;
  private state: AudiobookPlayerState = { ...INITIAL_STATE };
  private listeners = new Set<Listener>();
  private isInitialized = false;
  private loadToken = 0; // guards against races between rapid chapter loads
  private lastSaveAt = 0;
  private lastTickPositionMs = 0;
  private sleepTicker: ReturnType<typeof setInterval> | null = null;

  constructor() {
    AudioFocus.register('audiobooks', () => {
      this.pause().catch(() => {});
    });
  }

  /* ── state plumbing ── */

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): AudiobookPlayerState {
    return this.state;
  }

  private setState(partial: Partial<AudiobookPlayerState>): void {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l(this.state);
  }

  private async init(): Promise<void> {
    if (this.isInitialized) return;
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: false,
      playThroughEarpieceAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    });
    this.isInitialized = true;
  }

  /* ── loading & playback ── */

  /**
   * Start (or resume) a book. Restores the saved chapter/position unless a
   * specific chapterIndex is given.
   */
  async playBook(book: Book, chapters: Chapter[], chapterIndex?: number): Promise<void> {
    if (chapters.length === 0) return;
    let index = chapterIndex ?? 0;
    let positionMs = 0;

    if (chapterIndex === undefined) {
      const saved = await ListenProgress.get(book.id);
      if (saved && !saved.completed) {
        const savedIdx = chapters.findIndex((c) => c.id === saved.chapterId);
        if (savedIdx >= 0) {
          index = savedIdx;
          positionMs = saved.positionMs;
        }
      }
    }

    this.setState({ book, chapters, chapterIndex: index, error: null });
    await this.loadChapter(index, positionMs, true);
    ListenAnalytics.track({ name: 'listen_play', bookId: book.id, chapterIndex: index });
  }

  private async loadChapter(index: number, positionMs: number, autoPlay: boolean): Promise<void> {
    const { book, chapters } = this.state;
    const chapter = chapters[index];
    if (!book || !chapter) return;

    const token = ++this.loadToken;
    await this.init();
    AudioFocus.request('audiobooks');
    await this.unloadSound();
    if (token !== this.loadToken) return;

    this.setState({
      chapterIndex: index,
      isBuffering: true,
      isPlaying: false,
      isLoaded: false,
      positionMs,
      durationMs: chapter.durationSec > 0 ? chapter.durationSec * 1000 : 0,
      error: null,
    });

    try {
      // Source priority: bundled asset (ships in the APK) → downloaded file →
      // stream URL. Bundled/downloaded work fully offline.
      const bundled = getBundledSource(chapter.id);
      const localUri = bundled === null ? await DownloadManager.getLocalUri(chapter.id) : null;
      const source = bundled !== null ? bundled : { uri: localUri ?? chapter.audioUrl };
      const { sound } = await Audio.Sound.createAsync(
        source,
        {
          shouldPlay: autoPlay,
          positionMillis: positionMs,
          rate: this.state.speed,
          shouldCorrectPitch: true,
          progressUpdateIntervalMillis: 500,
          volume: 1.0,
        },
        this.onStatus
      );
      if (token !== this.loadToken) {
        sound.setOnPlaybackStatusUpdate(null);
        sound.unloadAsync().catch(() => {});
        return;
      }
      this.sound = sound;
      this.lastTickPositionMs = positionMs;
    } catch (e: any) {
      if (token !== this.loadToken) return;
      this.setState({
        isBuffering: false,
        error: e?.message || 'Failed to load audio',
      });
    }
  }

  private onStatus = (status: AVPlaybackStatus): void => {
    if (!this.sound) return;
    if (!status.isLoaded) {
      if ((status as any).error) {
        this.setState({
          isLoaded: false,
          isPlaying: false,
          isBuffering: false,
          error: (status as any).error,
        });
      }
      return;
    }
    const s = status as AVPlaybackStatusSuccess;
    const positionMs = s.positionMillis ?? 0;
    const durationMs = s.durationMillis ?? this.state.durationMs;

    // Count real listening time: advance of position while playing (caps out
    // at 2x tick interval so seeks don't inflate stats).
    if (s.isPlaying) {
      const delta = positionMs - this.lastTickPositionMs;
      if (delta > 0 && delta < 2_000) {
        ListenStats.addListeningSecond(delta / 1000);
      }
    }
    this.lastTickPositionMs = positionMs;

    this.setState({
      isLoaded: true,
      isPlaying: s.isPlaying,
      isBuffering: s.isBuffering,
      positionMs,
      durationMs,
    });

    // Periodic resume-point save.
    if (s.isPlaying && Date.now() - this.lastSaveAt > PROGRESS_SAVE_INTERVAL_MS) {
      this.saveProgress().catch(() => {});
    }

    if (s.didJustFinish) {
      this.handleChapterFinish().catch(() => {});
    }
  };

  private async handleChapterFinish(): Promise<void> {
    const { book, chapters, chapterIndex, sleepTimer } = this.state;
    if (!book) return;

    ListenAnalytics.track({
      name: 'listen_complete_chapter',
      bookId: book.id,
      chapterIndex,
    });

    const isLastChapter = chapterIndex >= chapters.length - 1;
    if (isLastChapter) {
      await ListenProgress.markCompleted(book.id);
      await ListenStats.markBookCompleted(book.id);
      await ListenStats.flushNow();
      ListenAnalytics.track({ name: 'listen_complete_book', bookId: book.id });
      this.clearSleepTicker();
      this.setState({ isPlaying: false, sleepTimer: { kind: 'off' }, sleepRemainingMs: 0 });
      return;
    }

    if (sleepTimer.kind === 'endOfChapter') {
      // Stop here; keep position at the start of the next chapter for resume.
      this.setState({ sleepTimer: { kind: 'off' } });
      await this.saveProgressAt(chapterIndex + 1, 0);
      this.setState({ isPlaying: false, chapterIndex: chapterIndex + 1, positionMs: 0 });
      await this.unloadSound();
      return;
    }

    await this.loadChapter(chapterIndex + 1, 0, true);
  }

  /* ── controls ── */

  async togglePlayPause(): Promise<void> {
    if (this.state.isPlaying) {
      await this.pause();
    } else {
      await this.resume();
    }
  }

  async pause(): Promise<void> {
    try {
      if (this.sound && this.state.isLoaded && this.state.isPlaying) {
        await this.sound.pauseAsync();
        await this.saveProgress();
        await ListenStats.flushNow();
      }
    } catch {}
  }

  async resume(): Promise<void> {
    try {
      if (this.sound && this.state.isLoaded) {
        AudioFocus.request('audiobooks');
        // Re-claim audio mode (may be lost after calls / other apps).
        await this.init().catch(() => {});
        await this.sound.playAsync();
      } else if (this.state.book) {
        // Sound was unloaded (end-of-chapter sleep, error) — reload at position.
        await this.loadChapter(this.state.chapterIndex, this.state.positionMs, true);
      }
    } catch {}
  }

  async stop(): Promise<void> {
    await this.saveProgress().catch(() => {});
    await ListenStats.flushNow().catch(() => {});
    this.clearSleepTicker();
    this.loadToken++;
    await this.unloadSound();
    this.setState({ ...INITIAL_STATE, speed: this.state.speed });
  }

  async skipToChapter(index: number): Promise<void> {
    const { chapters } = this.state;
    if (index < 0 || index >= chapters.length) return;
    await this.loadChapter(index, 0, true);
  }

  async nextChapter(): Promise<void> {
    await this.skipToChapter(this.state.chapterIndex + 1);
  }

  async previousChapter(): Promise<void> {
    // Standard audiobook behaviour: restart chapter first, go back on 2nd tap.
    if (this.state.positionMs > 5_000) {
      await this.seekTo(0);
      return;
    }
    await this.skipToChapter(this.state.chapterIndex - 1);
  }

  async seekTo(positionMs: number): Promise<void> {
    try {
      if (this.sound && this.state.isLoaded) {
        const clamped = Math.max(0, Math.min(positionMs, this.state.durationMs || positionMs));
        this.lastTickPositionMs = clamped;
        await this.sound.setPositionAsync(clamped);
        await this.saveProgress();
      }
    } catch {}
  }

  async skipBack(): Promise<void> {
    await this.seekTo(this.state.positionMs - SKIP_BACK_MS);
  }

  async skipForward(): Promise<void> {
    const target = this.state.positionMs + SKIP_FORWARD_MS;
    if (this.state.durationMs > 0 && target >= this.state.durationMs - COMPLETION_TAIL_MS) {
      await this.handleChapterFinish();
      return;
    }
    await this.seekTo(target);
  }

  async setSpeed(speed: AudiobookSpeed): Promise<void> {
    if (!AUDIOBOOK_SPEEDS.includes(speed)) return;
    this.setState({ speed });
    try {
      if (this.sound && this.state.isLoaded) {
        await this.sound.setRateAsync(speed, true);
      }
    } catch {}
  }

  cycleSpeed(): AudiobookSpeed {
    const idx = AUDIOBOOK_SPEEDS.indexOf(this.state.speed);
    const next = AUDIOBOOK_SPEEDS[(idx + 1) % AUDIOBOOK_SPEEDS.length];
    this.setSpeed(next).catch(() => {});
    return next;
  }

  /* ── sleep timer ── */

  setSleepTimerMinutes(minutes: number): void {
    this.clearSleepTicker();
    if (minutes <= 0) {
      this.setState({ sleepTimer: { kind: 'off' }, sleepRemainingMs: 0 });
      return;
    }
    const endAt = Date.now() + minutes * 60_000;
    this.setState({ sleepTimer: { kind: 'minutes', endAt }, sleepRemainingMs: minutes * 60_000 });
    this.sleepTicker = setInterval(() => {
      const remaining = endAt - Date.now();
      if (remaining <= 0) {
        this.clearSleepTicker();
        this.setState({ sleepTimer: { kind: 'off' }, sleepRemainingMs: 0 });
        this.pause().catch(() => {});
      } else {
        this.setState({ sleepRemainingMs: remaining });
      }
    }, 1_000);
  }

  setSleepEndOfChapter(): void {
    this.clearSleepTicker();
    this.setState({ sleepTimer: { kind: 'endOfChapter' }, sleepRemainingMs: 0 });
  }

  cancelSleepTimer(): void {
    this.clearSleepTicker();
    this.setState({ sleepTimer: { kind: 'off' }, sleepRemainingMs: 0 });
  }

  private clearSleepTicker(): void {
    if (this.sleepTicker) {
      clearInterval(this.sleepTicker);
      this.sleepTicker = null;
    }
  }

  /* ── persistence ── */

  private async saveProgress(): Promise<void> {
    await this.saveProgressAt(this.state.chapterIndex, this.state.positionMs);
  }

  private async saveProgressAt(chapterIndex: number, positionMs: number): Promise<void> {
    const { book, chapters } = this.state;
    const chapter = chapters[chapterIndex];
    if (!book || !chapter) return;
    this.lastSaveAt = Date.now();
    const prior = chapters
      .slice(0, chapterIndex)
      .reduce((sum, c) => sum + (c.durationSec || 0), 0);
    await ListenProgress.save({
      bookId: book.id,
      chapterId: chapter.id,
      chapterIndex,
      positionMs: Math.floor(positionMs),
      updatedAt: Date.now(),
      completed: false,
      secondsListened: prior + Math.floor(positionMs / 1000),
    });
  }

  /* ── teardown ── */

  private async unloadSound(): Promise<void> {
    const sound = this.sound;
    this.sound = null;
    if (sound) {
      try {
        sound.setOnPlaybackStatusUpdate(null);
        await sound.stopAsync().catch(() => {});
        await sound.unloadAsync().catch(() => {});
      } catch {}
    }
  }
}

const audiobookPlayer = new AudiobookPlayerService();
export default audiobookPlayer;

/** Format ms → "H:MM:SS" / "MM:SS" for player UIs. */
export function formatPlayerTime(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
