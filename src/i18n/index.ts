import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { resources } from './resources'
import { RTL_LANGUAGES } from './languages'

const LANG_KEY = 'unifiedtree-erp-lang'

function storedLanguage() {
  try {
    return localStorage.getItem(LANG_KEY)
  } catch {
    return null
  }
}

export function applyLanguage(code: string) {
  document.documentElement.lang = code
  document.documentElement.dir = RTL_LANGUAGES.has(code) ? 'rtl' : 'ltr'
}

export function setLanguage(code: string) {
  try {
    localStorage.setItem(LANG_KEY, code)
  } catch {
    /* ignore */
  }
  applyLanguage(code)
  void i18n.changeLanguage(code)
}

const initial = storedLanguage() ?? (navigator.language?.split('-')[0] || 'en')

void i18n.use(initReactI18next).init({
  resources,
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})
applyLanguage(initial)

export default i18n
