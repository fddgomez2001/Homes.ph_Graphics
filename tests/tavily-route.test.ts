import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ getRequestUser: vi.fn(async () => ({ user: { id: "u1" } })) }))

const { POST } = await import("@/app/api/ai/tavily/route")
const { getRequestUser } = await import("@/lib/supabase/server")

const call = (body: unknown, key?: string) =>
  POST(new Request("http://localhost/api/ai/tavily", { method: "POST", headers: { "content-type": "application/json", ...(key ? { "x-dcm-tavily-key": key } : {}) }, body: JSON.stringify(body) }))

describe("/api/ai/tavily: which key the web searches use, and its credits", () => {
  let tavilyCalls: { url: string; auth: string }[]
  beforeEach(() => {
    tavilyCalls = []
    vi.stubEnv("TAVILY_API_KEY", "tvly-app-key-0123456789")
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const auth = String((init?.headers as Record<string, string>)?.authorization ?? "")
        tavilyCalls.push({ url: String(input), auth })
        if (auth.includes("revoked")) return new Response("{}", { status: 401 })
        return new Response(JSON.stringify({ key: { usage: 3, limit: null }, account: { current_plan: "Researcher", plan_usage: 12, plan_limit: 1000 } }), { status: 200 })
      }),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("says which key without calling Tavily", async () => {
    expect(await (await call({})).json()).toEqual({ source: "built-in" })
    expect(await (await call({}, "tvly-dev-mykey0123456789")).json()).toEqual({ source: "own" })
    vi.stubEnv("TAVILY_API_KEY", "")
    expect(await (await call({})).json()).toEqual({ source: "none" })
    expect(tavilyCalls).toHaveLength(0)
  })

  it("check: the credits used this month (Tavily's usage call, no credit)", async () => {
    const res = await call({ check: true }, "tvly-dev-mykey0123456789")
    expect(await res.json()).toEqual({ source: "own", used: 12, limit: 1000, plan: "Researcher" })
    expect(tavilyCalls).toEqual([{ url: "https://api.tavily.com/usage", auth: "Bearer tvly-dev-mykey0123456789" }])
  })

  it("refuses a key that isn't a Tavily key, and says when Tavily rejects one", async () => {
    const bad = await call({ check: true }, "gsk_notatavilykey12345")
    expect(bad.status).toBe(400)
    expect((await bad.json()).error).toMatch(/doesn't look like a Tavily key/)
    const revoked = await call({ check: true }, "tvly-revoked-0123456789")
    expect(revoked.status).toBe(400)
    expect((await revoked.json()).error).toMatch(/key was rejected/)
  })

  it("needs a signed-in user", async () => {
    vi.mocked(getRequestUser).mockResolvedValueOnce({ user: null } as never)
    expect((await call({ check: true })).status).toBe(401)
  })
})
