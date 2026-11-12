import { findMoments, suggestMove, type AnalysisRequest, type AnalysisResponse } from './match-analysis';

self.onmessage = ({ data }: MessageEvent<AnalysisRequest>) => {
  const result: AnalysisResponse = data.kind === 'scan'
    ? { kind: 'scan', moments: findMoments(data.positions, data.side) }
    : { kind: 'suggest', suggestion: suggestMove(data.moment) };
  self.postMessage(result);
};
