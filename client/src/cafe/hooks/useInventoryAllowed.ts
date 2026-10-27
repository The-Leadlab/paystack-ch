import { isInventoryAllowedForUser } from "@shared/inventoryAccess";
import { useAuth } from "../context/AuthContext";

/**
 * Full inventory unlock (interactive stock) — Ali + Damien only.
 * Nav stays visible for everyone; locked users see Coming Soon teaser.
 */
export function useInventoryAllowed(): boolean {
  const { user } = useAuth();
  return isInventoryAllowedForUser(user?.email);
}
