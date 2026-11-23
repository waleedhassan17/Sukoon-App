/**
 * App-wide image sharing for Ayahs and Hadith.
 *
 *   const { shareAyah, shareHadith } = useShare();
 *   shareAyah({ surahName, surahNumber, ayahNumber, arabic, english, urdu });
 *
 * Opens the share sheet (live card preview → style / size / translation →
 * "Share image"). The sheet is rendered by <ShareSheetHost/> at the root of the
 * app as a plain overlay, NOT inside an RN <Modal>: on Android a Modal is a
 * separate window, and capturing views inside it with view-shot is unreliable.
 *
 * The actions and the sheet state live in separate contexts so that screens
 * calling `useShare()` don't re-render when the sheet opens or closes.
 */

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import * as Haptics from 'expo-haptics';
import {
  AyahCardInput,
  CardLang,
  HadithCardInput,
  ShareCardContent,
  ayahCardContent,
  hadithCardContent,
} from '@/lib/shareCard';
import ShareSheet from '@/components/share/ShareSheet';

export interface ShareRequest {
  id: number;
  content: ShareCardContent;
  /** The translation the user is reading on the calling screen, if known. */
  preferredLang?: CardLang | null;
}

type WithLang<T> = T & { preferredLang?: CardLang | null };

export interface ShareApi {
  shareAyah: (input: WithLang<AyahCardInput>) => void;
  shareHadith: (input: WithLang<HadithCardInput>) => void;
}

interface ShareState {
  request: ShareRequest | null;
  close: () => void;
}

const noop = () => {};
const ShareApiContext = createContext<ShareApi>({ shareAyah: noop, shareHadith: noop });
const ShareStateContext = createContext<ShareState>({ request: null, close: noop });

export function ShareProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<ShareRequest | null>(null);

  const open = useCallback((content: ShareCardContent, preferredLang?: CardLang | null) => {
    if (!content.arabic && !content.english && !content.urdu) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setRequest({ id: Date.now(), content, preferredLang });
  }, []);

  const api = useMemo<ShareApi>(
    () => ({
      shareAyah: ({ preferredLang, ...input }) => open(ayahCardContent(input), preferredLang),
      shareHadith: ({ preferredLang, ...input }) => open(hadithCardContent(input), preferredLang),
    }),
    [open],
  );

  const close = useCallback(() => setRequest(null), []);
  const state = useMemo(() => ({ request, close }), [request, close]);

  return (
    <ShareApiContext.Provider value={api}>
      <ShareStateContext.Provider value={state}>{children}</ShareStateContext.Provider>
    </ShareApiContext.Provider>
  );
}

export const useShare = () => useContext(ShareApiContext);

/** Mount once, above the navigator, so the sheet covers every screen. */
export function ShareSheetHost() {
  const { request, close } = useContext(ShareStateContext);
  if (!request) return null;
  return <ShareSheet key={request.id} request={request} onClose={close} />;
}
