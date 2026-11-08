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

const laboratory = new URLSearchParams(location.search).get('lab') === '1' || location.hash.startsWith('#invito=');
const online = new URLSearchParams(location.search).get('online') === '1' || location.hash.startsWith('#duello=');
createRoot(document.getElementById('root')!).render(laboratory ? <App /> : <GameApp initialMode={online ? 'online' : 'local'}/>);
