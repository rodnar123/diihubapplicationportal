import { ApplicationStatus, DeclarationMode } from "@/generated/prisma/enums";

import type { ApplicationDto, ApplicationWithApplicant } from "./types";

/**
 * A blank application, built in memory for the staff preview of the student
 * portal.
 *
 * Nothing here touches the database. That is the whole point: opening the
 * student form the ordinary way calls `getOrCreateDraft`, which inserts a real
 * `applications` row and an audit entry — a reviewer who simply wanted to read
 * the questions would show up in the submission counts, the applications list
 * and the CSV and PDF exports. This gives the same components something to
 * render without any of that.
 *
 * Every answer is deliberately empty. The preview exists to show the *form* —
 * its questions, help text, field order and validation copy — so sample answers
 * would only get in the way of reading it.
 */

/** Marks the synthetic entry everywhere an id is expected. */
export const PREVIEW_APPLICATION_ID = "preview";

export function buildPreviewApplication(challengeYear: number): ApplicationDto {
  // Fixed rather than `new Date()`: these feed "last saved" style captions, and
  // a value that moves on every render is a hydration mismatch waiting to
  // happen. The epoch would render as 1970, so the year in view is used.
  const timestamp = new Date(Date.UTC(challengeYear, 0, 1)).toISOString();

  return {
    id: PREVIEW_APPLICATION_ID,
    referenceNumber: null,
    status: ApplicationStatus.DRAFT,
    challengeYear,

    applicantPhone: null,
    schoolId: null,
    sectionId: null,
    program: null,
    yearLevel: null,

    projectTitle: null,
    theme: null,
    sdgAlignment: [],
    problemStatement: null,
    proposedSolution: null,
    innovation: null,
    objectives: null,
    targetUsers: null,

    prototypeType: null,
    prototypeFeatures: null,
    developmentTools: null,

    alternatives: null,
    justification: null,

    valueProposition: null,
    implementationPlan: null,
    expectedImpact: null,
    sustainability: null,
    timeline: null,
    budgetAmount: null,
    budgetNotes: null,

    submittedAt: null,
    reviewedAt: null,
    decisionNote: null,
    revisionCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,

    team: {
      id: PREVIEW_APPLICATION_ID,
      name: "",
      leaderName: "",
      leaderStudentId: "",
      leaderEmail: "",
      leaderPhone: null,
      supervisorName: null,
      supervisorEmail: null,
      members: [],
    },
    declaration: {
      id: PREVIEW_APPLICATION_ID,
      mode: DeclarationMode.ELECTRONIC,
      accepted: false,
      signatoryName: null,
      signedAt: null,
      signedDocumentId: null,
      signedDocumentName: null,
    },
    attachments: [],
  };
}

/**
 * The blank entry plus the placeholder applicant it belongs to.
 *
 * The applicant is *not* the signed-in reviewer. Section A is prefilled from
 * the owner's student profile, and a reviewer has none; showing staff details
 * in a student's fields would misrepresent what an applicant actually sees.
 */
export function buildPreviewApplicationWithApplicant(
  challengeYear: number,
): ApplicationWithApplicant {
  return {
    application: buildPreviewApplication(challengeYear),
    applicant: {
      userId: PREVIEW_APPLICATION_ID,
      fullName: "",
      email: "",
      studentId: "",
      firstName: "",
      surname: "",
    },
  };
}
