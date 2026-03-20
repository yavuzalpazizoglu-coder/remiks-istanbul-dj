import tr from './tr.json';
import en from './en.json';

const translations = { tr, en };

export function t(lang, key) {
  const keys = key.split('.');
  let value = translations[lang] || translations.tr;
  for (const k of keys) {
    value = value?.[k];
  }
  return value || key;
}

export { tr, en };
