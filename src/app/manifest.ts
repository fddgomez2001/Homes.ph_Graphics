import type { MetadataRoute } from "next"
import { IS_WEBSITE } from "@/lib/env"

/** Lets Edge/Chrome install the app as its own desktop window ("Install this site as an app"). */
export default function manifest(): MetadataRoute.Manifest {
  if (IS_WEBSITE) {
    return {
      name: "Homes.ph Carousels",
      short_name: "Carousels",
      description: "Homes.ph carousels ready to post.",
      start_url: "/site",
      display: "standalone",
      background_color: "#F6F7FA",
      theme_color: "#0F4C81",
      icons: [{ src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" }],
    }
  }
  return {
    name: "Daily Carousel Maker · Homes.ph",
    short_name: "Carousel Maker",
    description: "Plan, design and export Homes.ph social media carousels.",
    start_url: "/home",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#0F4C81",
    icons: [{ src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png" }],
  }
}
