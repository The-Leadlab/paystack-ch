import { useState } from "react";
import type { LandingScreenKey } from "@/const/landingScreens";
import { LANDING_SCREENSHOTS } from "@/const/landingScreens";

type Props = {
  screen: LandingScreenKey;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

/** Tries `public/landing/` first, then legacy CDN path if the file is not present locally. */
export function LandingScreenshot({ screen, alt, className, loading = "lazy" }: Props) {
  const { primary, fallback } = LANDING_SCREENSHOTS[screen];
  const [src, setSrc] = useState(primary);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}
