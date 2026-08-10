/**
 * The simulated "acting as" identity for the demo user-switcher.
 *
 * The app runs owner's rights (one SPCS identity), so there is no real per-user
 * login. Instead the operator picks who they are acting as from the existing
 * FOI_OFFICER roster; the choice is held in the `foi_acting_as` cookie as
 * {id,name,persona}. That cookie drives three things: attribution (via
 * currentActor), permission gating (via lib/permissions), and the "my cases"
 * filter — but NOT data visibility, which stays owner's-rights.
 */
import { cookies } from "next/headers"
import { querySnowflake } from "@/lib/snowflake"
import { SCHEMA } from "@/lib/constants"

export const ACTING_AS_COOKIE = "foi_acting_as"

export interface ActingOfficer {
  id: string
  name: string
  persona: string
}

export interface OfficerOption extends ActingOfficer {
  department: string
  initials: string
}

/** Read the acting officer from the cookie. Cheap, no DB — safe in hot paths. */
export async function readActingOfficer(): Promise<ActingOfficer | null> {
  try {
    const raw = (await cookies()).get(ACTING_AS_COOKIE)?.value
    if (!raw) return null
    const v = JSON.parse(raw) as Partial<ActingOfficer>
    if (!v?.name) return null
    return { id: String(v.id ?? ""), name: String(v.name), persona: String(v.persona ?? "") }
  } catch {
    return null
  }
}

/** Active officers, for the switcher and the Assign-to control. */
export async function listActiveOfficers(): Promise<OfficerOption[]> {
  const rows = await querySnowflake(`
    SELECT OFFICER_ID, NAME, PERSONA, DEPARTMENT, INITIALS
    FROM ${SCHEMA}.FOI_OFFICER
    WHERE IS_ACTIVE = TRUE
    ORDER BY PERSONA, NAME
  `)
  return rows.map((r) => ({
    id: String(r.OFFICER_ID ?? ""),
    name: String(r.NAME ?? ""),
    persona: String(r.PERSONA ?? ""),
    department: String(r.DEPARTMENT ?? ""),
    initials: String(r.INITIALS ?? ""),
  }))
}

/** Resolve one officer by id (used to validate a switcher selection). */
export async function getOfficerById(officerId: string): Promise<OfficerOption | null> {
  const all = await listActiveOfficers()
  return all.find((o) => o.id === officerId) ?? null
}
