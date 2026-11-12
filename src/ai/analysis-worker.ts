import { analyzeMatch } from './match-analysis';
import type { AnalysisPosition, Side } from '../engine/game';

self.onmessage = ({ data }: MessageEvent<{ positions: AnalysisPosition[]; side: Side }>) => {
  self.postMessage(analyzeMatch(data.positions, data.side));
};
