/*
 * Homes.ph Publisher on the phone: runs first in every page the app opens. The page is laid out like on a
 * computer (1200 px wide, zoomed out to fit; pinch to zoom): the extension's scripts find the same buttons and
 * tables as in Chrome. At the end, the app puts in the script homes.ph's articles get in the page itself
 * (homes-copy-main.js).
 */
;(function () {
  if (window.top !== window) return
  const WIDTH = "width=1200"
  // Every viewport the page has (some sites add theirs late, after ours: the last one would win).
  const fix = () => {
    const metas = document.querySelectorAll('meta[name="viewport"]')
    for (const meta of metas) if (meta.getAttribute("content") !== WIDTH) meta.setAttribute("content", WIDTH)
    if (metas.length || !document.head) return
    const meta = document.createElement("meta")
    meta.setAttribute("name", "viewport")
    meta.setAttribute("content", WIDTH)
    document.head.appendChild(meta)
  }
  fix()
  // The page writes its own viewport while it loads (and some rewrite it later): only those changes are looked at.
  const isMeta = (node) => node && (node.nodeName === "META" || node.nodeName === "HEAD")
  const seen = (records) => {
    for (const r of records) {
      if (isMeta(r.target) && r.type === "attributes") return fix()
      for (const n of r.addedNodes || []) if (isMeta(n)) return fix()
    }
  }
  try {
    new MutationObserver(seen).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["content"] })
  } catch {
    // no document yet
  }
  document.addEventListener("DOMContentLoaded", fix)
  window.addEventListener("load", fix)

  if (/^(www\.)?homes\.ph$/.test(location.hostname) && location.pathname.startsWith("/news/")) {
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    __HP_MAIN__
  }
})()
