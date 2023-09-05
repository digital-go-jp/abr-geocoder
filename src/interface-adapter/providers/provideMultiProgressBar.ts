import { MultiBar } from 'cli-progress';

export const provideMultiProgressBar = (): MultiBar => {
  return new MultiBar({
    stream: process.stdout,
    fps: 5,
    hideCursor: true,
    stopOnComplete: true,
    clearOnComplete: true,
    format: ' {bar} {percentage}% | {filename} | ETA: {eta_formatted}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    etaBuffer: 10,
  });
};
