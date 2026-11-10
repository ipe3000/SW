import type { Frame } from '../engine/presentation';

export type Sound = 'step' | 'damage' | 'removed' | 'turn' | 'victory' | 'place' | 'wind' | 'lightning' | 'fireball' | 'sword' | 'touch' | 'earth' | 'teleport' | 'summon' | 'illusion' | 'dissolve' | 'release' | 'undo';
let context: AudioContext | undefined;
let master: GainNode | undefined;
let enabled = false;
try { enabled = localStorage.getItem('sw-sound') === 'on'; } catch { /* Optional storage. */ }
const listeners = new Set<() => void>();
export const soundEnabled = () => enabled;
export function subscribeSound(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function setSoundEnabled(value: boolean) {
  enabled = value;
  try { localStorage.setItem('sw-sound', value ? 'on' : 'off'); } catch { /* Optional storage. */ }
  if (master && context) master.gain.setTargetAtTime(value ? .36 : 0, context.currentTime, .015);
  listeners.forEach(listener => listener());
}
/** Called from a user gesture: browsers keep audio locked until interaction. */
export function unlockSound() {
  if (!enabled) return;
  try {
    if (!context) {
      context = new AudioContext();
      master = context.createGain(); master.gain.value = .36;
      const compressor = context.createDynamicsCompressor();
      master.connect(compressor); compressor.connect(context.destination);
      // A quiet stone-hall echo shared by the instruments.
      const delay = context.createDelay(.5), echo = context.createGain();
      delay.delayTime.value = .13; echo.gain.value = .16;
      master.connect(delay); delay.connect(echo); echo.connect(compressor);
    }
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch { /* Audio is optional on unsupported devices. */ }
}

export function playSound(kind: Sound) {
  if (!enabled || !context || !master || context.state !== 'running' || document.hidden) return;
  const ctx = context, output = master, now = ctx.currentTime;
  function tone(hz: number, duration: number, gain = .18, offset = 0, end = hz, type: OscillatorType = 'sine') {
    const osc = ctx.createOscillator(), envelope = ctx.createGain(), start = now + offset;
    osc.type = type; osc.frequency.setValueAtTime(hz, start); osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), start + duration);
    envelope.gain.setValueAtTime(0, start); envelope.gain.linearRampToValueAtTime(gain, start + .012); envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
    osc.connect(envelope); envelope.connect(output); osc.start(start); osc.stop(start + duration + .02);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
  }
  function noise(duration: number, frequency: number, gain: number, high = false) {
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
    source.buffer = buffer; filter.type = high ? 'highpass' : 'lowpass'; filter.frequency.value = frequency;
    envelope.gain.setValueAtTime(0, now); envelope.gain.linearRampToValueAtTime(gain, now + .015); envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter); filter.connect(envelope); envelope.connect(output); source.start(now); source.stop(now + duration);
    source.onended = () => { source.disconnect(); filter.disconnect(); envelope.disconnect(); };
  }
  function bells(notes: number[], descending = false) {
    notes.forEach((hz, i) => { const offset = i * .065; tone(hz, .65, .15, offset, descending ? hz * .5 : hz); tone(hz * 2.76, .3, .025, offset); });
  }
  switch (kind) {
    case 'step': noise(.09, 650, .17); tone(115, .1, .12, 0, 65); break;
    case 'damage': noise(.16, 1100, .24); tone(135, .22, .3, 0, 45); break;
    case 'sword': noise(.27, 2500, .22, true); bells([740, 1046]); break;
    case 'fireball': noise(.75, 750, .45); tone(95, .6, .3, 0, 30); break;
    case 'lightning': noise(.3, 1800, .4, true); tone(180, .4, .18, 0, 40, 'sawtooth'); break;
    case 'wind': noise(.65, 1000, .27); tone(220, .5, .07, 0, 440); break;
    case 'earth': noise(.5, 250, .4); tone(70, .55, .3, 0, 32); break;
    case 'touch': bells([196, 233, 294], true); break;
    case 'teleport': bells([294, 440, 587, 880]); break;
    case 'summon': case 'illusion': bells([293.66, 349.23, 440, 587.33]); break;
    case 'removed': tone(147, .8, .2, 0, 49); noise(.6, 500, .15); break;
    case 'dissolve': case 'undo': bells([587, 440, 294], true); break;
    case 'release': bells([440, 659]); break;
    case 'place': bells([293.66, 440]); break;
    case 'turn': bells([196, 294, 392]); break;
    case 'victory': bells([293.66, 369.99, 440, 587.33, 739.99]); tone(146.83, 1.2, .14); break;
  }
}

/** One cue per frame, prioritising the spell over its simultaneous impact. */
export function frameSound(frame: Frame): Sound | null {
  if (frame.game.stage === 'finished') return 'victory';
  if (frame.cues.some(c => c.symbol === 'skull')) return 'removed';
  if (frame.visuals?.length) return frame.visuals[0].kind;
  if (frame.cues.some(c => c.kind === 'damage')) return 'damage';
  if (frame.movement) return 'step';
  return null;
}
