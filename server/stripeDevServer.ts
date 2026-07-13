/**
 * Local Stripe API only (port 8787). Run alongside Vite: `npm run dev:stripe-server`
 * Vite proxies /api/stripe → this server when STRIPE_DEV_PROXY=1 (see vite.config.ts).
 */
import express from "express";
import { loadWorkspaceEnv } from "./loadEnv.js";
import { registerStripeIfConfigured } from "./stripe";

loadWorkspaceEnv();
import { registerGeminiRoutes } from "./gemini";
import { registerAliLabRoutes } from "./aliLab";
import { registerGoogleDriveRoutes } from "./googleDrive";
import { registerAdminRoutes } from "./adminUsers";

const app = express();
registerStripeIfConfigured(app);
registerGeminiRoutes(app);
registerAliLabRoutes(app);
registerGoogleDriveRoutes(app);
registerAdminRoutes(app);

const port = parseInt(process.env.STRIPE_DEV_PORT || "8787", 10);
app.listen(port, "127.0.0.1", () => {
  console.log(
    `[stripe-dev] http://127.0.0.1:${port}  (stripe: /api/stripe/* ; gemini: /api/gemini/generate ; oauth: /api/oauth/google/* ; test stripe when STRIPE_TEST_SECRET_KEY is set)`
  );
});
