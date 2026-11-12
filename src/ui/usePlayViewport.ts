import { useLayoutEffect, useRef } from 'react';

/** Fit the desktop field to its column. Mobile sizing is handled in CSS. */
export function usePlayViewport() {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const screen = ref.current, shell = screen?.closest<HTMLElement>('.app-shell');
    if (!screen || !shell) return;
    const panel = screen.querySelector<HTMLElement>('.board-panel')!;
    const field = panel.querySelector<HTMLElement>('.board-frame')!;
    let frame = 0, previous = '', alive = true;
    const measure = () => {
      frame = 0;
      if (matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 500px)').matches) {
        if (previous) shell.style.removeProperty('--field-size');
        previous = '';
        return;
      }
      const style = getComputedStyle(shell), board = getComputedStyle(panel);
      const edge = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const panelPadding = parseFloat(board.paddingTop) + parseFloat(board.paddingBottom);
      const overhead = Math.max(-12, field.getBoundingClientRect().height - field.getBoundingClientRect().width);
      const availableWidth = panel.clientWidth - parseFloat(board.paddingLeft) - parseFloat(board.paddingRight);
      const availableHeight = window.innerHeight - edge - panelPadding - overhead - 4;
      // A readable minimum remains reachable by normal scrolling on exceptionally small windows.
      const size = `${Math.floor(Math.max(180, Math.min(availableWidth, availableHeight)))}px`;
      if (size !== previous) { shell.style.setProperty('--field-size', size); previous = size; }
    };
    const schedule = () => { if (alive && !frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(panel);
    window.addEventListener('resize', schedule);
    document.fonts.ready.then(schedule);
    measure();
    return () => { alive = false; observer.disconnect(); window.removeEventListener('resize', schedule); cancelAnimationFrame(frame); shell.style.removeProperty('--field-size'); };
  }, []);
  return ref;
}
