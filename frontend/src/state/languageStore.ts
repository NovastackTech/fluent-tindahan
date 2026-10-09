import { create } from 'zustand';
import { translations, type Language, type Translations } from '../i18n/translations';

interface LanguageState {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
}

const savedLang = (localStorage.getItem('fluent_tindahan_language') as Language) || 'tl';

export const useLanguageStore = create<LanguageState>((set) => ({
  language: savedLang === 'en' ? 'en' : 'tl',
  setLanguage: (lang: Language) => {
    localStorage.setItem('fluent_tindahan_language', lang);
    set({ language: lang });
  },
  toggleLanguage: () =>
    set((state) => {
      const next: Language = state.language === 'tl' ? 'en' : 'tl';
      localStorage.setItem('fluent_tindahan_language', next);
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
