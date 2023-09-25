import CLIInfinityProgress from 'cli-infinity-progress';

export const provideInifinityProgressBar = (): CLIInfinityProgress => {
  return new CLIInfinityProgress();
};
