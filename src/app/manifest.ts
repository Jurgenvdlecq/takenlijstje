import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Takenlijstje – huishoudplanner",
    short_name: "Takenlijstje",
    description: "Huishoudelijke taken eenvoudig plannen, verdelen en afvinken.",
    lang: "nl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf9f6",
    theme_color: "#4f46e5",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Vandaag", url: "/" },
      { name: "Boodschappen", url: "/boodschappen" },
    ],
  };
}
