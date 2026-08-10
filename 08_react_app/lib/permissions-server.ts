/**
 * Server-side permission gate. Resolves the acting officer from the cookie and
 * throws PermissionError when their persona may not perform the action. Kept
 * separate from lib/permissions.ts (which is pure/client-safe) because this
 * imports server-only modules.
 */
import { readActingOfficer } from "@/lib/actor"
import { can, ACTION_LABEL, PermissionError, type Action } from "@/lib/permissions"

/** Call at the top of a gated write. No-op when no officer is selected. */
export async function assertCan(action: Action): Promise<void> {
  const actor = await readActingOfficer()
  if (!actor) return // no simulated identity selected → allow (pre-feature behaviour)
  if (can(actor.persona, action)) return
  throw new PermissionError(
    `Not permitted: ${actor.persona || actor.name} cannot ${ACTION_LABEL[action]}.`,
  )
}
