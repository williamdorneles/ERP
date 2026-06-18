import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  loading?: boolean
  onConfirm?: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  variant = 'danger',
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  const iconBg = variant === 'danger' ? 'bg-red-100' : variant === 'warning' ? 'bg-amber-100' : 'bg-blue-100'
  const iconColor = variant === 'danger' ? 'text-red-600' : variant === 'warning' ? 'text-amber-600' : 'text-blue-600'
  const btnVariant = variant === 'danger' ? 'danger' : 'primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${iconBg}`}>
          {variant === 'default'
            ? <CheckCircle2 size={22} className={iconColor} />
            : <AlertTriangle size={22} className={iconColor} />
          }
        </div>
        <h3 className="text-center text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <div className="text-center text-sm text-gray-500 mb-6">{message}</div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {onConfirm ? 'Cancelar' : 'Fechar'}
          </Button>
          {onConfirm && (
            <Button variant={btnVariant} className="flex-1" loading={loading} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
