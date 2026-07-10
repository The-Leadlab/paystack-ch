import type { VercelRequest, VercelResponse } from "@vercel/node";
import { completeGoogleDriveOAuth } from "../../../lib/googleServices.js";
import { publicAppOriginFromHeaders } from "../../../lib/stripeCore.js";

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

  if (!code || !state) {
    redirect(res, `${origin}/app?googleDrive=error`);
    return;
  }

  try {
    const out = await completeGoogleDriveOAuth(code, state);
    if (out.status !== 200) {
      console.error("[api] google drive callback failed:", out.status, "json" in out ? out.json : out);
    }
    redirect(res, `${origin}/app?googleDrive=${out.status === 200 ? "connected" : "error"}`);
  } catch (error) {
    console.error("[api] google drive callback:", error instanceof Error ? error.message : String(error));
    redirect(res, `${origin}/app?googleDrive=error`);
  }
}
