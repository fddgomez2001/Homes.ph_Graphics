/*
 * Homes.ph Publisher on dash.homes.ph/super_editor/articles/…: copies the article's headline (its h1) and its
 * photo, ticks only the brand's sites under "Publish to" (FHI: fhiglobal and Rentsouq, Main News Portal as the
 * dash set it; Caraga / Gensan: Homes and Main News Portal), clicks Publish, then goes on to Facebook Autopost.
 */
;(function () {
  const HP = globalThis.HP
  const text = (el) => HP.oneLine(el && el.textContent)

  /** The "Publish to" box: its site checkboxes (label = box + name) and its Publish button. */
  function publishBox() {
    const h3 = [...document.querySelectorAll("h3, h2, h4")].find((h) => /^publish to/i.test(text(h)))
    if (!h3) return null
    const box = h3.parentElement
    const labels = [...box.querySelectorAll("label")]
    const button = [...box.querySelectorAll("button")].find((b) => /^(publish|update|republish|publish now)$/i.test(text(b)))
    if (!labels.length || !button) return null
    return { box, labels, button }
  }

  const isTicked = (label) => {
    const input = label.querySelector("input[type=checkbox]")
    if (input) return input.checked
    const mark = label.querySelector("[role=checkbox], [aria-checked]")
    if (mark && mark.getAttribute("aria-checked")) return mark.getAttribute("aria-checked") === "true"
    const square = label.firstElementChild
    return !!square && (!!square.querySelector("svg") || /\bbg-foreground\b|\bbg-primary\b/.test(square.className || ""))
  }

  const siteName = (label) => text(label.querySelector("span")) || text(label)

  function articlePhoto() {
    const img =
      document.querySelector('figure[data-image="full"] img') ||
      document.querySelector("article figure img") ||
      [...document.querySelectorAll("main img, article img")].find((i) => i.naturalWidth >= 400 || /amazonaws|cloudinary|\/articles\//.test(i.src))
    return img ? img.currentSrc || img.src : ""
  }

  let running = false
  async function run() {
    if (running) return
    running = true
    try {
      await step()
    } finally {
      running = false
    }
  }

  async function step() {
    if (!/^\/super_editor\/articles\//.test(location.pathname)) return
    const job = await HP.myJob("publish-article")
    if (!job) return
    const settings = await HP.settings()
    const brand = settings.brands.find((b) => b.id === job.brandId)
    HP.banner({ title: `${job.brandName} ${HP.timeLabel(job.time)}`, text: "Reading the article…", buttons: [{ label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }] })

    // The headline (its h1). A published article may have no "Publish to" box any more.
    const h1 = await HP.waitFor(() => {
      const h = document.querySelector("h1")
      return h && text(h) ? h : null
    }, 25000)
    if (!h1 && !job.sitePublished) return HP.jobFail(job, "The article page didn't load (no headline). Are you signed in to dash.homes.ph?")
    const box = h1 ? await HP.waitFor(publishBox, job.sitePublished ? 3000 : 10000) : null

    // What the Facebook post needs: the headline, the photo, the article's address on the brand's site.
    const headline = h1 ? text(h1) : job.title
    const imageUrl = await HP.waitFor(articlePhoto, 8000)
    try {
      await navigator.clipboard.writeText(headline)
    } catch {
      // the page isn't focused: the headline is still kept for the Facebook post
    }
    await HP.jobUpdate(job, { headline, imageUrl: imageUrl || "", articleUrl: location.href }, `Headline copied: ${headline}`)
    if (!imageUrl) await HP.jobUpdate(job, {}, "The article has no photo to copy.")

    // Published already (manually, or checked on the board, or its site pills show): only the Facebook post is left.
    const pill = HP.publishedLink(document, brand)
    const published = !!job.sitePublished || !!pill || !box || !/^publish/i.test(text(box.button))
    if (published) {
      await HP.jobUpdate(job, { alreadyPublished: true }, `Already published${pill ? ` (${pill})` : ""}: not published again.`)
    } else {
      // Only the brand's sites are ticked (Caraga / Gensan: Homes and Main News Portal; FHI: fhiglobal and
      // Rentsouq). Main News Portal stays as the dash set it when the brand doesn't list it; any other site is unticked.
      const { labels, button } = box
      const setTick = async (label, on) => {
        if (isTicked(label) === on) return
        label.click()
        await HP.sleep(250)
        if (isTicked(label) !== on) (label.querySelector("input, [role=checkbox], div") || label).click()
        await HP.sleep(150)
      }
      const missing = []
      for (const site of brand.publishTo) {
        const label = labels.find((l) => HP.sameName(siteName(l), site))
        if (!label) missing.push(site)
        else await setTick(label, true)
      }
      if (missing.length) return HP.jobFail(job, `"Publish to" has no ${missing.map((m) => `"${m}"`).join(" or ")}. Change the brand's sites in the extension's Options.`)
      const keep = (name) => brand.publishTo.some((site) => HP.sameName(name, site)) || HP.sameName(name, "Main News Portal")
      const unticked = []
      for (const label of labels)
        if (isTicked(label) && !keep(siteName(label))) {
          await setTick(label, false)
          unticked.push(siteName(label))
        }
      if (unticked.length) await HP.jobUpdate(job, {}, `Unticked (not this brand's): ${unticked.join(", ")}`)
      const ticked = labels.filter(isTicked).map(siteName)
      await HP.jobUpdate(job, { publishedTo: ticked }, `Publish to: ${ticked.join(", ")}`)

      if (!settings.autoPublish) {
        HP.banner({ title: `${job.brandName} ${HP.timeLabel(job.time)}: ready to publish`, text: `Ticked: ${ticked.join(", ")}. Click Publish; the Facebook post comes next.`, tone: "wait", buttons: [{ label: "Stop", onClick: () => HP.send({ type: "stop-job" }) }] })
        const clicked = await new Promise((resolve) => {
          button.addEventListener("click", () => resolve(true), { once: true })
          const watch = setInterval(async () => {
            if (!(await HP.stillRunning(job))) {
              clearInterval(watch)
              resolve(false)
            }
          }, 1000)
        })
        if (!clicked) return HP.hideBanner()
      } else {
        const go = await HP.countdown(job, settings.countdown, `${job.brandName} ${HP.timeLabel(job.time)}: publishing`, `Publishing to ${ticked.join(", ")}`)
        if (!go) return HP.hideBanner()
        button.click()
      }
      HP.banner({ title: `${job.brandName} ${HP.timeLabel(job.time)}`, text: "Publishing…" })
      // Published when the button stops saying Publish, a "published" message shows, or the page moves on.
      const start = location.href
      const ok = await HP.waitFor(() => {
        const b = publishBox()
        const said = document.body.innerText || ""
        if (location.href !== start) return true
        if (/published|successfully/i.test([...document.querySelectorAll("[role=status], [role=alert], [data-sonner-toast], .toast, [class*=toast]")].map((t) => t.textContent).join(" "))) return true
        if (b && !/^publish$/i.test(text(b.button)) && !b.button.disabled) return true
        if (/could not publish|failed to publish/i.test(said)) return "failed"
        return null
      }, 30000)
      if (ok === "failed") return HP.jobFail(job, "The dash couldn't publish the article. Check the page, then click the time again.")
      if (!ok) await HP.jobUpdate(job, {}, "No \"published\" message seen; going on.")
    }

    // The READ MORE link: the article's real address from its site pill (now that it's published), else the one
    // from the board's window, else made from the headline.
    const link = (await HP.waitFor(() => HP.publishedLink(document, brand), published ? 1500 : 5000)) || job.publishedUrl || HP.articleLink(brand, headline)
    await HP.jobUpdate(job, { publicUrl: link }, `READ MORE link: ${link}`)

    if (!(await HP.stillRunning(job))) return HP.hideBanner()
    // Caraga / Gensan: READ MORE is the article's short link, from "Copy link" on its homes.ph page (its Homes pill).
    if (brand.shortLink) {
      await HP.jobUpdate(job, { step: "short-link", longUrl: link }, `${published ? "Already published" : "Article published"}. Opening it on homes.ph for its short link`)
      HP.banner({ title: `${job.brandName} ${HP.timeLabel(job.time)}`, text: "Opening the article on homes.ph for its short link (Copy link)…", tone: "ok" })
      await HP.sleep(600)
      location.href = link
      return
    }
    await HP.jobUpdate(job, { step: "fb-post" }, published ? "Already published. Opening Facebook Autopost" : "Article published. Opening Facebook Autopost")
    HP.banner({ title: `${job.brandName} ${HP.timeLabel(job.time)}`, text: "Published. Opening homes.ph Facebook Autopost…", tone: "ok" })
    await HP.sleep(800)
    location.href = HP.AUTOPOST_URL
  }

  void run()
  let href = location.href
  HP.every(500, () => {
    if (location.href === href) return
    href = location.href
    void run()
  })
  HP.onStorage((changes, area) => {
    if (area === "local" && changes.job && changes.job.newValue && changes.job.newValue.step === "publish-article") void run()
  })
})()
