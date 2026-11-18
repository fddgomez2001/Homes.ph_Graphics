"use client"

import { useAssignment } from "@/lib/assignment"
import { HomeDashboard } from "./home-dashboard"
import { HomeGallery } from "./home-gallery"

/** Home: the carousels for people who make the carousel, else today's work on their pages. */
export function HomeSwitch() {
  const { assignment } = useAssignment()
  return assignment.carousel ? <HomeGallery /> : <HomeDashboard />
}
