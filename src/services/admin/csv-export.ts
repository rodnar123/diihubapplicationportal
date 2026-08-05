import "server-only";

import { richTextToPlainText } from "@/domain/rich-text";
import { SDG_LABELS, YEAR_LEVEL_LABELS } from "@/domain/challenge/constants";
import { APPLICATION_STATUS_META } from "@/domain/application/status";
import { prisma } from "@/lib/db/prisma";
import { applicationInclude, toApplicationDto } from "@/services/application/mappers";

/**
 * CSV export of the applications a reviewer is currently looking at.
 *
 * Narrative answers are flattened to plain text — a spreadsheet cell cannot
 * render markup, and leaving HTML in would make the file unreadable in Excel.
 */

/**
 * Escapes one field.
 *
 * The leading apostrophe on values starting with `=`, `+`, `-` or `@` defuses
 * CSV formula injection: without it, a student could type `=HYPERLINK(...)`
 * into a free-text answer and have Excel execute it when an administrator
 * opens the export.
 */
function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;

  // Newlines are legal inside a quoted CSV field, but they make the file hard
  // to scan; collapse them.
  text = text.replace(/\r?\n/g, " ").replace(/\s{2,}/g, " ").trim();

  return `"${text.replace(/"/g, '""')}"`;
}

const COLUMNS = [
  "Reference",
  "Status",
  "Challenge Year",
  "Team Name",
  "Team Leader",
  "Leader Student ID",
  "Contact Email",
  "Leader Phone",
  "Supervisor",
  "Team Size",
  "Members",
  "Applicant Name",
  "Applicant Email",
  "Applicant Student ID",
  "School",
  "Section",
  "Programme",
  "Year Level",
  "Project Title",
  "Theme",
  "SDG Alignment",
  "Problem Statement",
  "Tech-Driven Solution",
  "Innovation",
  "Objectives",
  "Target Users",
  "Prototype Type",
  "Prototype Features",
  "Development Tools",
  "Alternatives",
  "Justification",
  "Value Proposition",
  "Implementation Plan",
  "Expected Impact",
  "Timeline",
  "Sustainability",
  "Budget (PGK)",
  "Attachments",
  "Declaration Method",
  "Declared By",
  "Declared On",
  "Submitted At",
  "Reviewed At",
  "Reviewer",
  "Decision Note",
  "Revisions",
] as const;

export async function buildApplicationsCsv(applicationIds: string[]): Promise<string> {
  if (applicationIds.length === 0) {
    return `${COLUMNS.join(",")}\n`;
  }

  const records = await prisma.application.findMany({
    where: { id: { in: applicationIds } },
    include: {
      ...applicationInclude,
      owner: {
        select: {
          name: true,
          email: true,
          studentProfile: { select: { studentId: true } },
        },
      },
      school: { select: { name: true } },
      section: { select: { name: true } },
      reviewedBy: { select: { name: true } },
    },
  });

  const sections = await prisma.section.findMany({ select: { id: true, name: true } });
  const sectionNames = new Map(sections.map((section) => [section.id, section.name]));

  // Preserve the order the caller asked for; `findMany` does not guarantee it.
  const byId = new Map(records.map((record) => [record.id, record]));
  const ordered = applicationIds
    .map((id) => byId.get(id))
    .filter((record): record is (typeof records)[number] => Boolean(record));

  const lines = [COLUMNS.join(",")];

  for (const record of ordered) {
    const application = toApplicationDto(record);
    const team = application.team;
    const declaration = application.declaration;

    const members = (team?.members ?? [])
      .map((member) => {
        const sectionName =
          (member.sectionId ? sectionNames.get(member.sectionId) : null) ??
          member.sectionLabel ??
          "";
        return `${member.studentId} ${member.firstName} ${member.surname}${
          sectionName ? ` (${sectionName})` : ""
        }${member.role ? ` — ${member.role}` : ""}`;
      })
      .join(" | ");

    lines.push(
      [
        csvCell(application.referenceNumber),
        csvCell(APPLICATION_STATUS_META[application.status].label),
        csvCell(application.challengeYear),
        csvCell(team?.name),
        csvCell(team?.leaderName),
        csvCell(team?.leaderStudentId),
        csvCell(team?.leaderEmail),
        csvCell(team?.leaderPhone),
        csvCell(team?.supervisorName),
        csvCell(team?.members.length ?? 0),
        csvCell(members),
        csvCell(record.owner.name),
        csvCell(record.owner.email),
        csvCell(record.owner.studentProfile?.studentId),
        csvCell(record.school?.name),
        csvCell(record.section?.name),
        csvCell(application.program),
        csvCell(application.yearLevel ? YEAR_LEVEL_LABELS[application.yearLevel] : null),
        csvCell(application.projectTitle),
        csvCell(application.theme),
        csvCell(application.sdgAlignment.map((code) => SDG_LABELS[code] ?? code).join("; ")),
        csvCell(richTextToPlainText(application.problemStatement)),
        csvCell(richTextToPlainText(application.proposedSolution)),
        csvCell(richTextToPlainText(application.innovation)),
        csvCell(richTextToPlainText(application.objectives)),
        csvCell(richTextToPlainText(application.targetUsers)),
        csvCell(application.prototypeType),
        csvCell(richTextToPlainText(application.prototypeFeatures)),
        csvCell(richTextToPlainText(application.developmentTools)),
        csvCell(richTextToPlainText(application.alternatives)),
        csvCell(richTextToPlainText(application.justification)),
        csvCell(richTextToPlainText(application.valueProposition)),
        csvCell(richTextToPlainText(application.implementationPlan)),
        csvCell(richTextToPlainText(application.expectedImpact)),
        csvCell(richTextToPlainText(application.timeline)),
        csvCell(richTextToPlainText(application.sustainability)),
        csvCell(application.budgetAmount ?? ""),
        csvCell(application.attachments.map((file) => file.fileName).join(" | ")),
        csvCell(
          declaration
            ? declaration.mode === "ELECTRONIC"
              ? "Electronic"
              : "Signed upload"
            : "",
        ),
        csvCell(declaration?.signatoryName),
        csvCell(declaration?.signedAt ? declaration.signedAt.slice(0, 10) : ""),
        csvCell(application.submittedAt ?? ""),
        csvCell(application.reviewedAt ?? ""),
        csvCell(record.reviewedBy?.name),
        csvCell(application.decisionNote),
        csvCell(application.revisionCount),
      ].join(","),
    );
  }

  // BOM so Excel opens UTF-8 correctly — student names contain characters that
  // would otherwise mojibake.
  return `﻿${lines.join("\n")}\n`;
}
