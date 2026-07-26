import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';

// Register each top-level key as its own namespace so components using
// useTranslation("duplicates") etc. resolve bare keys, while components
// using useTranslation() continue to work via the "translation" namespace.
const namespaces = Object.keys(en) as Array<keyof typeof en>;

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: en,
      ...Object.fromEntries(namespaces.map((ns) => [ns, en[ns]])),
    },
  },
  lng: 'en',
  fallbackLng: 'en',
  ns: ['translation', ...namespaces],
  defaultNS: 'translation',
  fallbackNS: ['translation'],
  interpolation: { escapeValue: false },
});

export default i18n;
