import { useLanguage } from '../i18n/language';
import { useEffect, useSyncExternalStore } from 'react';
import { playSound, setSoundEnabled, soundEnabled, subscribeSound, unlockSound } from './sound';

export function SoundControl() {
  const { language } = useLanguage();
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled);
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  return <button className="text-button" aria-label={(language === "en" ? "Sound effects" : "Effetti sonori")} aria-pressed={enabled} title={enabled ? (language === "en" ? "Mute sound effects" : "Disattiva effetti sonori") : (language === "en" ? "Enable sound effects" : "Attiva effetti sonori")} onClick={() => {
    const next = !enabled; setSoundEnabled(next);
    if (next) { unlockSound(); playSound('place'); }
  }}>Suoni: {enabled ? 'on' : 'off'}</button>;
}
