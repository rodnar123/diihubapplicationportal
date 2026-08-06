import { type NextRequest } from "next/server";

import { signOut } from "@/auth";
import { getSessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";

export const runtime = "nodejs";

/**
 * POST-only so that a link prefetch, an image tag, or a cross-site request
 * cannot sign the user out. The sign-out control is a form, not an anchor.
 */
export async function POST(_request: NextRequest) {
  const user = await getSessionUser();

  if (user) {
    await recordAudit({
      action: AUDIT_ACTIONS.signOut,
      entityType: "User",
      entityId: user.id,
      actorId: user.id,
      actorEmail: user.email,
    });
  }

  // Clears the session cookie and throws a redirect.
  await signOut({ redirectTo: ROUTES.home });
}
