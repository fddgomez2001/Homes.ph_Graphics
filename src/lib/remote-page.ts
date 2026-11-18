import "server-only"

import type http from "node:http"
import zlib from "node:zlib"
import { RemoteImageError, checkRemoteUrl, guardedGet } from "@/lib/remote-image"

/** A web page downloaded for its article text. */
export interface RemotePage {
  html: string
  /** Where it ended up after redirects. */
  url: string
}

const HEADERS = {
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
  "accept-language": "en-US,en;q=0.9",
  "accept-encoding": "gzip, deflate, br",
  // A normal browser identity (some news sites turn away unknown clients), with ours at the end.
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 HomesPhPosterMaker/1.0",
}

function decompress(res: http.IncomingMessage): NodeJS.ReadableStream {
  const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase()
  if (encoding.includes("br")) return res.pipe(zlib.createBrotliDecompress())
  if (encoding.includes("gzip")) return res.pipe(zlib.createGunzip())
  if (encoding.includes("deflate")) return res.pipe(zlib.createInflate())
  return res
}

/** The page's character set: from the header, else a <meta charset>, else UTF-8. */
function decode(bytes: Buffer, contentType: string): string {
  const head = bytes.subarray(0, 4096).toString("latin1")
  const label =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? "utf-8"
  try {
    return new TextDecoder(label.toLowerCase(), { fatal: false }).decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

/**
 * Downloads a web page (an article link pasted in the Poster Maker). Public internet
 * only (every address checked, also after redirects), at most 5 redirects, a size limit
 * and a timeout; it must be an HTML page.
 */
export async function downloadWebPage(
  raw: string,
  { maxBytes = 5 * 1024 * 1024, timeoutMs = 15_000, maxRedirects = 5 }: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number } = {},
): Promise<RemotePage> {
  const signal = AbortSignal.timeout(timeoutMs)
  let url = checkRemoteUrl(raw, "link")
  try {
    for (let hop = 0; ; hop++) {
      const res = await guardedGet(url, signal, HEADERS)
      const status = res.statusCode ?? 0
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        if (hop >= maxRedirects) throw new RemoteImageError("That link redirects too many times.")
        url = checkRemoteUrl(new URL(res.headers.location, url), "link")
        continue
      }
      if (status === 401 || status === 403) {
        res.resume()
        throw new RemoteImageError("That website doesn't let apps read its pages (it may need a sign-in). Copy the article and paste it instead.", 422)
      }
      if (status < 200 || status >= 300) {
        res.resume()
        throw new RemoteImageError(`The website answered with an error (${status}).`, 502)
      }
      const contentType = String(res.headers["content-type"] ?? "")
      if (contentType && !/html|xml/i.test(contentType)) {
        res.resume()
        throw new RemoteImageError("That link isn't a web page (it may be a PDF or a file). Copy the article and paste it instead.", 415)
      }
      const chunks: Buffer[] = []
      let total = 0
      for await (const chunk of decompress(res) as AsyncIterable<Buffer>) {
        total += chunk.length
        if (total > maxBytes) {
          res.destroy()
          throw new RemoteImageError("That page is too large to read.", 413)
        }
        chunks.push(chunk)
      }
      return { html: decode(Buffer.concat(chunks), contentType), url: url.toString() }
    }
  } catch (error) {
    if (error instanceof RemoteImageError) throw error
    if (signal.aborted) throw new RemoteImageError("The website took too long to answer.", 504)
    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof RemoteImageError) throw cause
    throw new RemoteImageError("Couldn't reach that website.", 502)
  }
}
