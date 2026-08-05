import {
  CheckCircle2,
  CircleDashed,
  CircleDot,
  FileEdit,
  RotateCcw,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { APPLICATION_STATUS_META, STATUS_TONE_CLASSES } from "@/domain/application/status";
import type { ApplicationStatus } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const STATUS_ICONS: Record<ApplicationStatus, LucideIcon> = {
  DRAFT: FileEdit,
  SUBMITTED: CircleDot,
  UNDER_REVIEW: CircleDashed,
  REVISION_REQUESTED: RotateCcw,
  APPROVED: CheckCircle2,
  REJECTED: XCircle,
  WITHDRAWN: XCircle,
};

/**
 * Status is conveyed by icon *and* label, not colour alone (WCAG 1.4.1).
 */
export function StatusBadge({
  status,
  className,
  showIcon = true,
}: {
  status: ApplicationStatus;
  className?: string;
  showIcon?: boolean;
}) {
  const meta = APPLICATION_STATUS_META[status];
  const Icon = STATUS_ICONS[status];

  return (
    <Badge
      variant="outline"
      className={cn("gap-1.5 font-medium", STATUS_TONE_CLASSES[meta.tone], className)}
    >
      {showIcon && <Icon className="size-3.5" aria-hidden />}
      {meta.label}
    </Badge>
  );
}
