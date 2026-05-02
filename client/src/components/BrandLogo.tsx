import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { BRAND_LOGO_SRC } from "@/const/branding";

type BrandLogoProps = {
  /** If set, wraps logo + optional wordmark in a wouter Link */
  href?: string;
  showWordmark?: boolean;
  /** Tailwind img height (controls visual weight across nav vs sidebar) */
  markClassName?: string;
  wordmarkClassName?: string;
  className?: string;
};

/**
 * Single Paystack asset across marketing + auth (+ optional reuse in app shell).
 */
export function BrandLogo({
  href = "/",
  showWordmark = true,
  markClassName = "h-10 w-auto md:h-12 object-contain shrink-0",
  wordmarkClassName = "font-display font-semibold text-xl md:text-2xl tracking-tight text-foreground",
  className,
}: BrandLogoProps) {
  const inner = (
    <>
      <img
        src={BRAND_LOGO_SRC}
        alt="Paystack.ch"
        className={markClassName}
        loading="eager"
        decoding="async"
      />
      {showWordmark ? (
        <span className={wordmarkClassName}>
          paystack<span className="text-brand-red">.ch</span>
        </span>
      ) : null}
    </>
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
