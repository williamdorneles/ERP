import { useEffect, RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
].join(', ')

/**
 * Faz o Enter avançar para o próximo campo focalizável dentro do container.
 * Ignora: textareas (Enter = nova linha), botões de submit, e inputs que
 * já chamaram e.preventDefault() em seu próprio onKeyDown (ex: BOM).
 */
export function useEnterToTab(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Enter') return
      // Já foi tratado por um handler interno do elemento
      if (e.defaultPrevented) return

      const target = e.target as HTMLElement
      const tag = target.tagName

      // Textarea: Enter insere nova linha — não interferir
      if (tag === 'TEXTAREA') return
      // Botão de submit: Enter deve submeter o form
      if (tag === 'BUTTON' && (target as HTMLButtonElement).type !== 'button') return

      // Coleta todos os campos visíveis e habilitados no container
      const focusables = Array.from(
        el!.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(f => {
        // apenas elementos visíveis (offsetParent !== null)
        if (!f.offsetParent) return false
        // ignora botões que não sejam de submit (já são "ação", não "campo")
        if (f.tagName === 'BUTTON' && (f as HTMLButtonElement).type !== 'submit') return false
        return true
      })

      const idx = focusables.indexOf(target)
      if (idx === -1) return

      const next = focusables[idx + 1]
      if (!next) return

      e.preventDefault()
      next.focus()
      // Seleciona o texto para facilitar substituição
      if (next instanceof HTMLInputElement && next.type !== 'checkbox' && next.type !== 'radio') {
        next.select()
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [ref])
}
