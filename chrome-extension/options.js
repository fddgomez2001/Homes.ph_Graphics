const $ = (id) => document.getElementById(id)
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c])

function show(s) {
  $("showEverywhere").checked = !!s.showEverywhere
  $("autoPublish").checked = !!s.autoPublish
  $("autoSchedule").checked = !!s.autoSchedule
  $("countdown").value = s.countdown
  $("nowWindow").value = s.nowWindow
  $("siteUrl").value = s.siteUrl
  $("cityUrl").value = s.cityUrl
  $("carouselPages").value = s.carouselPages || ""
  $("postWay").checked = s.postWay === "autopost"
  $("autoPost").checked = s.autoPost !== false
  $("assigned").textContent = s.assigned
    ? `Assigned in Homes.ph SocMedSystem: ${s.brands.map((b) => b.name).join(", ") || "no pages"}${s.carousel ? ", and the carousel" : ""}. Only these show in the panel.`
    : "Homes.ph SocMedSystem hasn't said which pages are yours yet (connect it, then click ⟳ in the panel). Until then: FHI, PicklePlay, CARAGA, Gensan and the carousel."
  $("brands").innerHTML = s.allBrands
    .map(
      (b) => `<div class="brand" data-id="${b.id}">
        <h3><img src="${b.logo}" alt="" /> ${esc(b.name)} <span class="hint">(${esc(HP.GROUPS[b.group].label)}${s.brands.some((x) => x.id === b.id) ? ", yours" : ""})</span></h3>
        <div class="grid">
          <label for="hub-${b.id}">Target Hub</label><input type="text" id="hub-${b.id}" value="${esc(b.hub)}" />
          <label for="pub-${b.id}">Publish to</label><input type="text" id="pub-${b.id}" value="${esc(b.publishTo.join(", "))}" />
          <label for="fb-${b.id}">Facebook Page</label><input type="text" id="fb-${b.id}" value="${esc(b.fbPage)}" />
          <label for="url-${b.id}">Article address</label><input type="url" id="url-${b.id}" value="${esc(b.newsUrl)}" />
        </div>
      </div>`,
    )
    .join("")
}

function read(current) {
  return {
    showEverywhere: $("showEverywhere").checked,
    autoPublish: $("autoPublish").checked,
    autoSchedule: $("autoSchedule").checked,
    countdown: Number($("countdown").value),
    nowWindow: Number($("nowWindow").value),
    siteUrl: $("siteUrl").value.trim() || HP.GROUPS.site.url,
    cityUrl: $("cityUrl").value.trim() || HP.GROUPS.city.url,
    carouselPages: $("carouselPages").value.trim(),
    postWay: $("postWay").checked ? "autopost" : "dash",
    autoPost: $("autoPost").checked,
    brands: current.allBrands.map((b) => ({
      id: b.id,
      name: b.name,
      group: b.group,
      hub: $(`hub-${b.id}`).value.trim() || b.hub,
      publishTo: $(`pub-${b.id}`)
        .value.split(",")
        .map((x) => x.trim())
        .filter(Boolean),
      fbPage: $(`fb-${b.id}`).value.trim() || b.fbPage,
      newsUrl: $(`url-${b.id}`).value.trim() || b.newsUrl,
    })),
  }
}

async function appStatus() {
  const s = await HP.send({ type: "app-status" })
  $("app-status").innerHTML = s.paired
    ? `<span class="ok">Connected</span> to Homes.ph SocMedSystem ${esc(s.version || "")}`
    : s.open
      ? `<span class="bad">Not connected</span>: Homes.ph SocMedSystem is open, click Connect.`
      : `<span class="bad">Homes.ph SocMedSystem isn't open</span> on this computer.`
  $("app-connect").disabled = !!s.paired
  $("app-disconnect").disabled = !s.paired
}

async function main() {
  const got = await chrome.storage.local.get(["settings", "assignment"])
  let settings = HP.withDefaults(got.settings, got.assignment)
  show(settings)
  $("save").addEventListener("click", async () => {
    settings = HP.withDefaults(read(settings), got.assignment)
    await chrome.storage.local.set({ settings: HP.savedSettings(settings) })
    show(settings)
    $("saved").textContent = "Saved."
    setTimeout(() => ($("saved").textContent = ""), 2500)
  })
  $("reset").addEventListener("click", async () => {
    settings = HP.withDefaults(null, got.assignment)
    await chrome.storage.local.set({ settings: HP.savedSettings(settings) })
    show(settings)
    $("saved").textContent = "Back to the defaults."
  })
  $("app-connect").addEventListener("click", async () => {
    $("app-connect").disabled = true
    $("app-status").textContent = "Homes.ph SocMedSystem is asking you to allow it…"
    const res = await HP.send({ type: "app-connect" })
    if (res.error) $("app-status").innerHTML = `<span class="bad">${esc(res.error)}</span>`
    else await appStatus()
    $("app-connect").disabled = false
  })
  $("app-disconnect").addEventListener("click", async () => {
    await HP.send({ type: "app-disconnect" })
    await appStatus()
  })
  await appStatus()
}

void main()
