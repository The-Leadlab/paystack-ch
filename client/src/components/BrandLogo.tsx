import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import {
  BRAND_LOCKUP_HEIGHT,
  BRAND_LOCKUP_WIDTH,
  BRAND_LOGO_SIZE,
  brandLockupSrc,
  brandMarkSrc,
} from "@/const/branding";

type BrandLogoProps = {
  /** If set to a non-empty string, wraps the logo in a wouter Link. Pass "" to render without a link. */
  href?: string;
  /**
   * When true (default), shows the full diamond-stack + PayStack.ch lockup image.
   * When false, shows the mark-only icon (favicon / compact headers).
   */
  showWordmark?: boolean;
  /** Tailwind img classes for mark or lockup */
  markClassName?: string;
  /** @deprecated Lockup is baked into the asset; kept for call-site compatibility */
  wordmarkClassName?: string;
  className?: string;
};

/**
 * Single Paystack asset across marketing + auth (+ optional reuse in app shell).
 * Lockup PNG already includes the wordmark — do not render a CSS duplicate.
 * Switches to the inverted on-dark artwork when the app theme is dark.
 */
export function BrandLogo({
  href = "/",
  showWordmark = true,
  markClassName = "h-10 w-auto md:h-12 object-contain shrink-0",
  className,
}: BrandLogoProps) {
  const { theme } = useTheme();
  const src = showWordmark ? brandLockupSrc(theme) : brandMarkSrc(theme);
  const width = showWordmark ? BRAND_LOCKUP_WIDTH : BRAND_LOGO_SIZE;
  const height = showWordmark ? BRAND_LOCKUP_HEIGHT : BRAND_LOGO_SIZE;

  const inner = (
    <img
      src={src}
      alt="Paystack.ch"
      width={width}
      height={height}
      className={cn("object-contain object-left", markClassName)}
      loading="eager"
      decoding="async"
    />
  );

  const combined = cn("flex items-center gap-3 group", className);

  if (href) {
    return (
      <Link href={href} className={combined}>
        {inner}
      </Link>
    );
  }

  return <div className={combined}>{inner}</div>;
}
