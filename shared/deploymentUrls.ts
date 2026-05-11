/**
 * Canonical production deployment URLs (Vercel preview + prod, custom domain, Firebase Hosting).
 * Import `DEPLOYMENT_URLS` from `@shared/const` or `@shared/deploymentUrls`.
 */
export const DEPLOYMENT_URLS = {
  vercelPreview: "https://paystack-9yn8l7gk5-the-lead-lab.vercel.app",
  vercelProduction: "https://paystack-ch.vercel.app",
  wwwCustom: "https://www.paystack.ch",
  // Firebase Hosting (project paystack-ch)
  firebaseHosting: {
    webApp: "https://paystack-ch.web.app",
    firebaseApp: "https://paystack-ch.firebaseapp.com",
  },
  // Firebase config `authDomain` (hostname only)
  firebaseAuthDomain: "paystack-ch.firebaseapp.com",
} as const;
