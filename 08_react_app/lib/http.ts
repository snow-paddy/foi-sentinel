/** Shared route helpers for permission-gated write endpoints. */

/** True when an error is a permission denial thrown by the query layer. */
export function isForbidden(e: unknown): boolean {
  return Boolean(e && typeof e === "object" && (e as { code?: string }).code === "FORBIDDEN")
}

/**
 * Standard catch handler for gated write routes: FORBIDDEN -> 403, else 500.
 * `label` is used for the server log line and the generic 500 message.
 */
export function errorResponse(e: unknown, label: string): Response {
  if (isForbidden(e)) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "Not permitted", forbidden: true },
      { status: 403 },
    )
  }
  console.error(`${label} error:`, e)
  return Response.json({ ok: false, error: `${label} failed` }, { status: 500 })
}
