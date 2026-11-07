import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { square, type Point } from '../engine/geometry';

export type BoardMotion = { id: string; pieceId: string; label: string; from: Point; to: Point; content: ReactNode; duration: number; paused: boolean; onComplete: (id: string) => void };
const transform = (p: Point, rotated: boolean) => `translate(${(rotated ? 9 - p.x : p.x) * 100}%, ${(rotated ? 9 - p.y : p.y) * 100}%)`;

/** A single token moves above the cells; underlying friendly pieces stay on the board. */
export function MovingPiece({ motion, rotated }: { motion: BoardMotion; rotated: boolean }) {
  const ref = useRef<HTMLDivElement>(null), animation = useRef<Animation | null>(null);
  const complete = useRef(motion.onComplete), duration = useRef(motion.duration), baseDuration = useRef(motion.duration);
  const previous = useRef({ id: '', progress: 0 });
  complete.current = motion.onComplete; duration.current = motion.duration;
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), change = () => setReduced(media.matches);
    media.addEventListener('change', change); return () => media.removeEventListener('change', change);
  }, []);
  useLayoutEffect(() => {
    const node = ref.current!;
    if (reduced || !node.animate) { node.dataset.motionState = 'arrived'; complete.current(motion.id); return; }
    const progress = previous.current.id === motion.id ? previous.current.progress : 0;
    baseDuration.current = duration.current;
    const task = node.animate([{ transform: transform(motion.from, rotated) }, { transform: transform(motion.to, rotated) }], { duration: duration.current, easing: 'linear', fill: 'forwards' });
    animation.current = task; task.currentTime = progress * duration.current;
    node.dataset.motionState = 'moving';
    let cancelled = false;
    void task.finished.then(() => { if (!cancelled) { node.dataset.motionState = 'arrived'; complete.current(motion.id); } }).catch(() => { /* Switching frames cancels only the visual animation. */ });
    return () => {
      cancelled = true;
      previous.current = { id: motion.id, progress: Math.min(1, Number(task.currentTime ?? 0) / baseDuration.current) };
      task.cancel(); animation.current = null;
    };
  }, [motion.id, rotated, reduced]);
  useEffect(() => { animation.current?.updatePlaybackRate(baseDuration.current / motion.duration); }, [motion.duration, motion.id]);
  useLayoutEffect(() => {
    const task = animation.current; if (!task || task.playState === 'finished') return;
    if (motion.paused) { task.pause(); ref.current!.dataset.motionState = 'paused'; }
    else { task.play(); ref.current!.dataset.motionState = 'moving'; }
  }, [motion.paused, motion.id, rotated, reduced]);
  return <div ref={ref} className="moving-piece" role="img" aria-label={`${motion.label}: ${square(motion.from)} → ${square(motion.to)}`} data-moving-piece={motion.pieceId} data-motion-id={motion.id} data-from={square(motion.from)} data-to={square(motion.to)} style={{ transform: transform(motion.to, rotated) }}>{motion.content}</div>;
}
