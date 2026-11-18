import { describe, expect, it } from "vitest"
import { blobCredentials } from "@/lib/desktop-release"

describe("download page: reaching the private Blob store", () => {
  it("uses a read-write token when there is one", () => {
    expect(blobCredentials({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_abc_123", BLOB_STORE_ID: "store_abc" })).toEqual({ token: "vercel_blob_rw_abc_123" })
  })

  it("otherwise the store id of a store connected the new way (Vercel signs the calls)", () => {
    expect(blobCredentials({ BLOB_STORE_ID: "store_abc", BLOB_WEBHOOK_PUBLIC_KEY: "x" })).toEqual({ storeId: "store_abc" })
  })

  it("finds the variables when the store was connected with its own prefix", () => {
    expect(blobCredentials({ BLOB_READ_WRITE_TOKEN_STORE_ID: "store_abc", BLOB_READ_WRITE_TOKEN_WEBHOOK_PUBLIC_KEY: "x" })).toEqual({ storeId: "store_abc" })
    expect(blobCredentials({ BLOB_READ_WRITE_TOKEN_STORE_ID: "store_abc", BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN: "vercel_blob_rw_abc_1" })).toEqual({ token: "vercel_blob_rw_abc_1" })
    expect(blobCredentials({ BLOB_HOMES_STORE_ID: " store_xyz " })).toEqual({ storeId: "store_xyz" })
  })

  it("is not set up without a store", () => {
    expect(blobCredentials({})).toBeNull()
    expect(blobCredentials({ BLOB_READ_WRITE_TOKEN: "  ", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })).toBeNull()
  })
})
