import { useEffect, useState } from 'react';
import { playSound, setSoundEnabled, soundEnabled, unlockSound } from './sound';

export function SoundControl() {
  const [enabled, setEnabled] = useState(soundEnabled);
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  return <button className="text-button" aria-label="Effetti sonori" aria-pressed={enabled} title={enabled ? 'Disattiva effetti sonori' : 'Attiva effetti sonori'} onClick={() => {
    const next = !enabled; setEnabled(next); setSoundEnabled(next);
    if (next) { unlockSound(); playSound('place'); }
  }}>Suoni: {enabled ? 'sì' : 'no'}</button>;
}
