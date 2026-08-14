import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * The card every auth page sits in.
 *
 * The shared `Card` is tuned for the dense admin tables — a 16px gutter that
 * looks cramped once a card is the only thing on the screen. `--card-spacing`
 * is raised here rather than on `Card` itself so the admin surfaces keep their
 * density, and the shadow is given an explicit colour per theme: the default
 * `ring-foreground/10` alone leaves the card edge almost invisible against the
 * near-black dark background.
 */
export function AuthCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card
      className={cn(
        "w-full [--card-spacing:--spacing(6)] rounded-2xl shadow-lg shadow-black/5 ring-foreground/10 dark:shadow-black/40 dark:ring-white/10",
        className,
      )}
    >
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Icon disc, heading and explanation — the top of every "something went
 * wrong" auth page. `tone` picks the semantic colour pair; both are token
 * pairs that were contrast-checked in `globals.css`, so the icon stays
 * legible on the tinted disc in either theme.
 */
export function AuthCardHeading({
  icon: Icon,
  title,
  children,
  tone = "destructive",
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
  tone?: "destructive" | "warning";
}) {
  return (
    <div className="space-y-4">
      <span
        className={cn(
          "flex size-11 items-center justify-center rounded-xl",
          tone === "warning" ? "bg-warning/15 text-warning" : "bg-destructive/12 text-destructive",
        )}
      >
        <Icon className="size-5.5" aria-hidden />
      </span>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          {title}
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}
