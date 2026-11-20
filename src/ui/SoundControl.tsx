import { useLanguage } from '../i18n/language';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { playSound, setSoundEnabled, soundEnabled, subscribeSound, unlockSound } from './sound';

export function SoundControl({ homeMenu = false }: { homeMenu?: boolean }) {
  const { language } = useLanguage();
  const enabled = useSyncExternalStore(subscribeSound, soundEnabled);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    const unlock = () => unlockSound();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);
  function changeSound(next: boolean) {
    setSoundEnabled(next);
    if (next) { unlockSound(); playSound('place'); }
  }
  if (homeMenu) return <>
    <button className="home-menu-row" aria-expanded={expanded} aria-controls="home-sounds" onClick={() => setExpanded(open => !open)}><span>{language === 'en' ? 'Sound' : 'Suoni'}</span></button>
    <div id="home-sounds" className="home-menu-options" hidden={!expanded}>
      <div className="home-language-switch" role="group" aria-label={language === 'en' ? 'Sound effects' : 'Effetti sonori'}>
        <button aria-pressed={enabled} onClick={() => changeSound(true)}>{language === 'en' ? 'On' : 'Attivi'}</button>
        <button aria-pressed={!enabled} onClick={() => changeSound(false)}>{language === 'en' ? 'Off' : 'Disattivati'}</button>
      </div>
    </div>
  </>;
  return <button className="text-button" aria-label={language === 'en' ? 'Sound effects' : 'Effetti sonori'} aria-pressed={enabled} title={enabled ? (language === 'en' ? 'Mute sound effects' : 'Disattiva effetti sonori') : (language === 'en' ? 'Enable sound effects' : 'Attiva effetti sonori')} onClick={() => changeSound(!enabled)}>{language === 'en' ? 'Sound' : 'Suoni'}: {enabled ? 'on' : 'off'}</button>;
}
