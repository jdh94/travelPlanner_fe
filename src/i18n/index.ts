import { createI18n } from 'vue-i18n'
import ja from './ja'
import ko from './ko'
import en from './en'

// ブラウザの言語設定を取得する。
// navigator.language は 'ko', 'ko-KR', 'ja', 'ja-JP' などの形式で返る。
// それ以外の言語はすべて英語にフォールバックする。
function detectLocale(): 'ja' | 'ko' | 'en' {
  const lang = navigator.language?.toLowerCase() ?? ''
  if (lang.startsWith('ko')) return 'ko'
  if (lang.startsWith('ja')) return 'ja'
  return 'en' // Default to English for all other locales
}

const i18n = createI18n({
  legacy: false,        // Composition API モード（useI18n() が使える）
  locale: detectLocale(),
  fallbackLocale: 'en',
  messages: { ja, ko, en },
})

export default i18n
export type Locale = 'ja' | 'ko' | 'en'
