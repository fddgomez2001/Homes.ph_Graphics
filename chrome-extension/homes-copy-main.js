/*
 * Homes.ph Publisher, in homes.ph's own page (an article): passes on what the page copies (its "Copy link"
 * button copies the article's short link, homes.ph/s/…) to the extension's script on that page, which uses it
 * as the Facebook post's READ MORE link. It only listens; it changes nothing the page does.
 */
;(function () {
  const pass = (text) => {
    try {
      window.postMessage({ __homesPhPublisherCopy: true, text: String(text == null ? "" : text) }, location.origin)
    } catch {
      // nothing to pass on
    }
  }
  const clip = navigator.clipboard
  if (clip && typeof clip.writeText === "function") {
    const writeText = clip.writeText.bind(clip)
    clip.writeText = function (text) {
      pass(text)
      return writeText(text)
    }
  }
  if (clip && typeof clip.write === "function") {
    const write = clip.write.bind(clip)
    clip.write = function (items) {
      try {
        for (const item of items || [])
          if (item && item.types && item.types.includes("text/plain"))
            item
              .getType("text/plain")
              .then((blob) => blob.text())
              .then(pass)
              .catch(() => {})
      } catch {
        // not text
      }
      return write(items)
    }
  }
  // The older way (a hidden box, selected, then "copy").
  document.addEventListener(
    "copy",
    () => {
      const el = document.activeElement
      const sel = document.getSelection()
      pass((el && typeof el.value === "string" && el.value) || (sel && sel.toString()) || "")
    },
    true,
  )
})()
