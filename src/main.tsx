import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { LocalGame } from './ui/LocalGame';
import './ui/styles.css';
import './ui/game.css';

const laboratory = new URLSearchParams(location.search).get('lab') === '1' || location.hash.startsWith('#invito=');
createRoot(document.getElementById('root')!).render(laboratory ? <App /> : <LocalGame />);
