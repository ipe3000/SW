import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from './glossary';

const preferenceKey = 'strategic-wizardry.language';
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'it',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(preferenceKey);
      if (saved === 'it' || saved === 'en') return saved;
    } catch { /* Use browser preferences when storage is unavailable. */ }
    for (const locale of navigator.languages?.length ? navigator.languages : [navigator.language]) {
      const base = locale.split('-')[0].toLowerCase();
      if (base === 'it' || base === 'en') return base;
    }
    return 'en';
  });

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  function setLanguage(next: Language) {
    updateLanguage(next);
    try { localStorage.setItem(preferenceKey, next); }
    catch { /* The preference still applies for this visit. */ }
  }

  return <LanguageContext.Provider value={{ language, setLanguage }}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);

export function LanguageSelect() {
  const { language, setLanguage } = useLanguage();
  const label = language === 'it' ? 'Lingua' : 'Language';
  return <label>{label} <select aria-label={label} value={language} onChange={event => setLanguage(event.target.value === 'en' ? 'en' : 'it')}>
    <option value="it" lang="it">Italiano</option>
    <option value="en" lang="en">English</option>
  </select></label>;
}

export function HomeLanguageSwitch() {
  const { language, setLanguage } = useLanguage();
  return <div className="home-language-switch" role="group" aria-label={language === 'it' ? 'Lingua' : 'Language'}>
    <button type="button" lang="it" aria-pressed={language === 'it'} onClick={() => setLanguage('it')}>Italiano</button>
    <button type="button" lang="en" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button>
  </div>;
}
