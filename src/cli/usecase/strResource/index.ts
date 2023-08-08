import i18next from 'i18next';
import { MESSAGE } from './locales';
export * from './locales';

export const getSystemLocale = () => {
  return Intl
    .DateTimeFormat()
    .resolvedOptions()
    .locale;
};

i18next.init({
  fallbackLng: 'en',
  resources: {
    en: {
      translation: require('./locales/en.ts').default,
    },
    ja: {
      translation: require('./locales/ja.ts').default,
    }
  }
})

export default (lng: string = 'en') => {
  const originalTranslater = i18next.getFixedT(lng);
  return (resourceId: MESSAGE) => originalTranslater(resourceId);
}