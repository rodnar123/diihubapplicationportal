import type {
  ApplicationStatus,
  AttachmentKind,
  CommentVisibility,
  DeclarationMode,
  YearLevel,
} from "@/generated/prisma/enums";

/**
 * Serialisable view of an application.
 *
 * Prisma models cannot cross the server/client boundary as-is — `Decimal` and
 * `Date` do not survive serialisation — so every read path maps to these
 * shapes. They are also the contract the wizard forms are typed against.
 */

export interface TeamMemberDto {
  id: string;
  studentId: string;
  firstName: string;
  surname: string;
  sectionId: string | null;
  sectionLabel: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  isLeader: boolean;
  sortOrder: number;
}

export interface TeamDto {
  id: string;
  name: string;
  leaderName: string;
  leaderStudentId: string;
  leaderEmail: string;
  leaderPhone: string | null;
  supervisorName: string | null;
  supervisorEmail: string | null;
  members: TeamMemberDto[];
}

export interface AttachmentDto {
  id: string;
  kind: AttachmentKind;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface DeclarationDto {
  id: string;
  mode: DeclarationMode;
  accepted: boolean;
  signatoryName: string | null;
  signedAt: string | null;
  signedDocumentId: string | null;
  signedDocumentName: string | null;
}

export interface StatusEventDto {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  body: string;
  visibility: CommentVisibility;
  authorName: string;
  authorRole: string;
  createdAt: string;
}

export interface ApplicationDto {
  id: string;
  referenceNumber: string | null;
  status: ApplicationStatus;
  challengeYear: number;

  // Section A
  applicantPhone: string | null;
  schoolId: string | null;
  sectionId: string | null;
  program: string | null;
  yearLevel: YearLevel | null;

  // Venture
  projectTitle: string | null;
  theme: string | null;
  sdgAlignment: string[];
  problemStatement: string | null;
  proposedSolution: string | null;
  innovation: string | null;
  objectives: string | null;
  targetUsers: string | null;

  // Prototype
  prototypeType: string | null;
  prototypeFeatures: string | null;
  developmentTools: string | null;

  // Alternatives
  alternatives: string | null;
  justification: string | null;

  // Impact & feasibility
  valueProposition: string | null;
  implementationPlan: string | null;
  expectedImpact: string | null;
  sustainability: string | null;
  timeline: string | null;
  budgetAmount: number | null;
  budgetNotes: string | null;

  // Workflow
  submittedAt: string | null;
  reviewedAt: string | null;
  decisionNote: string | null;
  revisionCount: number;
  createdAt: string;
  updatedAt: string;

  team: TeamDto | null;
  declaration: DeclarationDto | null;
  attachments: AttachmentDto[];
}

/** The owner's identity, which lives on the user rather than the application. */
export interface ApplicantDto {
  userId: string;
  fullName: string;
  email: string;
  studentId: string;
  firstName: string;
  surname: string;
}

export interface ApplicationWithApplicant {
  application: ApplicationDto;
  applicant: ApplicantDto;
}
