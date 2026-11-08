import { useLayoutEffect, useRef } from 'react';
import type { Game } from '../engine/game';

/** Reserve exactly the space occupied by the mobile dock, including its safe-area padding. */
export function usePlayViewport(stage: Game['stage']) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const screen = ref.current, shell = screen?.closest<HTMLElement>('.app-shell');
    if (!screen || !shell) return;
    const dock = screen.querySelector<HTMLElement>('.action-dock');
    let previous = '';
    const measure = () => {
      const height = `${Math.ceil(dock?.getBoundingClientRect().height ?? 0)}px`;
      if (height !== previous) { shell.style.setProperty('--action-dock-height', height); previous = height; }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (dock) observer.observe(dock);
    return () => { observer.disconnect(); shell.style.removeProperty('--action-dock-height'); };
  }, [stage]);
  return ref;
}
