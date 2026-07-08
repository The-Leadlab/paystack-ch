import { verifyFirebaseAuthorizationHeader } from "./verifyFirebaseIdToken.js";

export type GoogleServicesResult = {
  status: number;
  json: Record<string, unknown>;
};

export async function startGoogleDriveOAuth(
  authorization: string | undefined
): Promise<GoogleServicesResult> {
  try {
    await verifyFirebaseAuthorizationHeader(authorization);
  } catch (error) {
    const status = (error as { status?: number }).status || 401;
    return { status, json: { error: (error as Error).message } };
  }

  throw new Error("startGoogleDriveOAuth: OAuth redirect not yet implemented");
}
