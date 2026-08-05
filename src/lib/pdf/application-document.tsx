import { Document, Page, Text, View } from "@react-pdf/renderer";

import {
  Crest,
  Field,
  LongField,
  GridCell,
  PageFooter,
  SectionHeading,
  SignatureLine,
} from "@/lib/pdf/pdf-primitives";
import { pdfStyles } from "@/lib/pdf/pdf-styles";
import { APPLICATION_STATUS_META } from "@/domain/application/status";
import {
  CHALLENGE_HOST,
  CHALLENGE_NAME,
  REQUIRED_ALTERNATIVE_COUNT,
  SDG_LABELS,
  UNIVERSITY_NAME,
  YEAR_LEVEL_LABELS,
} from "@/domain/challenge/constants";
import { AttachmentKind, DeclarationMode } from "@/generated/prisma/enums";
import type { ApplicantDto, ApplicationDto } from "@/domain/application/types";

/**
 * The official application form, reproduced as a PDF.
 *
 * Section order and wording follow the printed
 * "DiiHub BizTech Challenge – Application Form" so a reviewer holding the
 * paper version and this export is reading the same document.
 */

export interface ApplicationPdfData {
  application: ApplicationDto;
  applicant: ApplicantDto;
  schoolName: string | null;
  sectionName: string | null;
  sectionNameById: Record<string, string>;
  /** Rendered in the footer, e.g. "Generated 5 August 2026". */
  generatedAt: Date;
}

function formatDate(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatKina(amount: number | null): string | null {
  if (amount === null) return null;
  return `K${amount.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * One application's pages, without the surrounding `<Document>`.
 *
 * Split out so a bulk export can put many applications into a single
 * print-ready file rather than producing a folder of separate PDFs — which is
 * what a review panel actually wants when they print a batch for a meeting.
 */
export function ApplicationPages({
  application,
  applicant,
  schoolName,
  sectionName,
  sectionNameById,
  generatedAt,
}: ApplicationPdfData) {
  const team = application.team;
  const declaration = application.declaration;
  const statusMeta = APPLICATION_STATUS_META[application.status];

  const supportingFiles = application.attachments.filter(
    (attachment) => attachment.kind !== AttachmentKind.SIGNED_DECLARATION,
  );

  const reference =
    application.referenceNumber ?? `Draft — ${team?.name || applicant.fullName}`;

  const declarationText = `We hereby declare that this proposal and prototype are original works of our team and submitted for the ${CHALLENGE_HOST}, ${CHALLENGE_NAME} ${application.challengeYear}.`;

  return (
    <>
      <Page size="A4" style={pdfStyles.page}>
        {/* A draft must never be mistaken for a lodged entry. */}
        {!application.referenceNumber && <Text style={pdfStyles.watermark} fixed>DRAFT</Text>}

        <View style={pdfStyles.masthead} fixed>
          <Crest />
          <View style={pdfStyles.mastheadText}>
            <Text style={pdfStyles.university}>{UNIVERSITY_NAME}</Text>
            <Text style={pdfStyles.host}>{CHALLENGE_HOST}</Text>
          </View>
        </View>

        <Text style={pdfStyles.formTitle}>
          {CHALLENGE_NAME} {application.challengeYear} — Application Form
        </Text>

        <View style={pdfStyles.referenceStrip}>
          <View style={pdfStyles.referenceCell}>
            <Text style={pdfStyles.referenceLabel}>Reference</Text>
            <Text style={pdfStyles.referenceValue}>{application.referenceNumber ?? "—"}</Text>
          </View>
          <View style={pdfStyles.referenceCell}>
            <Text style={pdfStyles.referenceLabel}>Status</Text>
            <Text style={pdfStyles.referenceValue}>{statusMeta.label}</Text>
          </View>
          <View style={pdfStyles.referenceCell}>
            <Text style={pdfStyles.referenceLabel}>Submitted</Text>
            <Text style={pdfStyles.referenceValue}>
              {formatDate(application.submittedAt) ?? "Not submitted"}
            </Text>
          </View>
        </View>

        {/* --- Applicant ---------------------------------------------------- */}
        <View style={pdfStyles.section}>
          <SectionHeading>Section A — Applicant</SectionHeading>
          <View style={pdfStyles.grid}>
            <GridCell label="Full name" value={applicant.fullName} />
            <GridCell label="Student ID" value={applicant.studentId} />
            <GridCell label="Email" value={applicant.email} />
            <GridCell label="Phone" value={application.applicantPhone} />
            <GridCell label="School" value={schoolName} />
            <GridCell label="Section" value={sectionName} />
            <GridCell label="Programme of study" value={application.program} />
            <GridCell
              label="Year level"
              value={application.yearLevel ? YEAR_LEVEL_LABELS[application.yearLevel] : null}
            />
          </View>
        </View>

        {/* --- Team --------------------------------------------------------- */}
        <View style={pdfStyles.section}>
          <SectionHeading>Section B — Team Information</SectionHeading>

          <View style={pdfStyles.grid}>
            <GridCell label="Team name" value={team?.name ?? null} />
            <GridCell label="Team leader's name" value={team?.leaderName ?? null} />
            <GridCell label="Contact email" value={team?.leaderEmail ?? null} />
            <GridCell label="Leader's phone" value={team?.leaderPhone ?? null} />
            <GridCell label="Supervisor" value={team?.supervisorName ?? null} />
            <GridCell label="Supervisor email" value={team?.supervisorEmail ?? null} />
          </View>

          <Text style={[pdfStyles.fieldLabel, { marginTop: 4, marginBottom: 4 }]}>
            Team Members (Student IDs, Names, Section &amp; Roles)
          </Text>

          <View style={pdfStyles.table}>
            <View style={pdfStyles.tableHeaderRow}>
              <Text style={[pdfStyles.th, pdfStyles.colIndex]}>#</Text>
              <Text style={[pdfStyles.th, pdfStyles.colStudentId]}>Student ID</Text>
              <Text style={[pdfStyles.th, pdfStyles.colName]}>First Name</Text>
              <Text style={[pdfStyles.th, pdfStyles.colName]}>Surname</Text>
              <Text style={[pdfStyles.th, pdfStyles.colSection]}>Section</Text>
              <Text style={[pdfStyles.th, pdfStyles.colRole, { borderRightWidth: 0 }]}>Role</Text>
            </View>

            {(team?.members ?? []).map((member, index, all) => {
              const rowStyle =
                index === all.length - 1 ? pdfStyles.tableRowLast : pdfStyles.tableRow;

              const memberSection =
                (member.sectionId ? sectionNameById[member.sectionId] : null) ??
                member.sectionLabel ??
                "—";

              return (
                <View key={member.id} style={rowStyle} wrap={false}>
                  <Text style={[pdfStyles.td, pdfStyles.colIndex]}>{index + 1}</Text>
                  <Text style={[pdfStyles.td, pdfStyles.colStudentId]}>{member.studentId}</Text>
                  <Text style={[pdfStyles.td, pdfStyles.colName]}>{member.firstName}</Text>
                  <Text style={[pdfStyles.td, pdfStyles.colName]}>{member.surname}</Text>
                  <Text style={[pdfStyles.td, pdfStyles.colSection]}>{memberSection}</Text>
                  <Text style={[pdfStyles.td, pdfStyles.colRole, { borderRightWidth: 0 }]}>
                    {member.isLeader ? `${member.role || "Team Leader"} (Leader)` : member.role || "—"}
                  </Text>
                </View>
              );
            })}

            {(team?.members.length ?? 0) === 0 && (
              <View style={pdfStyles.tableRowLast}>
                <Text style={[pdfStyles.td, { width: "100%", borderRightWidth: 0 }]}>
                  No team members recorded.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* --- Venture ------------------------------------------------------ */}
        <View style={pdfStyles.section}>
          <SectionHeading>Section C — Venture (Project)</SectionHeading>

          <Field label="Proposed Venture / Project Title" value={application.projectTitle} />

          <View style={pdfStyles.grid}>
            <GridCell label="Theme" value={application.theme} half />
            <GridCell
              label="SDG alignment"
              value={
                application.sdgAlignment.length > 0
                  ? application.sdgAlignment.map((code) => SDG_LABELS[code] ?? code).join("; ")
                  : null
              }
              half
            />
          </View>

          <LongField
            label="Problem Statement"
            hint="The real-world challenge this solution addresses."
            html={application.problemStatement}
          />
          <LongField
            label="Tech-Driven Solution"
            hint="The innovative idea and how technology is applied."
            html={application.proposedSolution}
          />
          <LongField label="Innovation" html={application.innovation} />
          <LongField label="Objectives" html={application.objectives} />
          <LongField
            label="Target Users / Beneficiaries"
            hint="Who the target users or beneficiaries are."
            html={application.targetUsers}
          />
        </View>

        {/* --- Prototype ---------------------------------------------------- */}
        <View style={pdfStyles.section}>
          <SectionHeading>Section D — Prototype Details</SectionHeading>
          <Field
            label="Prototype Type"
            hint="Desktop, web app, mobile app, digital tool, etc."
            value={application.prototypeType}
          />
          <LongField
            label="Prototype Features"
            hint="The main functions the prototype demonstrates."
            html={application.prototypeFeatures}
          />
          <LongField
            label="Development Tools / Platforms"
            html={application.developmentTools}
          />
        </View>

        {/* --- Alternatives -------------------------------------------------- */}
        <View style={pdfStyles.section}>
          <SectionHeading>Section E — Alternative Solutions vs This Solution</SectionHeading>
          <LongField
            label="Alternatives"
            hint={`${REQUIRED_ALTERNATIVE_COUNT} existing solutions that may cater for the identified challenge.`}
            html={application.alternatives}
          />
          <LongField
            label="Justification"
            hint="Why this solution is preferred over the alternatives."
            html={application.justification}
          />
        </View>

        {/* --- Impact -------------------------------------------------------- */}
        <View style={pdfStyles.section}>
          <SectionHeading>Section F — Impact &amp; Feasibility</SectionHeading>
          <LongField
            label="Value Proposition"
            hint="How the solution improves lives, processes, or opportunities."
            html={application.valueProposition}
          />
          <LongField
            label="Implementation Plan"
            hint="Steps, resources and timeline for bringing the idea to life."
            html={application.implementationPlan}
          />
          <LongField label="Expected Impact" html={application.expectedImpact} />
          <LongField label="Timeline" html={application.timeline} />
          <LongField label="Sustainability" html={application.sustainability} />
          <Field label="Estimated Budget" value={formatKina(application.budgetAmount)} />
          {application.budgetNotes && (
            <LongField label="Budget Notes" html={application.budgetNotes} />
          )}
        </View>

        {/* --- Attachments --------------------------------------------------- */}
        <View style={pdfStyles.section} wrap={false}>
          <SectionHeading>Section G — Attachments</SectionHeading>
          {supportingFiles.length === 0 ? (
            <Text style={pdfStyles.empty}>No supporting documents were attached.</Text>
          ) : (
            <View style={pdfStyles.table}>
              <View style={pdfStyles.tableHeaderRow}>
                <Text style={[pdfStyles.th, { width: "8%" }]}>#</Text>
                <Text style={[pdfStyles.th, { width: "56%" }]}>File name</Text>
                <Text style={[pdfStyles.th, { width: "20%" }]}>Size</Text>
                <Text style={[pdfStyles.th, { width: "16%", borderRightWidth: 0 }]}>Uploaded</Text>
              </View>
              {supportingFiles.map((attachment, index, all) => (
                <View
                  key={attachment.id}
                  style={index === all.length - 1 ? pdfStyles.tableRowLast : pdfStyles.tableRow}
                >
                  <Text style={[pdfStyles.td, { width: "8%" }]}>{index + 1}</Text>
                  <Text style={[pdfStyles.td, { width: "56%" }]}>{attachment.fileName}</Text>
                  <Text style={[pdfStyles.td, { width: "20%" }]}>
                    {(attachment.sizeBytes / 1024).toFixed(0)} KB
                  </Text>
                  <Text style={[pdfStyles.td, { width: "16%", borderRightWidth: 0 }]}>
                    {new Date(attachment.createdAt).toLocaleDateString("en-AU")}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* --- Declaration --------------------------------------------------- */}
        <View style={pdfStyles.section} wrap={false}>
          <SectionHeading>Section H — Declaration</SectionHeading>

          <View style={pdfStyles.declarationBox}>
            <Text style={pdfStyles.declarationText}>{declarationText}</Text>

            {declaration?.mode === DeclarationMode.ELECTRONIC && declaration.accepted && (
              <Text style={pdfStyles.fieldHint}>
                Declared electronically by the team leader. Confirmation, date and originating
                device were recorded by the portal at the time of signing.
              </Text>
            )}

            {declaration?.mode === DeclarationMode.SIGNED_UPLOAD && (
              <Text style={pdfStyles.fieldHint}>
                A hand-signed declaration was uploaded with this application
                {declaration.signedDocumentName ? ` (${declaration.signedDocumentName})` : ""}.
              </Text>
            )}

            <View style={pdfStyles.signatureRow}>
              <SignatureLine
                caption="Team Leader Signature"
                value={
                  declaration?.mode === DeclarationMode.ELECTRONIC && declaration.accepted
                    ? declaration.signatoryName
                    : null
                }
              />
              <SignatureLine
                caption="Date"
                value={formatDate(declaration?.signedAt) ?? null}
              />
            </View>
          </View>
        </View>

        {/* --- Official use -------------------------------------------------- */}
        <View style={pdfStyles.section} wrap={false}>
          <View style={pdfStyles.officialBox}>
            <Text style={pdfStyles.officialHeading}>For official use only</Text>

            <View style={pdfStyles.grid}>
              <GridCell label="Decision" value={statusMeta.label} />
              <GridCell label="Decision date" value={formatDate(application.reviewedAt)} />
              <GridCell label="Revisions" value={String(application.revisionCount)} />
            </View>

            {application.decisionNote && (
              <Field label="Reviewer's note" value={application.decisionNote} />
            )}

            <View style={pdfStyles.signatureRow}>
              <SignatureLine caption="Reviewer Signature" />
              <SignatureLine caption="Date" />
            </View>
          </View>
        </View>

        <PageFooter
          reference={`${reference} · Generated ${formatDate(generatedAt)}`}
        />
      </Page>
    </>
  );
}

/** A single application, as its own PDF. */
export function ApplicationDocument(data: ApplicationPdfData) {
  const reference =
    data.application.referenceNumber ??
    `Draft — ${data.application.team?.name || data.applicant.fullName}`;

  return (
    <Document
      title={`${CHALLENGE_NAME} ${data.application.challengeYear} — ${reference}`}
      author={UNIVERSITY_NAME}
      subject={data.application.projectTitle ?? "Application form"}
      creator={`${UNIVERSITY_NAME} Student Challenge Portal`}
    >
      <ApplicationPages {...data} />
    </Document>
  );
}

/**
 * Many applications in one printable file, in the order the reviewer's list
 * was sorted.
 */
export function ApplicationBundleDocument({
  items,
  generatedAt,
}: {
  items: ApplicationPdfData[];
  generatedAt: Date;
}) {
  return (
    <Document
      title={`${CHALLENGE_NAME} — ${items.length} application${items.length === 1 ? "" : "s"}`}
      author={UNIVERSITY_NAME}
      subject="Bulk application export"
      creator={`${UNIVERSITY_NAME} Student Challenge Portal`}
    >
      {items.map((item) => (
        <ApplicationPages key={item.application.id} {...item} generatedAt={generatedAt} />
      ))}
    </Document>
  );
}
