import en from './en.js';
import id from './id.js';

const DICTS = { en, id };
const KEY = 'driftbound:lang';
const store = typeof localStorage !== 'undefined' ? localStorage : null;
let lang = store?.getItem(KEY)
  ?? (typeof navigator !== 'undefined' && navigator.language?.startsWith('id') ? 'id' : 'en');
if (!DICTS[lang]) lang = 'en';
const listeners = new Set();

export const getLang = () => lang;
export const onLang = fn => (listeners.add(fn), () => listeners.delete(fn));

export function setLang(next) {
  if (!DICTS[next] || next === lang) return;
  lang = next;
  try { store?.setItem(KEY, lang); } catch (_) {}
  applyDom();
  listeners.forEach(fn => fn(lang));
}

/** t('toast.pickup', { item, n }) — key may be array of fallbacks */
export function t(key, params) {
  const keys = [].concat(key);
  const hit = keys.find(k => k in DICTS[lang]) ?? keys.find(k => k in DICTS.en);
  const str = hit ? (DICTS[lang][hit] ?? DICTS.en[hit]) : String(keys[0]);
  return params ? str.replace(/\{(\w+)\}/g, (_, p) => params[p] ?? '') : str;
}

export function applyDom(root) {
  if (typeof document === 'undefined') return;
  const r = root || document;
  document.documentElement.lang = lang;
  try { document.title = t('app.title'); } catch (_) {}
  r.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  r.querySelectorAll('[data-i18n-attr]').forEach(el => {
    for (const pair of (el.dataset.i18nAttr || '').split(';')) {
      const [attr, k] = pair.split(':');
      if (attr && k) el.setAttribute(attr, t(k));
    }
  });
}
