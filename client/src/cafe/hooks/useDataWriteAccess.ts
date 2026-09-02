import { useWorkspace } from "../context/WorkspaceContext";
import { useClientSessionAccess } from "../context/ClientSessionAccessContext";

/** Workspace role + shared-login client session (primary / viewer / contributor). */
export function useDataWriteAccess(): boolean {
  const { canWrite } = useWorkspace();
  const { canMutateData } = useClientSessionAccess();
  return canWrite && canMutateData;
}
