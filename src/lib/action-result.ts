import 'server-only';

/**
 * Every Server Action's return type. A thrown error's message is
 * stripped by React once it crosses back into the render boundary in
 * a production build (`next build && next start`) — the client only
 * gets a generic "Server Components render" error with no message, by
 * design (see docs/phases/phase-7.md's "Finding carried forward to
 * Phase 8"). To show a real message for an expected failure (wrong
 * role, inactive tenant, bad input, ...), a Server Action must catch
 * it internally and return one of these instead of throwing.
 */
export type ActionResult<T = void> =
  { ok: true; data: T } | { ok: false; error: string };

/**
 * Runs a Server Action's body, converting any thrown error into
 * `{ ok: false, error }` instead of letting it escape as a throw.
 * Internal helpers (requireRole, requireActiveTenant, validation
 * throws, zod parse errors, ...) are unchanged — only the exported
 * action function wraps its body in this.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Something went wrong',
    };
  }
}
