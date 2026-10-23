export interface Toast {
  id: number
  message: string
  tone: 'info' | 'success' | 'error'
  action?: { label: string, run: () => void }
}

const toasts = ref<Toast[]>([])
let nextId = 1

export function useToasts() {
  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }
  function push(message: string, tone: Toast['tone'] = 'info', opts: { action?: Toast['action'], duration?: number } = {}) {
    const id = nextId++
    toasts.value = [...toasts.value.slice(-3), { id, message, tone, action: opts.action }]
    const duration = opts.duration ?? (tone === 'error' ? 7000 : 3800)
    if (duration > 0) setTimeout(() => dismiss(id), duration)
    return id
  }
  return { toasts, push, dismiss }
}
