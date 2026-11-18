import fs from "node:fs"
import path from "node:path"
import { NextResponse } from "next/server"
import { isLocalMode, fromThisApp } from "@/lib/local/setup"
import * as store from "@/lib/local/store"
import type { LocalProjectQuery } from "@/lib/local/shared"

/**
 * The desktop app's own storage when there's no account ("saved on this computer"): projects,
 * slides, the photo library, templates, settings, the posting checklist and photo files. Only
 * answers inside the desktop app in that mode (the website and signed-in app use the database).
 */

type Ctx = { params: Promise<{ path: string[] }> }

const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }

function fail(e: unknown) {
  if (e instanceof store.LocalError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
  return NextResponse.json({ error: e instanceof Error ? e.message : "The app couldn't read or save its files." }, { status: 500 })
}

const ok = (body: unknown, status = 200) => NextResponse.json(body ?? null, { status })

async function handle(request: Request, ctx: Ctx, method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE") {
  if (!isLocalMode()) return NextResponse.json({ error: "Not available: this app is signed in to the team cloud." }, { status: 404 })
  if (!fromThisApp(request.headers)) return NextResponse.json({ error: "Only the Homes.ph SocMedSystem app can use this." }, { status: 403 })
  const parts = (await ctx.params).path
  const [what, id, action] = parts
  try {
    // Photo files kept on this computer.
    if (what === "files" && method === "GET") {
      const name = id ?? ""
      // Only the app's own photo names (<first 40 hex of the SHA-256>.<type>): nothing else in the folder is served.
      if (!/^[a-f0-9]{40}\.(?:jpe?g|png|webp)$/i.test(name)) return NextResponse.json({ error: "Invalid file." }, { status: 400 })
      const file = path.join(/*turbopackIgnore: true*/ store.imagesDir(), name)
      if (!fs.existsSync(file)) return NextResponse.json({ error: "This photo isn't in the app's folder anymore." }, { status: 404 })
      const ext = name.split(".").pop()?.toLowerCase() ?? ""
      return new NextResponse(new Uint8Array(fs.readFileSync(file)), {
        headers: { "content-type": TYPES[ext] ?? "application/octet-stream", "cache-control": "private, max-age=31536000, immutable" },
      })
    }

    const body = method === "GET" || method === "DELETE" ? {} : ((await request.json().catch(() => ({}))) as Record<string, unknown>)
    const url = new URL(request.url)

    if (what === "projects") {
      if (!id && method === "GET") return ok(store.listProjects(JSON.parse(url.searchParams.get("q") || "{}") as LocalProjectQuery))
      if (!id && method === "POST") return ok({ id: store.createProject(body.input as Parameters<typeof store.createProject>[0], body.cover as never) }, 201)
      if (id && !action && method === "GET") return ok(store.getProject(id))
      if (id && !action && method === "PATCH") return ok(store.updateProject(id, (body.patch as Record<string, unknown>) ?? {}))
      if (id && !action && method === "DELETE") return ok(store.deleteProject(id))
      if (id && action === "duplicate" && method === "POST") return ok({ id: store.duplicateProject(id) }, 201)
      if (id && action === "save" && method === "POST") return ok(store.saveProject({ projectId: id, ...(body as Omit<Parameters<typeof store.saveProject>[0], "projectId">) }))
    }
    if (what === "trash" && id === "purge" && method === "POST") return ok({ count: store.purgeTrash(String(body.cutoff ?? "")) })
    if (what === "slides" && method === "POST") return ok(store.getSlides((body.projectIds as string[]) ?? []))
    if (what === "covers" && method === "POST") return ok(store.coverTemplates((body.projectIds as string[]) ?? []))
    if (what === "usage" && method === "POST") return ok(store.assetUsage((body.publicIds as string[]) ?? []))
    if (what === "assets" && method === "GET") return ok(store.listAssets(url.searchParams.get("search") ?? ""))
    if (what === "templates") {
      if (!id && method === "GET") return ok(store.listTemplates())
      if (!id && method === "POST") return ok(store.createTemplate(body as Parameters<typeof store.createTemplate>[0]), 201)
      if (id && method === "PATCH") return ok(store.renameTemplate(id, String(body.name ?? "")))
      if (id && method === "DELETE") return ok(store.deleteTemplate(id))
    }
    if (what === "settings") {
      if (method === "GET") return ok(store.getSettings())
      if (method === "PUT") return ok(store.saveSettings((body.settings as never) ?? {}))
    }
    if (what === "checks") {
      if (id && method === "GET") return ok(store.listPostChecks(id))
      if (!id && method === "POST") return ok(store.setPostCheck(String(body.projectId), String(body.pageKey), body.checked === true))
    }
    if (what === "profile") {
      if (method === "GET") return ok(store.getProfile())
      if (method === "PUT") return ok(store.setProfileName(String(body.name ?? "")))
    }
    return NextResponse.json({ error: "Unknown request." }, { status: 404 })
  } catch (e) {
    return fail(e)
  }
}

export const GET = (r: Request, c: Ctx) => handle(r, c, "GET")
export const POST = (r: Request, c: Ctx) => handle(r, c, "POST")
export const PATCH = (r: Request, c: Ctx) => handle(r, c, "PATCH")
export const PUT = (r: Request, c: Ctx) => handle(r, c, "PUT")
export const DELETE = (r: Request, c: Ctx) => handle(r, c, "DELETE")
