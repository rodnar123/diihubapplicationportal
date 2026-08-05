import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import type {
  ApplicantDto,
  ApplicationDto,
  AttachmentDto,
  CommentDto,
  DeclarationDto,
  StatusEventDto,
  TeamDto,
} from "@/domain/application/types";

/**
 * Prisma row → serialisable DTO.
 *
 * Every read path funnels through here so that `Decimal` and `Date` are
 * converted in exactly one place; a Server Component that forgot to would fail
 * only at runtime, and only for the applications that happen to have a budget.
 */

export const applicationInclude = {
  team: {
    include: {
      members: {
        where: { deletedAt: null },
        orderBy: [{ isLeader: "desc" }, { sortOrder: "asc" }],
      },
    },
  },
  declaration: { include: { signedDocument: true } },
  attachments: {
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ApplicationInclude;

export type ApplicationWithRelations = Prisma.ApplicationGetPayload<{
  include: typeof applicationInclude;
}>;

function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export function toAttachmentDto(
  attachment: ApplicationWithRelations["attachments"][number],
): AttachmentDto {
  return {
    id: attachment.id,
    kind: attachment.kind,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
  };
}

export function toTeamDto(team: NonNullable<ApplicationWithRelations["team"]>): TeamDto {
  return {
    id: team.id,
    name: team.name,
    leaderName: team.leaderName,
    leaderStudentId: team.leaderStudentId,
    leaderEmail: team.leaderEmail,
    leaderPhone: team.leaderPhone,
    supervisorName: team.supervisorName,
    supervisorEmail: team.supervisorEmail,
    members: team.members.map((member) => ({
      id: member.id,
      studentId: member.studentId,
      firstName: member.firstName,
      surname: member.surname,
      sectionId: member.sectionId,
      sectionLabel: member.sectionLabel,
      role: member.role,
      email: member.email,
      phone: member.phone,
      isLeader: member.isLeader,
      sortOrder: member.sortOrder,
    })),
  };
}

export function toDeclarationDto(
  declaration: NonNullable<ApplicationWithRelations["declaration"]>,
): DeclarationDto {
  return {
    id: declaration.id,
    mode: declaration.mode,
    accepted: declaration.accepted,
    signatoryName: declaration.signatoryName,
    signedAt: toIso(declaration.signedAt),
    signedDocumentId: declaration.signedDocumentId,
    signedDocumentName: declaration.signedDocument?.fileName ?? null,
  };
}

export function toApplicationDto(application: ApplicationWithRelations): ApplicationDto {
  return {
    id: application.id,
    referenceNumber: application.referenceNumber,
    status: application.status,
    challengeYear: application.challengeYear,

    applicantPhone: application.applicantPhone,
    schoolId: application.schoolId,
    sectionId: application.sectionId,
    program: application.program,
    yearLevel: application.yearLevel,

    projectTitle: application.projectTitle,
    theme: application.theme,
    sdgAlignment: application.sdgAlignment,
    problemStatement: application.problemStatement,
    proposedSolution: application.proposedSolution,
    innovation: application.innovation,
    objectives: application.objectives,
    targetUsers: application.targetUsers,

    prototypeType: application.prototypeType,
    prototypeFeatures: application.prototypeFeatures,
    developmentTools: application.developmentTools,

    alternatives: application.alternatives,
    justification: application.justification,

    valueProposition: application.valueProposition,
    implementationPlan: application.implementationPlan,
    expectedImpact: application.expectedImpact,
    sustainability: application.sustainability,
    timeline: application.timeline,
    budgetAmount:
      application.budgetAmount === null ? null : Number(application.budgetAmount.toString()),
    budgetNotes: application.budgetNotes,

    submittedAt: toIso(application.submittedAt),
    reviewedAt: toIso(application.reviewedAt),
    decisionNote: application.decisionNote,
    revisionCount: application.revisionCount,
    createdAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),

    team: application.team ? toTeamDto(application.team) : null,
    declaration: application.declaration ? toDeclarationDto(application.declaration) : null,
    attachments: application.attachments.map(toAttachmentDto),
  };
}

export function toApplicantDto(owner: {
  id: string;
  name: string;
  email: string;
  studentProfile: { studentId: string; firstName: string; surname: string } | null;
}): ApplicantDto {
  return {
    userId: owner.id,
    fullName: owner.name,
    email: owner.email,
    studentId: owner.studentProfile?.studentId ?? "",
    firstName: owner.studentProfile?.firstName ?? "",
    surname: owner.studentProfile?.surname ?? "",
  };
}

export function toStatusEventDto(event: {
  id: string;
  fromStatus: StatusEventDto["fromStatus"];
  toStatus: StatusEventDto["toStatus"];
  note: string | null;
  createdAt: Date;
  actor: { name: string } | null;
}): StatusEventDto {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    note: event.note,
    actorName: event.actor?.name ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}

export function toCommentDto(comment: {
  id: string;
  body: string;
  visibility: CommentDto["visibility"];
  createdAt: Date;
  author: { name: string; role: string };
}): CommentDto {
  return {
    id: comment.id,
    body: comment.body,
    visibility: comment.visibility,
    authorName: comment.author.name,
    authorRole: comment.author.role,
    createdAt: comment.createdAt.toISOString(),
  };
}
