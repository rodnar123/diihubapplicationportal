import { ApplicationStatus, Role } from "@/generated/prisma/enums";

/**
 * The application lifecycle, expressed as data rather than scattered `if`
 * statements. Both the student and admin flows consult this module, so a
 * transition that is illegal here is illegal everywhere.
 */

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export interface StatusDescriptor {
  readonly label: string;
  readonly description: string;
  readonly tone: StatusTone;
  /** Can the owning team still edit the form? */
  readonly editableByStudent: boolean;
  /** Does this state count as "with the review panel"? */
  readonly withReviewer: boolean;
  /** Terminal states are not transitioned out of by the normal flow. */
  readonly terminal: boolean;
}

export const APPLICATION_STATUS_META: Record<ApplicationStatus, StatusDescriptor> = {
  DRAFT: {
    label: "Draft",
    description: "Not submitted yet. Only your team can see it.",
    tone: "neutral",
    editableByStudent: true,
    withReviewer: false,
    terminal: false,
  },
  SUBMITTED: {
    label: "Submitted",
    description: "Received by the challenge office and waiting to be picked up.",
    tone: "info",
    editableByStudent: false,
    withReviewer: true,
    terminal: false,
  },
  UNDER_REVIEW: {
    label: "Under Review",
    description: "A reviewer is assessing this application.",
    tone: "info",
    editableByStudent: false,
    withReviewer: true,
    terminal: false,
  },
  REVISION_REQUESTED: {
    label: "Revision Requested",
    description: "The panel asked for changes. Update the form and re-submit.",
    tone: "warning",
    editableByStudent: true,
    withReviewer: false,
    terminal: false,
  },
  APPROVED: {
    label: "Approved",
    description: "Accepted into the challenge.",
    tone: "success",
    editableByStudent: false,
    withReviewer: false,
    terminal: true,
  },
  REJECTED: {
    label: "Rejected",
    description: "Not accepted for this cycle.",
    tone: "danger",
    editableByStudent: false,
    withReviewer: false,
    terminal: true,
  },
  WITHDRAWN: {
    label: "Withdrawn",
    description: "Withdrawn by the team.",
    tone: "neutral",
    editableByStudent: false,
    withReviewer: false,
    terminal: true,
  },
};

/**
 * Allowed transitions, keyed by the role permitted to make them.
 *
 * Students only ever drive DRAFT → SUBMITTED (and the revision loop);
 * everything else belongs to the review panel.
 */
const STUDENT_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  DRAFT: ["SUBMITTED"],
  REVISION_REQUESTED: ["SUBMITTED"],
  SUBMITTED: ["WITHDRAWN"],
};

const REVIEWER_TRANSITIONS: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW", "REVISION_REQUESTED", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["REVISION_REQUESTED", "APPROVED", "REJECTED", "SUBMITTED"],
  REVISION_REQUESTED: ["UNDER_REVIEW", "REJECTED"],
  APPROVED: ["UNDER_REVIEW"],
  REJECTED: ["UNDER_REVIEW"],
};

export function allowedTransitions(from: ApplicationStatus, role: Role): ApplicationStatus[] {
  if (role === Role.STUDENT) return STUDENT_TRANSITIONS[from] ?? [];
  return REVIEWER_TRANSITIONS[from] ?? [];
}

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
  role: Role,
): boolean {
  return allowedTransitions(from, role).includes(to);
}

export function isEditableByStudent(status: ApplicationStatus): boolean {
  return APPLICATION_STATUS_META[status].editableByStudent;
}

/**
 * Statuses shown as filter chips in the admin console, in workflow order.
 */
export const STATUS_FILTER_ORDER: ApplicationStatus[] = [
  ApplicationStatus.DRAFT,
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.REVISION_REQUESTED,
  ApplicationStatus.APPROVED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

/**
 * Tailwind classes for the status badge, kept beside the metadata so a new
 * status cannot be added without deciding how it looks.
 */
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-info/30 bg-info/10 text-info",
  warning: "border-warning/40 bg-warning/15 text-warning-foreground dark:text-warning",
  success: "border-success/30 bg-success/10 text-success",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function statusLabel(status: ApplicationStatus): string {
  return APPLICATION_STATUS_META[status].label;
}
