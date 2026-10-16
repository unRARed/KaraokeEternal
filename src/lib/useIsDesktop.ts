import { useSyncExternalStore } from 'react'

// a mouse or trackpad (not touch) is the primary input
const query = window.matchMedia('(hover: hover) and (pointer: fine)')

const subscribe = (onChange: () => void) => {
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const useIsDesktop = () => useSyncExternalStore(subscribe, () => query.matches)

export default useIsDesktop
