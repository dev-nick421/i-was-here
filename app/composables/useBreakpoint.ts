/**
 * Side-by-side layout from 1024 px, and on wide, short screens like phones held sideways
 * (a bottom sheet would leave no room for the poster there).
 */
function wide() {
  const w = window.innerWidth
  const h = window.innerHeight
  return w >= 1024 || (w >= 640 && w / h >= 1.4)
}

const isDesktop = ref(typeof window === 'undefined' ? true : wide())

if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    isDesktop.value = wide()
  })
}

/** Shared desktop/mobile switch. */
export function useBreakpoint() {
  return { isDesktop: readonly(isDesktop) }
}
