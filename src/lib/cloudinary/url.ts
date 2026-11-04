/**
 * Cloudinary delivery helpers (browser-safe: no credentials involved).
 * Transformed variants are for UI previews ONLY. Editing and export always use
 * the untouched original `secure_url`.
 */
export function cloudinaryPreviewUrl(secureUrl: string, width = 480): string {
  if (!secureUrl.includes("/image/upload/")) return secureUrl
  return secureUrl.replace("/image/upload/", `/image/upload/c_limit,w_${width},q_auto,f_auto/`)
}
