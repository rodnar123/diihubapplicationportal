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
  const isStudent = user.role === Role.STUDENT;

  /*
   * Staff get taken to the entry the notification is about. `applicationId`
   * was already being carried through to the bell and then dropped, so every
   * notification — five of them, about five different applications — landed
   * the reviewer on the same dashboard.
   *
   * A student has one entry and no per-application route of their own, so
   * their notifications still lead to the dashboard that shows it.
   */
  const hrefFor = (applicationId: string | null) => {
    if (isStudent) return ROUTES.dashboard;
    return applicationId ? ROUTES.adminApplication(applicationId) : ROUTES.admin;
  };

  return (
    <>
      <CommandPalette groups={navigation} isAdmin={user.role === Role.ADMIN} />
      <NotificationBell
        notifications={notifications.map((notification) => ({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          href: hrefFor(notification.applicationId),
          createdAt: notification.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
