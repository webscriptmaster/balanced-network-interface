import type { LinguiConfig } from '@lingui/conf';

const linguiConfig: LinguiConfig = {
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}',
      include: ['<rootDir>/src'],
    },
  ],
  // compileNamespace: 'cjs',
  fallbackLocales: {
    default: 'en-US',
  },
  format: 'po',
  formatOptions: {
    lineNumbers: false,
  },
  locales: [
    'af-ZA',
    'ar-SA',
    'ca-ES',
    'cs-CZ',
    'da-DK',
    'de-DE',
    'el-GR',
    'en-US',
    'es-ES',
    'fi-FI',
    'fr-FR',
    'he-IL',
    'hu-HU',
    'id-ID',
    'it-IT',
    'ja-JP',
    'ko-KR',
    'nl-NL',
    'no-NO',
    'pl-PL',
    'pt-BR',
    'pt-PT',
    'ro-RO',
    'ru-RU',
    'sr-SP',
    'sv-SE',
    'sw-TZ',
    'tr-TR',
    'uk-UA',
    'vi-VN',
    'zh-CN',
    'zh-TW',
    'pseudo',
  ],
  orderBy: 'messageId',
  rootDir: '.',
  runtimeConfigModule: ['@lingui/core', 'i18n'],
  sourceLocale: 'en-US',
  pseudoLocale: 'pseudo',
};

export default linguiConfig;
