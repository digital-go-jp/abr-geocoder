import { RegExpEx } from "./reg-exp-ex";

export const getUrlHash = (url: string): string => {
  const urlObj = new URL(url);
  return '.' + urlObj.pathname
    .replaceAll(RegExpEx.create('[^a-zA-Z0-9_]', 'g'), '');
}
