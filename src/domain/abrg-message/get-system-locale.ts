export const getSystemLocale = () => {
  return Intl.DateTimeFormat().resolvedOptions().locale;
};
