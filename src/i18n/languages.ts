// Every ISO 639-1 language. Names are rendered at runtime with Intl.DisplayNames,
// so the picker shows each language in its own script without shipping a name table.
export const ISO_639_1 = [
  'aa', 'ab', 'ae', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az', 'ba', 'be', 'bg', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
  'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy', 'da', 'de', 'dv', 'dz', 'ee', 'el', 'en', 'eo', 'es', 'et', 'eu', 'fa',
  'ff', 'fi', 'fj', 'fo', 'fr', 'fy', 'ga', 'gd', 'gl', 'gn', 'gu', 'gv', 'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu', 'ja', 'jv', 'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko',
  'kr', 'ks', 'ku', 'kv', 'kw', 'ky', 'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv', 'mg', 'mh', 'mi', 'mk', 'ml', 'mn',
  'mr', 'ms', 'mt', 'my', 'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny', 'oc', 'oj', 'om', 'or', 'os', 'pa',
  'pi', 'pl', 'ps', 'pt', 'qu', 'rm', 'rn', 'ro', 'ru', 'rw', 'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so',
  'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw', 'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
  'ug', 'uk', 'ur', 'uz', 've', 'vi', 'vo', 'wa', 'wo', 'xh', 'yi', 'yo', 'za', 'zh', 'zu',
] as const

export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv', 'ks', 'ku'])

// Languages with bundled, reviewed UI translations. All others fall back to English
// until a translation pack (machine or community) is installed.
export const TRANSLATED = ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'ar', 'es', 'fr'] as const

export function languageName(code: string, displayIn?: string): string {
  try {
    return new Intl.DisplayNames([displayIn ?? code, 'en'], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export function allLanguages() {
  return ISO_639_1.map((code) => ({
    code,
    native: languageName(code, code),
    english: languageName(code, 'en'),
    rtl: RTL_LANGUAGES.has(code),
    translated: (TRANSLATED as readonly string[]).includes(code),
  })).sort((a, b) => Number(b.translated) - Number(a.translated) || a.english.localeCompare(b.english))
}
