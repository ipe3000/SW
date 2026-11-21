import { playSearchJob } from './autotune';
import type { MatchProgress, MatchSummary } from './simulation';

export type SearchWorkerJob = Parameters<typeof playSearchJob>[0];
export type SearchWorkerMessage = { kind: 'progress'; progress: MatchProgress } | { kind: 'result'; summary: MatchSummary };

self.onmessage = ({ data }: MessageEvent<SearchWorkerJob>) => {
  const summary = playSearchJob(data, progress => self.postMessage({ kind: 'progress', progress } satisfies SearchWorkerMessage));
  self.postMessage({ kind: 'result', summary } satisfies SearchWorkerMessage);
};
