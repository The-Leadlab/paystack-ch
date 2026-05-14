/**
 * Local Stripe API only (port 8787). Run alongside Vite: `npm run dev:stripe-server`
 * Vite proxies /api/stripe → this server when STRIPE_DEV_PROXY=1 (see vite.config.ts).
 */
import express from "express";
import { registerStripeIfConfigured } from "./stripe";

const app = express();
registerStripeIfConfigured(app);

const port = parseInt(process.env.STRIPE_DEV_PORT || "8787", 10);
app.listen(port, "127.0.0.1", () => {
  console.log(
    `[stripe-dev] http://127.0.0.1:${port}  (live: /api/stripe/* ; test: /api/stripe-test/* when STRIPE_TEST_SECRET_KEY is set)`
  );
});
