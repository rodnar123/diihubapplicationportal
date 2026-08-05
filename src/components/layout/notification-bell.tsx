"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Bell, CheckCheck, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { markNotificationsReadAction } from "@/app/notifications-actions";

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  applicationId: string | null;
  createdAt: string;
}

/**
 * Unread in-app notifications.
 *
 * The count is rendered server-side and refreshed by revalidation rather than
 * polling — the events that produce a notification (a decision, a comment) are
 * infrequent enough that a background poll would be pure overhead.
 */
export function NotificationBell({
  notifications,
  detailHref,
}: {
  notifications: NotificationItem[];
  detailHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const unreadCount = notifications.length;

  const markAllRead = () => {
    startTransition(async () => {
      await markNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="size-4" aria-hidden />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-0.5 -right-0.5 size-4.5 justify-center rounded-full p-0 text-[10px] tabular-nums"
              variant="destructive"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
          <span className="sr-only">
            {unreadCount === 0
              ? "Notifications"
              : `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead} disabled={isPending}>
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              ) : (
                <CheckCheck className="size-3.5" aria-hidden />
              )}
              Mark all read
            </Button>
          )}
        </div>

        <Separator />

        {unreadCount === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            You&rsquo;re all caught up.
          </p>
        ) : (
          <ScrollArea className="max-h-80">
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={detailHref}
                    className="block px-4 py-3 transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="mt-0.5 text-pretty text-xs text-muted-foreground">
                      {notification.body}
                    </p>
                    <time
                      dateTime={notification.createdAt}
                      className="mt-1 block text-xs text-muted-foreground"
                    >
                      {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
