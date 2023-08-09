
import { SingleBar } from "cli-progress";
import prettyBytes from "pretty-bytes";

export const provideDownloadProgressBar = (): SingleBar => {
  return new SingleBar({
    format: ' {bar} {percentage}% | ETA: {eta_formatted} | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    etaBuffer: 30,
    fps: 2,
    formatValue: (v, options, type) => {
      if (type === 'value' || type === 'total') {
        return prettyBytes(v);
      }

      // no autopadding ? passthrough
      if (options.autopadding !== true) {
        return v.toString();
      }

      // padding
      function autopadding(value: number, length: number) {
        return ((options.autopaddingChar || ' ') + value).slice(-length);
      }

      switch (type) {
        case 'percentage':
          return autopadding(v, 3);

        default:
          return v.toString();
      }
    },
  });
};
