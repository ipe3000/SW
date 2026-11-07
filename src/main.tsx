import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { LocalGame } from './ui/LocalGame';
import { OnlineGame } from './ui/OnlineGame';
import './ui/styles.css';
import './ui/game.css';

const laboratory = new URLSearchParams(location.search).get('lab') === '1' || location.hash.startsWith('#invito=');
const online = new URLSearchParams(location.search).get('online') === '1' || location.hash.startsWith('#duello=');
createRoot(document.getElementById('root')!).render(online ? <OnlineGame /> : laboratory ? <App /> : <LocalGame />);
