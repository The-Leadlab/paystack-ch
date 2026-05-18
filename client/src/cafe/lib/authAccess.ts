import type { User as FirebaseUser } from 'firebase/auth';
import { isSubscriptionBypassEmail } from './subscriptionBypass';

export const AUTH_ERR_REGISTRATION_CLOSED = 'auth/registration-closed';
export const AUTH_ERR_GOOGLE_NEW_USER = 'auth/google-new-user-blocked';

export function isPaidRegistrationEnforced(): boolean {
  const v = import.meta.env.VITE_SUBSCRIPTION_ENABLED;
  return String(v || '').toLowerCase() === 'true' || v === '1';
}

export type AuthAccessOptions = {
  /** First sign-in after Stripe Checkout (sign-up page with session_id). */
  allowNewUserFromCheckout?: boolean;
  /** Operator admin page — caller enforces bypass email separately. */
  skipRegistrationGate?: boolean;
};

/**
 * When subscription enforcement is on, only existing Firebase accounts may use public sign-in.
 * New accounts are allowed only right after paid Checkout (sign-up + session_id).
 */
export function checkPublicAuthAccess(
  user: FirebaseUser,
  opts: AuthAccessOptions & { isNewUser: boolean }
): string | null {
  if (opts.skipRegistrationGate) return null;
  if (!isPaidRegistrationEnforced()) return null;
  if (isSubscriptionBypassEmail(user.email)) return null;

  if (opts.isNewUser) {
    if (opts.allowNewUserFromCheckout) return null;
    return AUTH_ERR_GOOGLE_NEW_USER;
  }

  return null;
}

export function canOpenPublicSignUp(allowFromCheckout: boolean): boolean {
  if (!isPaidRegistrationEnforced()) return true;
  return allowFromCheckout;
}

export function formatAuthAccessError(err: Error | null, t: (key: string) => string): string {
  if (!err) return '';
  if (err.message === AUTH_ERR_REGISTRATION_CLOSED) return t('authErrRegistrationClosed');
  if (err.message === AUTH_ERR_GOOGLE_NEW_USER) return t('authErrGoogleNewUser');
  return err.message;
}
