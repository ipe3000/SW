import { useLayoutEffect, useRef } from 'react';
import type { Game } from '../engine/game';

/** Fit the square field around the actual controls, without hiding page overflow. */
export function usePlayViewport(stage: Game['stage']) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const screen = ref.current, shell = screen?.closest<HTMLElement>('.app-shell');
    if (!screen || !shell) return;
    const panel = screen.querySelector<HTMLElement>('.board-panel')!;
    const field = panel.querySelector<HTMLElement>('.board-frame')!;
    const heading = screen.querySelector<HTMLElement>('.game-heading')!;
    const console = screen.querySelector<HTMLElement>('.play-console')!;
    const bar = shell.querySelector<HTMLElement>('.topbar')!;
    let frame = 0, previous = '', alive = true;
    const measure = () => {
      frame = 0;
      const mobile = matchMedia('(max-width: 760px)').matches && !matchMedia('(min-width: 600px) and (max-height: 500px)').matches;
      const style = getComputedStyle(shell), grid = getComputedStyle(screen), board = getComputedStyle(panel);
      const edge = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const gap = parseFloat(grid.rowGap) || 0;
      const panelPadding = parseFloat(board.paddingTop) + parseFloat(board.paddingBottom);
      const overhead = Math.max(-12, field.getBoundingClientRect().height - field.getBoundingClientRect().width);
      const availableWidth = panel.clientWidth - parseFloat(board.paddingLeft) - parseFloat(board.paddingRight);
      const barMargin = parseFloat(getComputedStyle(bar).marginBottom) || 0;
      const otherHeight = mobile ? bar.getBoundingClientRect().height + barMargin + heading.getBoundingClientRect().height + console.getBoundingClientRect().height + gap * 2 : 0;
      const availableHeight = window.innerHeight - edge - otherHeight - panelPadding - overhead - 4;
      // A readable minimum remains reachable by normal scrolling on exceptionally small windows.
      const size = `${Math.floor(Math.max(180, Math.min(availableWidth, availableHeight)))}px`;
      if (size !== previous) { shell.style.setProperty('--field-size', size); previous = size; }
    };
    const schedule = () => { if (alive && !frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    for (const element of [panel, heading, console, bar]) observer.observe(element);
    window.addEventListener('resize', schedule);
    document.fonts.ready.then(schedule);
    measure();
    return () => { alive = false; observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); shell.style.removeProperty('--field-size'); };
  }, [stage]);
  return ref;
}
