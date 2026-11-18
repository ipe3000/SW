import { LanguageProvider } from './i18n/language';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { GameApp } from './ui/GameApp';
import './ui/styles.css';
import './ui/game.css';
import './ui/battle-effects.css';
import './ui/meadow-theme.css';
import './ui/play-layout.css';
import './ui/fantasy-realism.css';
import './ui/rules.css';
import './ui/compact-play.css';
import './ui/entry-cloister.css';
import './ui/play-cloister.css';
import './ui/tutorial.css';

const laboratory = new URLSearchParams(location.search).get('lab') === '1' || location.hash.startsWith('#invito=');
const online = new URLSearchParams(location.search).get('online') === '1' || location.hash.startsWith('#duello=');
// Static hosts may send the main SPA for /ailab instead of resolving its directory.
if (/\/ailab\/?$/.test(location.pathname)) {
  const robots = document.createElement('meta');
  robots.name = 'robots'; robots.content = 'noindex, nofollow, noarchive';
  document.head.append(robots);
  location.replace(`${location.pathname.replace(/\/?$/, '/index.html')}${location.search}${location.hash}`);
} else {
  createRoot(document.getElementById('root')!).render(laboratory ? <App /> : <LanguageProvider><GameApp initialMode={online ? 'online' : 'local'}/></LanguageProvider>);
}
