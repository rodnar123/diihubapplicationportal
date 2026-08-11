import { Eye } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * States plainly that nothing on the screen is real.
 *
 * Shown on every preview screen rather than only the first: the wizard is
 * navigable, and a reviewer who lands on step five from the progress rail needs
 * the same warning as one who started at step one. Without it the read-only
 * fields look like a student's entry that has simply not been filled in.
 */
export function PreviewBanner({ children }: { children?: React.ReactNode }) {
  return (
    <Alert>
      <Eye className="size-4" aria-hidden />
      <AlertTitle>Preview — this is not a real application</AlertTitle>
      <AlertDescription>
        {children ?? (
          <>
            You are seeing the student portal exactly as an applicant sees it, filled with a blank
            entry. Fields are read-only and nothing is saved — no application is created and none of
            this reaches the submission counts or the exports.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
