import { useRef, ComponentPropsWithoutRef } from 'react'
import { useEnterToTab } from '../../hooks/useEnterToTab'

/**
 * Substituto direto de <form> que adiciona navegação por Enter entre campos.
 * Uso: troque <form ...> por <Form ...> — nenhuma outra mudança necessária.
 */
export function Form({ children, ...props }: ComponentPropsWithoutRef<'form'>) {
  const ref = useRef<HTMLFormElement>(null)
  useEnterToTab(ref)
  return (
    <form ref={ref} {...props}>
      {children}
    </form>
  )
}
