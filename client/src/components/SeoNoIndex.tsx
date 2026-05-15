import { useEffect } from "react";

/** Prevent indexing of sensitive routes (also use `public/robots.txt`). */
export function SeoNoIndex() {
  useEffect(() => {
    let el = document.querySelector('meta[name="robots"][data-paystack-admin]') as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement("meta");
      el.name = "robots";
      el.content = "noindex, nofollow";
      el.setAttribute("data-paystack-admin", "1");
      document.head.appendChild(el);
    }
    return () => {
      el?.remove();
    };
  }, []);
  return null;
}
