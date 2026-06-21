import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DataSyncService } from '@/lib/dataSyncService';

export interface SavedHadith {
  book: string;          // book id, e.g. 'bukhari'
  bookName: string;      // display name, e.g. 'Sahih al-Bukhari'
  hadithNumber: number;  // hadith number within the book
  arabic: string;
  english: string;
  urdu?: string;
  grade?: string;
  refBook?: number;      // reference.book (chapter/book number)
  refHadith?: number;    // reference.hadith
  savedAt: number;       // Date.now()
}

interface SavedHadithsContextType {
  savedHadiths: SavedHadith[];
  saveHadith: (hadith: Omit<SavedHadith, 'savedAt'>) => void;
  removeHadith: (book: string, hadithNumber: number) => void;
  isHadithSaved: (book: string, hadithNumber: number) => boolean;
  clearAllHadiths: () => void;
  getSavedHadithCount: () => number;
}

const SavedHadithsContext = createContext<SavedHadithsContextType>({
  savedHadiths: [],
  saveHadith: () => {},
  removeHadith: () => {},
  isHadithSaved: () => false,
  clearAllHadiths: () => {},
  getSavedHadithCount: () => 0,
});

const STORAGE_KEY = 'sukoon_saved_hadiths';

export function SavedHadithsProvider({ children }: { children: React.ReactNode }) {
  const [savedHadiths, setSavedHadiths] = useState<SavedHadith[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(data => {
      if (data) setSavedHadiths(JSON.parse(data));
    }).catch(() => {});
  }, []);

  const persist = (hadiths: SavedHadith[]) => {
    setSavedHadiths(hadiths);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hadiths)).catch(() => {});
    // Background cloud sync
    DataSyncService.saveSavedHadiths(hadiths).catch(() => {});
  };

  const isHadithSaved = (book: string, hadithNumber: number) =>
    savedHadiths.some(h => h.book === book && h.hadithNumber === hadithNumber);

  const saveHadith = (hadith: Omit<SavedHadith, 'savedAt'>) => {
    if (isHadithSaved(hadith.book, hadith.hadithNumber)) return;
    persist([{ ...hadith, savedAt: Date.now() }, ...savedHadiths]);
  };

  const removeHadith = (book: string, hadithNumber: number) => {
    persist(savedHadiths.filter(h => !(h.book === book && h.hadithNumber === hadithNumber)));
  };

  const clearAllHadiths = () => persist([]);

  const getSavedHadithCount = () => savedHadiths.length;

  return (
    <SavedHadithsContext.Provider value={{
      savedHadiths,
      saveHadith,
      removeHadith,
      isHadithSaved,
      clearAllHadiths,
      getSavedHadithCount,
    }}>
      {children}
    </SavedHadithsContext.Provider>
  );
}

export const useSavedHadiths = () => useContext(SavedHadithsContext);
