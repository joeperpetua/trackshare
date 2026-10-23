import type { MetadataRoute } from "next";

// Lets people install TrackShare and pick it from the share sheet of a music app (Android, Chrome).
export default function manifest(): MetadataRoute.Manifest & {
  share_target: { action: string; method: "GET"; params: { title: string; text: string; url: string } };
} {
  return {
    name: "TrackShare",
    short_name: "TrackShare",
    description: "Make a square image from a music share link.",
    start_url: "/",
    display: "standalone",
    background_color: "#111013",
    theme_color: "#111013",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    share_target: {
      action: "/",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
