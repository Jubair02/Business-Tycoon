import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Subscribe to the media query itself rather than mirroring it into state.
 *
 * The previous version set state synchronously inside an effect to seed the
 * first value, which React 19 flags: it causes a second render pass on every
 * mount. `useSyncExternalStore` is what that pattern is for — React reads the
 * current value during render and re-reads it when the query changes.
 */
function subscribe(onStoreChange: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

/**
 * There is no viewport on the server, so the server snapshot has to pick one.
 * Desktop is the safer default: a desktop-first first paint that corrects to
 * mobile shows too much, while a mobile-first one that corrects to desktop
 * shows too little and reflows more visibly.
 */
function getServerSnapshot(): boolean {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
