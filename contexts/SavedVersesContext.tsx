import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface SavedVerse {
  surah: number;
  surahName?: string;
  ayah: number;
  arabic: string;
  english: string;
  urdu?: string;
  emotions?: string[];
  savedAt: string;
}

interface SavedVersesContextType {
  savedVerses: SavedVerse[];
  saveVerse: (verse: Omit<SavedVerse, 'savedAt'>) => void;
  removeVerse: (surah: number, ayah: number) => void;
  isVerseSaved: (surah: number, ayah: number) => boolean;
  clearAllVerses: () => void;
}

const SavedVersesContext = createContext<SavedVersesContextType>({
  savedVerses: [],
  saveVerse: () => {},
  removeVerse: () => {},
  isVerseSaved: () => false,
  clearAllVerses: () => {},
});

const STORAGE_KEY = '@sukoon_saved_verses';

export function SavedVersesProvider({ children }: { children: React.ReactNode }) {
  const [savedVerses, setSavedVerses] = useState<SavedVerse[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setSavedVerses(JSON.parse(data));
    }).catch(() => {});
  }, []);

  const persist = (verses: SavedVerse[]) => {
    setSavedVerses(verses);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(verses)).catch(() => {});
  };

  const saveVerse = (verse: Omit<SavedVerse, 'savedAt'>) => {
    if (isVerseSaved(verse.surah, verse.ayah)) return;
    persist([{ ...verse, savedAt: new Date().toISOString() }, ...savedVerses]);
  };

  const removeVerse = (surah: number, ayah: number) => {
    persist(savedVerses.filter(v => !(v.surah === surah && v.ayah === ayah)));
  };

  const isVerseSaved = (surah: number, ayah: number) =>
    savedVerses.some(v => v.surah === surah && v.ayah === ayah);

  const clearAllVerses = () => persist([]);

  return (
    <SavedVersesContext.Provider value={{ savedVerses, saveVerse, removeVerse, isVerseSaved, clearAllVerses }}>
      {children}
    </SavedVersesContext.Provider>
  );
}

export const useSavedVerses = () => useContext(SavedVersesContext);
