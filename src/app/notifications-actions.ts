"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseOrThrow, runAction } from "@/lib/action-helpers";
import { requireUserForAction } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { markNotificationsRead } from "@/services/notifications/notification-service";

/**
 * Marks in-app notifications as read. Scoped to the caller inside the service,
 * so an id belonging to someone else simply matches nothing.
 */
export async function markNotificationsReadAction(ids?: string[]) {
  return runAction(async () => {
    const user = await requireUserForAction();

    const parsed = parseOrThrow(z.array(z.string().min(1)).max(100).optional(), ids);
    const count = await markNotificationsRead(user.id, parsed);

    revalidatePath(ROUTES.dashboard);
    revalidatePath(ROUTES.admin);

    return { count };
  });
}
