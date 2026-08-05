import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/**
 * Sign-out is a POST form rather than a link: a GET endpoint could be
 * triggered by a prefetch, an `<img>` tag, or a cross-site request.
 */
export function SignOutButton({
  className,
  variant = "ghost",
  size = "default",
  label = "Sign out",
}: {
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
}) {
  return (
    <form action={ROUTES.signOut} method="post" className={cn("contents", className)}>
      <Button type="submit" variant={variant} size={size} className={className}>
        <LogOut className="size-4" aria-hidden />
        {label}
      </Button>
    </form>
  );
}
