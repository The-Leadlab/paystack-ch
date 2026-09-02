import { useWorkspace } from "./WorkspaceContext";
import { useClientSessionAccess } from "./ClientSessionAccessContext";

/** Workspace role + shared-login client session (primary / viewer / contributor). */
export function useDataWriteAccess(): boolean {
  const { canWrite } = useWorkspace();
  const { canMutateData } = useClientSessionAccess();
  return canWrite && canMutateData;
}
