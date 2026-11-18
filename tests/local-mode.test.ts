import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_POST_PAGES, LOCAL_USER_ID } from "@/lib/local/shared"

// The desktop app without an account: setup.json in the app's data folder, the work in a folder.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "dcm-local-"))
const userDir = path.join(root, "userData")
const work = path.join(root, "Daily Carousel Maker")
fs.mkdirSync(userDir, { recursive: true })

function writeSetup(value: unknown) {
  fs.writeFileSync(path.join(userDir, "setup.json"), JSON.stringify(value))
  // A new mtime so the cached setup is read again.
  const t = new Date(Date.now() + Math.floor(Math.random() * 100000))
  fs.utimesSync(path.join(userDir, "setup.json"), t, t)
}

const setup = await import("@/lib/local/setup")
const store = await import("@/lib/local/store")
const { GET } = await import("@/app/api/local/[...path]/route")

/** What the app's own pages send to its local server. */
const APP = { host: "127.0.0.1:3939" }
const cover = { version: 1, elements: [] } as unknown as Parameters<typeof store.createProject>[1]

afterAll(() => {
  vi.unstubAllEnvs()
  fs.rmSync(root, { recursive: true, force: true })
})

describe("desktop modes (setup.json)", () => {
  it("the website has no desktop mode", () => {
    vi.stubEnv("DCM_USER_DIR", "")
    expect(setup.desktopMode()).toBeNull()
    expect(setup.isLocalMode()).toBe(false)
  })

  it("a first start (no setup.json, or not done) is the welcome setup", () => {
    vi.stubEnv("DCM_USER_DIR", userDir)
    fs.rmSync(path.join(userDir, "setup.json"), { force: true })
    expect(setup.desktopMode()).toBe("setup")
    writeSetup({ done: false, mode: "local", storage: { kind: "local", folder: work } })
    expect(setup.desktopMode()).toBe("setup")
    expect(setup.isLocalMode()).toBe(false)
  })

  it("done: no account (local) or the team cloud (account)", () => {
    vi.stubEnv("DCM_USER_DIR", userDir)
    writeSetup({ done: true, mode: "account", storage: { kind: "cloudinary", folder: work } })
    expect(setup.desktopMode()).toBe("account")
    expect(setup.isLocalMode()).toBe(false)
    writeSetup({ done: true, mode: "local", storage: { kind: "local", folder: work } })
    expect(setup.desktopMode()).toBe("local")
    expect(setup.isLocalMode()).toBe(true)
    expect(setup.localFolder()).toBe(work)
    expect(setup.photosInCloudinary()).toBe(false)
  })

  it("a folder that isn't a full path is never used", () => {
    vi.stubEnv("DCM_USER_DIR", userDir)
    writeSetup({ done: true, mode: "local", storage: { kind: "local", folder: "relative\\folder" } })
    expect(setup.isLocalMode()).toBe(false)
  })
})

describe("the work saved on this computer", () => {
  beforeEach(() => {
    vi.stubEnv("DCM_USER_DIR", userDir)
    writeSetup({ done: true, mode: "local", storage: { kind: "local", folder: work } })
  })

  it("creates, lists, saves and duplicates carousels in the folder", () => {
    const id = store.createProject({ title: "  Cebu condos  ", scheduledAt: null, status: "draft" }, cover)
    expect(fs.existsSync(path.join(work, "projects", `${id}.json`))).toBe(true)
    expect(fs.existsSync(path.join(work, "README.txt"))).toBe(true)
    const p = store.getProject(id)
    expect(p).toMatchObject({ title: "Cebu condos", user_id: LOCAL_USER_ID, revision: 0, slide_count: 1 })
    expect(store.listProjects({} as never).some((x) => x.id === id)).toBe(true)

    const slides = store.getSlides([id])
    const saved = store.saveProject({
      projectId: id,
      expectedRevision: 0,
      project: { title: "Cebu condos 2026" },
      slides: [
        { ...slides[0], slide_type: "cover" },
        { id: "11111111-1111-4111-8111-111111111111", slide_type: "card" },
      ],
    })
    expect(saved.revision).toBe(1)
    expect(store.getProject(id)).toMatchObject({ title: "Cebu condos 2026", slide_count: 2 })
    // Saved from another window in between: refused, nothing lost.
    expect(() => store.saveProject({ projectId: id, expectedRevision: 0, project: {}, slides: [{ ...slides[0], slide_type: "cover" }] })).toThrow(/changed somewhere else/)
    // The cover comes first.
    expect(() => store.saveProject({ projectId: id, expectedRevision: 1, project: {}, slides: [{ id: "x", slide_type: "card" }] })).toThrow(/cover/)

    const copy = store.duplicateProject(id)
    expect(store.getProject(copy)).toMatchObject({ title: "Cebu condos 2026 (copy)", status: "draft", revision: 0 })
    expect(store.getSlides([copy])).toHaveLength(2)
  })

  it("Published keeps a posted time; other statuses clear it", () => {
    const id = store.createProject({ title: "Status", scheduledAt: null, status: "draft" }, cover)
    expect(store.updateProject(id, { status: "published" }).posted_at).toBeTruthy()
    expect(store.updateProject(id, { status: "draft" }).posted_at).toBeNull()
  })

  it("ticking all 17 pages publishes it; unticking one goes back", () => {
    const id = store.createProject({ title: "Checklist", scheduledAt: "2026-11-11T01:00:00.000Z", status: "scheduled" }, cover)
    for (const page of DEFAULT_POST_PAGES) store.setPostCheck(id, page.key, true)
    expect(store.getProject(id)).toMatchObject({ status: "published", posted_count: DEFAULT_POST_PAGES.length })
    store.setPostCheck(id, DEFAULT_POST_PAGES[3].key, false)
    expect(store.getProject(id)).toMatchObject({ status: "scheduled", posted_count: DEFAULT_POST_PAGES.length - 1, posted_at: null })
    expect(() => store.setPostCheck(id, "not-a-page", true)).toThrow(/Unknown page/)
  })

  it("deleting removes the file and its ticks", () => {
    const id = store.createProject({ title: "Gone", scheduledAt: null, status: "draft" }, cover)
    store.setPostCheck(id, DEFAULT_POST_PAGES[0].key, true)
    store.deleteProject(id)
    expect(fs.existsSync(path.join(work, "projects", `${id}.json`))).toBe(false)
    expect(store.listPostChecks(id)).toEqual([])
  })

  it("serves only the app's own photo files", async () => {
    fs.mkdirSync(path.join(work, "images"), { recursive: true })
    const name = `${"ab".repeat(20)}.png`
    fs.writeFileSync(path.join(work, "images", name), Buffer.from([137, 80, 78, 71]))
    fs.writeFileSync(path.join(work, "settings.json"), "{}")
    const get = (file: string) => GET(new Request(`http://127.0.0.1/api/local/files/${file}`, { headers: APP }), { params: Promise.resolve({ path: ["files", file] }) })
    const ok = await get(name)
    expect(ok.status).toBe(200)
    expect(ok.headers.get("content-type")).toBe("image/png")
    for (const bad of ["..", "settings.json", "..%2Fsetup.json", `${"ab".repeat(20)}.exe`]) expect((await get(bad)).status).toBe(400)
  })

  it("answers nothing when the app is signed in to the team cloud", async () => {
    writeSetup({ done: true, mode: "account", storage: { kind: "cloudinary", folder: work } })
    const res = await GET(new Request("http://127.0.0.1/api/local/projects", { headers: APP }), { params: Promise.resolve({ path: ["projects"] }) })
    expect(res.status).toBe(404)
  })

  it("only the app's own pages may use it (no website, no other host)", async () => {
    const list = (headers: Record<string, string>) => GET(new Request("http://127.0.0.1/api/local/projects", { headers }), { params: Promise.resolve({ path: ["projects"] }) })
    expect((await list(APP)).status).toBe(200)
    expect((await list({ ...APP, origin: "http://127.0.0.1:3939", "sec-fetch-site": "same-origin" })).status).toBe(200)
    expect((await list({ ...APP, origin: "https://evil.example", "sec-fetch-site": "cross-site" })).status).toBe(403)
    expect((await list({ ...APP, "sec-fetch-site": "cross-site" })).status).toBe(403)
    expect((await list({ host: "evil.example:3939" })).status).toBe(403)
    expect(setup.fromThisApp(new Headers({ host: "localhost:3940", origin: "http://localhost:3940" }))).toBe(true)
  })
})
