import { isInventoryAllowedForUser } from "@shared/inventoryAccess";
import { useAuth } from "../context/AuthContext";
import { useUkUat } from "../context/UkUatContext";

function readInventoryEnvEmails(): string[] {
  const raw = (import.meta.env.VITE_INVENTORY_EMAILS as string | undefined) || "";
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Full inventory unlock (interactive stock).
 * Nav stays visible for everyone; locked users see Coming Soon teaser.
 *
 * Unlocks: Ali / Damien / Louise allowlist, `/admin-uk` (GBP), optional env emails,
 * or VITE_INVENTORY_ENABLED=true.
 */
export function useInventoryAllowed(): boolean {
  const { user } = useAuth();
  const { ukUatActive } = useUkUat();
  const envEnabled = String(import.meta.env.VITE_INVENTORY_ENABLED || "").toLowerCase() === "true";
  return isInventoryAllowedForUser(user?.email, {
    ukUatActive,
    envEnabled,
    extraEmails: readInventoryEnvEmails(),
  });
}
