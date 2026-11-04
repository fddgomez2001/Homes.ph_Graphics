import { afterEach, describe, expect, it, vi } from "vitest"

async function load(mobile: boolean) {
  vi.resetModules()
  vi.stubEnv("NEXT_PUBLIC_MOBILE_APP", mobile ? "1" : "")
  return import("@/lib/routes")
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("loginHref", () => {
  it("sends the desktop app and website to /login, keeping where to go next", async () => {
    const { loginHref, HOME_PATH } = await load(false)
    expect(loginHref()).toBe("/login")
    expect(loginHref({ next: "/site?show=posted", error: "Expired" })).toBe("/login?next=%2Fsite%3Fshow%3Dposted&error=Expired")
    expect(HOME_PATH).toBe("/home")
  })

  it("keeps the phone app on its one page (it shows sign-in itself)", async () => {
    const { loginHref, HOME_PATH } = await load(true)
    expect(loginHref()).toBe("/")
    expect(loginHref({ next: "/?tab=news", error: "Expired" })).toBe("/?error=Expired")
    expect(HOME_PATH).toBe("/")
  })
})
