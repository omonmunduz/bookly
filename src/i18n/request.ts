import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  // Always use Russian for now
  const locale = 'ru';

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
