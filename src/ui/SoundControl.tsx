import { useEffect, useSyncExternalStore } from 'react';
import { playSound, setSoundEnabled, soundEnabled, subscribeSound, unlockSound } from './sound';

export function SoundControl() {
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled);
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  return <button className="text-button" aria-label="Effetti sonori" aria-pressed={enabled} title={enabled ? 'Disattiva effetti sonori' : 'Attiva effetti sonori'} onClick={() => {
    const next = !enabled; setSoundEnabled(next);
    if (next) { unlockSound(); playSound('place'); }
  }}>Suoni: {enabled ? 'on' : 'off'}</button>;
}
