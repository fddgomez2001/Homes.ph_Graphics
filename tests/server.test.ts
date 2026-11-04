import { describe, expect, it } from "vitest"
import { signParams } from "@/lib/cloudinary/server"
import { cloudinaryPreviewUrl } from "@/lib/cloudinary/url"
import { combineDateTime, moveToDay, toTimeInput } from "@/lib/dates"
import { checkImageFile, detectImageType } from "@/lib/image-validation"

describe("image validation (magic bytes)", () => {
  it("detects PNG, JPEG and WebP from content, not names", () => {
    expect(detectImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.format).toBe("png")
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))?.format).toBe("jpg")
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")
    expect(detectImageType(webp)?.format).toBe("webp")
    expect(detectImageType(new TextEncoder().encode("<svg xmlns=..."))).toBeNull()
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull()
  })

  it("rejects unsupported, empty and oversized files before upload", () => {
    expect(checkImageFile({ name: "a.png", type: "image/png", size: 1000 })).toBeNull()
    expect(checkImageFile({ name: "a.gif", type: "image/gif", size: 1000 })).toMatch(/supported/)
    expect(checkImageFile({ name: "a.jpg", type: "image/jpeg", size: 0 })).toMatch(/empty/)
    expect(checkImageFile({ name: "a.jpg", type: "image/jpeg", size: 30 * 1024 * 1024 })).toMatch(/limit/)
  })
})

describe("Cloudinary", () => {
  it("signs parameters the way Cloudinary documents (sorted, joined, SHA-1 with secret)", () => {
    // Example from Cloudinary's "Generating authentication signatures" documentation.
    const signature = signParams(
      { eager: "w_400,h_300,c_pad|w_260,h_200,c_crop", public_id: "sample_image", timestamp: 1315060510 },
      "abcd",
    )
    expect(signature).toBe("bfd09f95f331f558cbd1320e67aa8d488770583e")
  })

  it("only uses transformed URLs for previews, leaving originals untouched", () => {
    const original = "https://res.cloudinary.com/demo/image/upload/v1/homes/u/abc.png"
    expect(cloudinaryPreviewUrl(original, 300)).toBe("https://res.cloudinary.com/demo/image/upload/c_limit,w_300,q_auto,f_auto/v1/homes/u/abc.png")
    expect(cloudinaryPreviewUrl("blob:http://x/1")).toBe("blob:http://x/1")
  })
})

describe("scheduling dates", () => {
  it("combines a local date and time, and keeps time of day when rescheduling", () => {
    const iso = combineDateTime("2026-11-05", "14:30")!
    expect(toTimeInput(iso)).toBe("14:30")
    const moved = moveToDay(iso, new Date(2026, 10, 9))
    expect(new Date(moved).getDate()).toBe(9)
    expect(toTimeInput(moved)).toBe("14:30")
    expect(combineDateTime("", "10:00")).toBeNull()
  })
})

describe("pasted image links (server download guard)", async () => {
  const { checkRemoteUrl, isPublicAddress } = await import("@/lib/remote-image")

  it("only allows public internet addresses", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.9", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "0:0:0:0:0:ffff:a00:1"]) {
      expect(isPublicAddress(ip), ip).toBe(false)
    }
    for (const ip of ["8.8.8.8", "104.16.0.1", "2606:4700::1111", "::ffff:8.8.8.8"]) expect(isPublicAddress(ip), ip).toBe(true)
    expect(isPublicAddress("not-an-ip")).toBe(false)
  })

  it("rejects links that could reach this computer or the local network", () => {
    for (const url of [
      "ftp://example.com/a.png",
      "file:///C:/Windows/win.ini",
      "http://localhost/a.png",
      "http://app.localhost/a.png",
      "http://127.0.0.1:3939/api/health",
      "http://2130706433/a.png",
      "http://[::1]/a.png",
      "http://192.168.1.10/a.png",
      "https://user:pass@example.com/a.png",
      "https://example.com:8443/a.png",
      "not a url",
    ]) {
      expect(() => checkRemoteUrl(url), url).toThrow()
    }
    expect(checkRemoteUrl("https://res.cloudinary.com/demo/image/upload/sample.jpg").hostname).toBe("res.cloudinary.com")
  })
})
