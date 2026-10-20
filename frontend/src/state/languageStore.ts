import { create } from 'zustand';
import { translations, type Language, type Translations } from '../i18n/translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const getSavedLanguage = (): Language => {
  try {
    const saved = localStorage.getItem('fluent_tindahan_language');
    return saved === 'tl' ? 'tl' : 'en';
  } catch {
    return 'en';
  }
};

export const useLanguageStore = create<LanguageState>((set) => ({
  language: getSavedLanguage(),
  setLanguage: (lang: Language) => {
    try {
      localStorage.setItem('fluent_tindahan_language', lang);
    } catch {}
    set({ language: lang });
  },
  toggleLanguage: () =>
    set((state) => {
      const next: Language = state.language === 'en' ? 'tl' : 'en';
      try {
        localStorage.setItem('fluent_tindahan_language', next);
      } catch {}
      return { language: next };
    })
}));

export function useTranslation(): {
  t: Translations;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
} {
  const language = useLanguageStore((s) => s.language);
  const setLanguage = useLanguageStore((s) => s.setLanguage);
  const toggleLanguage = useLanguageStore((s) => s.toggleLanguage);

  return {
    t: translations[language],
    language,
    setLanguage,
    toggleLanguage
  };
}
