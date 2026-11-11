import type { MessageCode } from '../i18n/messages';
import { useEffect, useRef, useState } from 'react';
import type { Frame, Presentation } from '../engine/presentation';
import type { usePresentation } from './usePresentation';

const read = (key: string, fallback: string) => { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* Settings remain usable without storage. */ } };
let context: AudioContext | undefined;
const voices = new Set<OscillatorNode | AudioBufferSourceNode>();
function stopAudio() { for (const voice of voices) { try { voice.stop(); } catch { /* Already ended. */ } } voices.clear(); }
function sound(frame: Frame, volume: number) {
  if (!context || context.state !== 'running' || document.hidden) return;
  const kind = frame.cues.some(c => c.kind === 'removed') ? frame.cues.some(c => c.symbol === 'skull') ? 'death' : 'dissolve' : frame.cues.some(c => c.kind === 'damage') ? 'damage' : frame.visuals?.[0]?.kind;
  if (!kind) return;
  const presets: Record<string, [number, number, number]> = { damage: [150, 65, .14], death: [120, 38, .32], wind: [250, 470, .16], lightning: [920, 90, .19], fireball: [220, 45, .26], sword: [670, 130, .14], touch: [390, 210, .18], earth: [110, 55, .2], teleport: [260, 780, .23], summon: [470, 760, .24], dissolve: [850, 300, .23], release: [170, 330, .18], undo: [360, 220, .2] };
  const [from, to, duration] = presets[kind] ?? presets.touch, start = context.currentTime;
  const gain = context.createGain(); gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * volume * .075), start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  gain.connect(context.destination);
  const oscillator = context.createOscillator(); oscillator.type = ['earth', 'damage', 'death'].includes(kind) ? 'triangle' : 'sine'; oscillator.frequency.setValueAtTime(from, start); oscillator.frequency.exponentialRampToValueAtTime(to, start + duration); oscillator.connect(gain); voices.add(oscillator);
  oscillator.onended = () => { voices.delete(oscillator); oscillator.disconnect(); gain.disconnect(); }; oscillator.start(start); oscillator.stop(start + duration);
  if (['wind', 'lightning', 'fireball', 'sword', 'earth'].includes(kind)) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .25;
    const noise = context.createBufferSource(), filter = context.createBiquadFilter(); noise.buffer = buffer; filter.type = 'lowpass'; filter.frequency.value = kind === 'earth' ? 220 : 1600; noise.connect(filter); filter.connect(gain); voices.add(noise); noise.onended = () => { voices.delete(noise); noise.disconnect(); filter.disconnect(); }; noise.start(start); noise.stop(start + duration);
  }
}
export function useBattleFeedback(playback: ReturnType<typeof usePresentation>, presentation: Presentation | null) {
  const [enabled, setEnabled] = useState(() => read('sw-effects-sound', 'off') === 'on'), [volume, setVolume] = useState(() => { const value = Number(read('sw-effects-volume', '.3')); return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : .3; });
  const [reduced, setReduced] = useState(() => read('sw-effects-reduced', 'false') === 'true'), [systemReduced, setSystemReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches), [error, setError] = useState<MessageCode | ''>('');
  const [undo, setUndo] = useState<Frame | null>(null), seen = useRef('');
  useEffect(() => { const media = matchMedia('(prefers-reduced-motion: reduce)'), change = () => setSystemReduced(media.matches); media.addEventListener('change', change); return () => media.removeEventListener('change', change); }, []);
  useEffect(() => { if (presentation?.kind !== 'undo') { setUndo(null); return; } setUndo(presentation.frames[0]); const timer = setTimeout(() => setUndo(null), 1100); return () => clearTimeout(timer); }, [presentation]);
  const frame = playback.frame ?? undo, key = playback.frame ? playback.movementKey : undo ? `undo:${presentation?.id}` : '';
  useEffect(() => { if (!frame || seen.current === key) return; seen.current = key; if (enabled && !playback.paused) sound(frame, volume); }, [frame, key, enabled, volume, playback.paused]);
  useEffect(() => { if (!enabled || playback.paused) stopAudio(); }, [enabled, playback.paused]);
  useEffect(() => {
    const unlock = () => { if (enabled) { try { context ??= new AudioContext(); void context.resume().catch(() => setError('retryAudio')); } catch { setError('browserAudioUnavailable'); } } };
    const hide = () => { if (document.hidden) stopAudio(); };
    document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock); document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock); document.removeEventListener('visibilitychange', hide); };
  }, [enabled]);
  useEffect(() => () => stopAudio(), []);
  async function toggleSound() {
    if (enabled) { setEnabled(false); write('sw-effects-sound', 'off'); return; }
    try { context ??= new AudioContext(); await context.resume(); if (context.state !== 'running') throw new Error(); setEnabled(true); setError(''); write('sw-effects-sound', 'on'); }
    catch { setError('effectsAudioUnavailable'); }
  }
  return { frame, key, enabled, volume, reduced: reduced || systemReduced, systemReduced, error, toggleSound, changeVolume: (value: number) => { setVolume(value); write('sw-effects-volume', String(value)); stopAudio(); }, changeReduced: (value: boolean) => { setReduced(value); write('sw-effects-reduced', String(value)); } };
}
