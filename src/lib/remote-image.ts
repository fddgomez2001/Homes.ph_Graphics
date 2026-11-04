import "server-only"

import { lookup as dnsLookup, type LookupAddress } from "node:dns"
import http from "node:http"
import https from "node:https"
import { BlockList, isIP, type LookupFunction } from "node:net"
import { detectImageType, type DetectedImage } from "@/lib/image-validation"

/** Private, loopback, link-local and other non-internet ranges a pasted link may never reach. */
const blocked = new BlockList()
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4")
}
for (const [net, prefix] of [
  ["::", 127], // :: and ::1
  ["64:ff9b::", 96], // NAT64
  ["2002::", 16], // 6to4
  ["2001:db8::", 32],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6")
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (!family) return false
  if (family === 4) return !blocked.check(address, "ipv4")
  // IPv4-mapped IPv6 (::ffff:a.b.c.d): judge the IPv4 address inside. (BlockList also
  // checks plain IPv4 against IPv6 rules as mapped, so this can't be an IPv6 rule.)
  const canonical = new URL(`http://[${address}]`).hostname.slice(1, -1).toLowerCase()
  if (canonical.startsWith("::ffff:")) {
    const [hi, lo] = canonical.slice(7).split(":").map((h) => parseInt(h, 16))
    if (lo === undefined || Number.isNaN(hi) || Number.isNaN(lo)) return false
    return isPublicAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`)
  }
  return !blocked.check(canonical, "ipv6")
}

export class RemoteImageError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message)
  }
}

const BLOCKED_MESSAGE = "That link points to a private network address, so it can't be used."

/** DNS lookup that refuses private addresses. Runs at connect time, so redirects and DNS rebinding are covered too. */
const guardedLookup = ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err)
    const list = addresses as LookupAddress[]
    if (!list.length || list.some((a) => !isPublicAddress(a.address))) return callback(new RemoteImageError(BLOCKED_MESSAGE))
    if (options.all) callback(null, list)
    else callback(null, list[0].address, list[0].family)
  })
}) as unknown as LookupFunction

/** Checks a URL before any request is made. */
export function checkRemoteUrl(raw: string | URL): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new RemoteImageError("That isn't a valid image link.", 400)
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new RemoteImageError("Only http and https image links can be pasted.", 400)
  if (url.username || url.password) throw new RemoteImageError("Links with a username or password can't be used.", 400)
  if (url.port && url.port !== "80" && url.port !== "443") throw new RemoteImageError("That link uses an unusual port, so it can't be used.", 400)
  const host = url.hostname.replace(/^\[|\]$/g, "")
  // Literal IPs skip DNS, so check them here.
  if (isIP(host) && !isPublicAddress(host)) throw new RemoteImageError(BLOCKED_MESSAGE, 400)
  if (/^localhost$|\.localhost$|\.local$|\.internal$/i.test(host)) throw new RemoteImageError(BLOCKED_MESSAGE, 400)
  return url
}

function get(url: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  const client = url.protocol === "https:" ? https : http
  return new Promise((resolve, reject) => {
    const req = client.get(
      url,
      {
        lookup: guardedLookup,
        signal,
        headers: { accept: "image/png,image/jpeg,image/webp,image/*;q=0.8", "user-agent": "DailyCarouselMaker/1.0 (image paste)" },
      },
      resolve,
    )
    req.on("error", reject)
  })
}

/**
 * Downloads one image for the signed-in user's paste. Public internet only,
 * at most 3 redirects (each re-checked), a size limit and a timeout; the
 * bytes must really be a PNG, JPEG or WebP.
 */
export async function downloadRemoteImage(
  raw: string,
  { maxBytes, timeoutMs = 15_000, maxRedirects = 3 }: { maxBytes: number; timeoutMs?: number; maxRedirects?: number },
): Promise<{ bytes: Uint8Array; type: DetectedImage }> {
  const signal = AbortSignal.timeout(timeoutMs)
  let url = checkRemoteUrl(raw)
  try {
    for (let hop = 0; ; hop++) {
      const res = await get(url, signal)
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        if (hop >= maxRedirects) throw new RemoteImageError("That link redirects too many times.")
        url = checkRemoteUrl(new URL(res.headers.location, url))
        continue
      }
      if (status < 200 || status >= 300) {
        res.resume()
        throw new RemoteImageError(`The website answered with an error (${status}).`, 502)
      }
      const declared = Number(res.headers["content-length"] || 0)
      if (declared > maxBytes) {
        res.destroy()
        throw new RemoteImageError(`The image is larger than ${maxBytes / 1024 / 1024} MB.`, 413)
      }
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of res as AsyncIterable<Buffer>) {
        total += chunk.length
        if (total > maxBytes) {
          res.destroy()
          throw new RemoteImageError(`The image is larger than ${maxBytes / 1024 / 1024} MB.`, 413)
        }
        chunks.push(chunk)
      }
      const bytes = new Uint8Array(Buffer.concat(chunks))
      const type = detectImageType(bytes)
      if (!type) throw new RemoteImageError("That link isn't a JPG, PNG or WebP image.", 415)
      return { bytes, type }
    }
  } catch (error) {
    if (error instanceof RemoteImageError) throw error
    if (signal.aborted) throw new RemoteImageError("The website took too long to send the image.", 504)
    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof RemoteImageError) throw cause
    throw new RemoteImageError("Couldn't reach that website.", 502)
  }
}
