import { createContext, useContext, useState, type ReactNode } from 'react';

const HomePageContext = createContext<{ setup: boolean; setSetup: (open: boolean) => void } | null>(null);

/** Keep the play panel open while switching between local and online setup. */
export function HomePageProvider({ children }: { children: ReactNode }) {
  const [setup, setSetup] = useState(() => new URLSearchParams(location.search).get('online') === '1' || location.hash.startsWith('#duello='));
  return <HomePageContext value={{ setup, setSetup }}>{children}</HomePageContext>;
}

export function useHomePage() {
  const state = useContext(HomePageContext);
  if (!state) throw new Error('Home page state is unavailable.');
  return state;
}
