import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Language } from './glossary';

const preferenceKey = 'strategic-wizardry.language';
const LanguageContext = createContext<{ language: Language; setLanguage: (language: Language) => void }>({
  language: 'it',
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem(preferenceKey) === 'en' ? 'en' : 'it'; }
    catch { return 'it'; }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try { localStorage.setItem(preferenceKey, language); }
    catch { /* The preference still applies for this visit. */ }
  }, [language]);

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
