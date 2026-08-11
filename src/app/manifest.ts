import type { MetadataRoute } from "next";

import { CHALLENGE_NAME, UNIVERSITY_SHORT_NAME } from "@/domain/challenge/constants";
import { APP_NAME } from "@/lib/env";

/**
 * The installable web-app descriptor, served at `/manifest.webmanifest`.
 *
 * It exists so a pinned or home-screen copy of the portal carries the crest and
 * the maroon chrome rather than a screenshot of the page with a default icon.
 * The colours are the first stop of `--gradient-brand` and the page background
 * from `globals.css`; the icons are the assets `npm run brand:icons` derives
 * from `public/logo.jfif`.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: UNIVERSITY_SHORT_NAME,
    description: `Apply to the ${CHALLENGE_NAME}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#fdfbfc",
    theme_color: "#5c0022",
    icons: [
      { src: "/icon.png", sizes: "256x256", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      // `maskable` lets Android crop to its own shape without clipping the
      // crest — the generated tile already carries the padding that needs.
      { src: "/icon.png", sizes: "256x256", type: "image/png", purpose: "maskable" },
    ],
  };
}
