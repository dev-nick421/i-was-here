import { readStorage, writeStorage } from '~/utils/storage'

/**
 * Everything "app-like": service worker registration and updates, the install prompt and
 * whether we're online. The state is shared; `startPwa()` runs once from a client plugin.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** How to install when the browser has no install prompt of its own. */
export type InstallHelp = 'ios' | 'safari' | 'insecure'

const installEvent = shallowRef<InstallPromptEvent | null>(null)
const standalone = ref(false)
const online = ref(true)
const updateReady = ref(false)
const installed = ref(false)
const help = ref<InstallHelp | null>(null)
let waiting: ServiceWorker | null = null
let reloading = false

const HINT_KEY = 'iwh.installHint'

function detectHelp(): InstallHelp | null {
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (ios) return 'ios'
  if (!window.isSecureContext) return 'insecure'
  const safari = /Safari\//.test(ua) && !/Chrome|Chromium|Edg\/|OPR\/|Android|Firefox/.test(ua)
  return safari ? 'safari' : null
}

/** Asks a service worker which build it belongs to. */
function workerVersion(worker: ServiceWorker): Promise<string | null> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => resolve(null), 2000)
    channel.port1.onmessage = (e) => {
      clearTimeout(timer)
      resolve(typeof e.data === 'string' ? e.data : null)
    }
    worker.postMessage({ type: 'GET_VERSION' }, [channel.port2])
  })
}

async function registerWorker(buildId: string, warm: string[]) {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return
  const firstVisit = !navigator.serviceWorker.controller
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })

  // On the first visit the map metadata loaded before the worker was there to keep a copy:
  // fetch it once more through the worker so the map also starts offline next time.
  if (firstVisit) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      for (const url of warm) fetch(url).catch(() => {})
    }, { once: true })
  }

  const onInstalled = async (worker: ServiceWorker) => {
    // The very first worker just takes over; there's nothing to update yet.
    if (!navigator.serviceWorker.controller) return
    if ((await workerVersion(worker)) === buildId) {
      // This page already runs the new build (pages are loaded network-first).
      worker.postMessage({ type: 'SKIP_WAITING' })
    } else {
      waiting = worker
      updateReady.value = true
    }
  }

  if (registration.waiting) onInstalled(registration.waiting)
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') onInstalled(worker)
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) window.location.reload()
  })

  // Installed apps can stay open for days: look for a new version now and then.
  let lastCheck = Date.now()
  const check = () => {
    if (Date.now() - lastCheck < 15 * 60_000) return
    lastCheck = Date.now()
    registration.update().catch(() => {})
  }
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check())
  setInterval(check, 60 * 60_000)
}

/**
 * @param warm URLs the service worker should keep from the first visit on (the TileJSON).
 */
export function startPwa(buildId: string, { serviceWorker = true, warm = [] as string[] } = {}) {
  const displayMode = window.matchMedia('(display-mode: standalone)')
  const updateStandalone = () => {
    standalone.value = displayMode.matches || (navigator as { standalone?: boolean }).standalone === true
  }
  updateStandalone()
  displayMode.addEventListener('change', updateStandalone)

  online.value = navigator.onLine
  window.addEventListener('online', () => (online.value = true))
  window.addEventListener('offline', () => (online.value = false))

  help.value = detectHelp()
  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the prompt for our own "Install app" button instead of the browser's mini-infobar.
    e.preventDefault()
    installEvent.value = e as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installEvent.value = null
    installed.value = true
  })

  if (serviceWorker) {
    registerWorker(buildId, warm).catch(err => console.warn('Service worker registration failed', err))
  }
}

export function usePwa() {
  /** Whether to show "Install app" at all. */
  const canInstall = computed(() => !standalone.value && !installed.value && (!!installEvent.value || !!help.value))

  const ui = useUiStore()

  /** Opens the browser's install prompt, or our instructions where there is none. */
  async function install() {
    const e = installEvent.value
    if (!e) {
      ui.installOpen = true
      return
    }
    installEvent.value = null // a prompt can only be shown once
    await e.prompt()
    await e.userChoice.catch(() => null)
  }

  /** Activates the waiting new version and reloads. */
  function applyUpdate() {
    if (!waiting) return window.location.reload()
    reloading = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
    setTimeout(() => window.location.reload(), 3000)
  }

  /** Suggests installing once per browser, e.g. after the first export. */
  function shouldHintInstall() {
    if (!canInstall.value || readStorage(HINT_KEY)) return false
    writeStorage(HINT_KEY, '1')
    return true
  }

  return {
    standalone: readonly(standalone),
    online: readonly(online),
    updateReady: readonly(updateReady),
    help: readonly(help),
    installed: readonly(installed),
    canInstall,
    install,
    applyUpdate,
    shouldHintInstall,
  }
}
