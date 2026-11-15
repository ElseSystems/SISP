/**
 * i18n mínimo (PT/EN) sem dependências. O idioma vive no store; o App remonta o conteúdo
 * (key={lang}) ao trocar, então `t()`/`tr()` podem ler o estado diretamente durante o render.
 */
export type Lang = 'pt' | 'en'
export interface L { pt: string; en: string }

let current: Lang = 'pt'
export const setCurrentLang = (l: Lang) => { current = l }
export const getLang = () => current

/** texto inline: t('Olá', 'Hello') */
export const t = (pt: string, en: string) => (current === 'en' ? en : pt)
/** texto de um objeto bilíngue */
export const tr = (x: L | string) => (typeof x === 'string' ? x : x[current])
export const l = (pt: string, en: string): L => ({ pt, en })

export const detectLang = (): Lang =>
  typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en'
