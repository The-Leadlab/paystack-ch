import { useSession } from "../context/SessionContext";
import { ClientSessionAccessProvider } from "../context/ClientSessionAccessContext";

export function SessionAccessShell({ children }: { children: React.ReactNode }) {
  const { currentSession } = useSession();
  return (
    <ClientSessionAccessProvider currentSessionId={currentSession?.id ?? null}>
      {children}
    </ClientSessionAccessProvider>
  );
}
