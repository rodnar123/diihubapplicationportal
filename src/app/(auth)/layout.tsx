import Link from "next/link";

import { BrandLockup } from "@/components/brand/university-mark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { CHALLENGE_HOST, CHALLENGE_NAME } from "@/domain/challenge/constants";
import { ROUTES } from "@/lib/routes";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href={ROUTES.home}
          className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <BrandLockup />
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <p>
          {CHALLENGE_NAME} · {CHALLENGE_HOST}
        </p>
      </footer>
    </div>
  );
}
