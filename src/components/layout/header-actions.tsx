import { CommandPalette } from "@/components/layout/command-palette";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { NavGroup } from "@/components/layout/nav-config";
import { Role } from "@/generated/prisma/enums";
import type { SessionUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/routes";
import { getUnreadNotifications } from "@/services/notifications/notification-service";

/**
 * The right-hand side of the app header: command palette and notifications.
 *
 * A server component so the unread count comes from the same render as the
 * page, without a client-side fetch on every navigation.
 */
export async function HeaderActions({
  user,
  navigation,
}: {
  user: SessionUser;
  navigation: NavGroup[];
}) {
  const notifications = await getUnreadNotifications(user.id);

  return (
    <>
      <CommandPalette groups={navigation} isAdmin={user.role === Role.ADMIN} />
      <NotificationBell
        detailHref={user.role === Role.STUDENT ? ROUTES.dashboard : ROUTES.admin}
        notifications={notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          applicationId: notification.applicationId,
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
