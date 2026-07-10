import type { VercelRequest, VercelResponse } from "@vercel/node";
import { completeGoogleDriveOAuth } from "../../../lib/googleServices.js";
import { publicAppOriginFromHeaders } from "../../../lib/stripeCore.js";
import {
  googleDriveCallbackRedirect,
  resolveGoogleDriveErrorReason,
} from "../../../shared/googleDriveErrors.js";

function redirect(res: VercelResponse, location: string): void {
  res.writeHead(303, { Location: location });
  res.end();
}

// Hit by a top-level browser navigation from Google, not a fetch() — no Authorization header
// is available here. The requesting user's identity comes from the signed `state` param instead.
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const origin = publicAppOriginFromHeaders(req.headers as Record<string, string | string[] | undefined>);
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const oauthError = typeof req.query.error === "string" ? req.query.error : "";

  if (oauthError) {
    const reason = resolveGoogleDriveErrorReason(oauthError);
    redirect(res, googleDriveCallbackRedirect(origin, false, reason));
    return;
  }

  if (!code || !state) {
    redirect(res, googleDriveCallbackRedirect(origin, false, "unknown"));
    return;
  }

  try {
    const out = await completeGoogleDriveOAuth(code, state);
    if (out.status !== 200) {
      const errMsg = "json" in out && typeof out.json.error === "string" ? out.json.error : "unknown";
      console.error("[api] google drive callback failed:", out.status, errMsg);
      const reason = resolveGoogleDriveErrorReason(errMsg);
      redirect(res, googleDriveCallbackRedirect(origin, false, reason));
      return;
    }
    redirect(res, googleDriveCallbackRedirect(origin, true));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[api] google drive callback:", errMsg);
    redirect(res, googleDriveCallbackRedirect(origin, false, resolveGoogleDriveErrorReason(errMsg)));
  }
}
