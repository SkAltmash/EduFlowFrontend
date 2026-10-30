import type { MetadataRoute } from "next";

/** Lets EduFlow be installed as an app (home screen, Start menu, dock). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "EduFlow — School management",
    short_name: "EduFlow",
    description: "Attendance, fees, tests and parents on WhatsApp, for schools and tuition centres.",
    start_url: "/app/dashboard?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8f8f6",
    theme_color: "#2b3a8c",
    lang: "en-IN",
    categories: ["education", "productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon for these
    shortcuts: [
      { name: "Mark attendance", url: "/app/attendance", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Collect fee", url: "/app/fees?collect=new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Students", url: "/app/students", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
