import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  completeHmrcOAuth,
  decodeHmrcOAuthState,
  hmrcCallbackRedirect,
} from "../../../lib/hmrcMtd.js";
import { publicAppOriginFromHeaders } from "../../../lib/stripeCore.js";

function redirect(res: VercelResponse, location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

// Browser navigation from HMRC — identity comes from signed `state`, not Authorization.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = publicAppOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";

  let returnPath = "/admin-uk";
  if (state) {
    try {
      returnPath = decodeHmrcOAuthState(state).returnPath || "/admin-uk";
    } catch {
      // Fall through; completeHmrcOAuth will reject invalid state.
    }
  }

  if (oauthError) {
    redirect(res, hmrcCallbackRedirect(origin, false, oauthError, returnPath));
    return;
  }

  if (!code || !state) {
    redirect(res, hmrcCallbackRedirect(origin, false, "unknown", returnPath));
    return;
  }

  try {
    const out = await completeHmrcOAuth(code, state);
    if (out.status !== 200) {
      const errMsg = "json" in out && typeof out.json.error === "string" ? out.json.error : "unknown";
      console.error("[api] hmrc oauth callback failed:", out.status, errMsg);
      redirect(res, hmrcCallbackRedirect(origin, false, errMsg, returnPath));
      return;
    }
    redirect(res, hmrcCallbackRedirect(origin, true, undefined, returnPath));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[api] hmrc oauth callback:", errMsg);
    redirect(res, hmrcCallbackRedirect(origin, false, errMsg, returnPath));
  }
}
