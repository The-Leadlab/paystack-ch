/**
 * Standalone dashboard shell (Firebase auth + SPA data providers).
 * The main site mounts the same UI at `/app` via `App.tsx` inside `AuthProvider`.
 */
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import PlatformPage from "@/pages/PlatformPage";

export default function CafeApp() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <PlatformPage />
      </LanguageProvider>
    </AuthProvider>
  );
}
