import { useState, useEffect } from 'react'
import clsx from 'clsx'

interface FormFieldProps {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
  hint?: string
}

export function FormField({ label, error, required, children, hint }: FormFieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

export function Input({ error, className, ...props }: InputProps) {
  return (
    <input
      className={clsx(
        'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition',
        error
          ? 'border-red-300 focus:ring-red-400'
          : 'border-gray-300 focus:ring-primary-500 focus:border-transparent',
        className,
      )}
      {...props}
    />
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean
}

export function Select({ error, className, children, ...props }: SelectProps) {
  return (
    <select
      className={clsx(
        'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition bg-white',
        error
          ? 'border-red-300 focus:ring-red-400'
          : 'border-gray-300 focus:ring-primary-500 focus:border-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}

interface CurrencyInputProps {
  value: number | undefined
  onChange: (value: number) => void
  onBlur?: () => void
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  decimals?: number
  error?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CurrencyInput({ value, onChange, onBlur, onKeyDown, decimals = 2, error, placeholder, disabled, className }: CurrencyInputProps) {
  const fmt = (n: number) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

  const [focused, setFocused] = useState(false)
  const [display, setDisplay] = useState(() =>
    value != null && !isNaN(value) && value !== 0 ? fmt(value) : ''
  )

  useEffect(() => {
    if (!focused) {
      setDisplay(value != null && !isNaN(value) && value !== 0 ? fmt(value) : '')
    }
  }, [value, focused]) // eslint-disable-line

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/[^0-9,]/g, '')
    setDisplay(raw)
    const num = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    onChange(isNaN(num) ? 0 : num)
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    setFocused(false)
    const num = parseFloat(e.target.value.replace(/\./g, '').replace(',', '.'))
    if (!isNaN(num) && num !== 0) {
      setDisplay(fmt(num))
      onChange(num)
    } else {
      setDisplay('')
      onChange(0)
    }
    onBlur?.()
  }

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none select-none">R$</span>
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        placeholder={placeholder ?? (decimals === 4 ? '0,0000' : '0,00')}
        disabled={disabled}
        className={clsx(
          'w-full pl-8 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition text-right tabular-nums',
          error
            ? 'border-red-300 focus:ring-red-400'
            : 'border-gray-300 focus:ring-primary-500 focus:border-transparent',
          disabled && 'bg-gray-50 text-gray-400 cursor-not-allowed',
          className,
        )}
      />
    </div>
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

export function Textarea({ error, className, ...props }: TextareaProps) {
  return (
    <textarea
      rows={3}
      className={clsx(
        'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 transition resize-none',
        error
          ? 'border-red-300 focus:ring-red-400'
          : 'border-gray-300 focus:ring-primary-500 focus:border-transparent',
        className,
      )}
      {...props}
    />
  )
}
