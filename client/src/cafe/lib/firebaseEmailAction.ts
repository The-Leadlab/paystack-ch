import type { ActionCodeSettings } from "firebase/auth";
import { isProductionPaystackHost } from "@shared/paystackHosts";

/** Where Firebase email links (verify email, etc.) should land — must be an authorized domain. */
export function firebaseAuthActionUrl(path = "/auth/action"): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  }
  return `https://www.paystack.ch/auth/action`;
}

export function emailVerificationActionCodeSettings(): ActionCodeSettings {
  return {
    url: firebaseAuthActionUrl("/auth/action"),
    handleCodeInApp: true,
  };
}

export function isFirebaseHostingAuthDomain(): boolean {
  if (typeof window === "undefined") return false;
  return /firebaseapp\.com$/i.test(window.location.hostname);
}

export function productionSiteHomeUrl(): string {
  if (typeof window !== "undefined" && isProductionPaystackHost(window.location.hostname)) {
    return `${window.location.origin.replace(/\/+$/, "")}/`;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin.replace(/\/+$/, "")}/`;
  }
  return "https://www.paystack.ch/";
}
