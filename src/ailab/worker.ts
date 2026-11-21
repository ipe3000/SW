import { simulateCampaignMatch } from './simulation';
import type { Case, Config } from './model';

self.onmessage = ({ data }: MessageEvent<{ test: Case; config: Config }>) => {
  const result = simulateCampaignMatch(data.test, data.config, progress => self.postMessage({ kind: 'progress', ...progress }));
  self.postMessage({ kind: 'result', result });
};
