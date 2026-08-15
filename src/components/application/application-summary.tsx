import { Paperclip } from "lucide-react";

import { AttachmentList } from "@/components/application/attachment-list";
import { formatBytes } from "@/lib/format";
import { RichTextView } from "@/components/application/rich-text-view";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AttachmentKind, DeclarationMode } from "@/generated/prisma/enums";
import { SDG_LABELS, YEAR_LEVEL_LABELS } from "@/domain/challenge/constants";
import type { ApplicantDto, ApplicationDto } from "@/domain/application/types";

/**
 * The whole application, read-only.
 *
 * Shared by the student's review screen, the admin detail view and the print
 * layout so that all three show exactly the same content — a reviewer can
 * never be looking at a different set of answers from the applicant.
 */

function Section({
  title,
  formSection,
  children,
}: {
  title: string;
  formSection?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 break-inside-avoid">
      <div className="space-y-0.5">
        {formSection && (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {formSection}
          </p>
        )}
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Answer({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">{label}</h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="text-sm">{children}</div>
    </div>
  );
}

function PlainAnswer({ value }: { value: string | null | undefined }) {
  if (!value?.trim()) {
    return <p className="text-sm text-muted-foreground italic">Not provided</p>;
  }
  return <p className="text-sm">{value}</p>;
}

/**
 * Wrapping for values with no spaces to break on — email addresses, uploaded
 * file names.
 *
 * These were `truncate`d, which is unrecoverable: there is no hover on paper,
 * and this component is exactly what the print layout renders. A printed form
 * carried "25531000junior@student.pnguot.ac…" as the applicant's contact
 * address, and the attachment list lost the ends of its file names.
 *
 * `anywhere` rather than `break-all` so a value only breaks when it genuinely
 * will not fit, and so the cell's min-content width collapses instead of
 * overflowing its grid column.
 */
const WRAP_ANYWHERE = "[overflow-wrap:anywhere]";

export function ApplicationSummary({
  application,
  applicant,
  schoolName,
  sectionName,
  sectionNameById,
  allowDownload = false,
  showAttachments = true,
}: {
  application: ApplicationDto;
  applicant: ApplicantDto;
  schoolName: string | null;
  sectionName: string | null;
  sectionNameById: Record<string, string>;
  /**
   * Render attachments as interactive download links. Off for the print
   * layout, where a clickable list is meaningless on paper.
   *
   * A boolean rather than a URL-builder function: this is a Server Component,
   * and functions cannot be handed to the Client Component that renders the
   * list.
   */
  allowDownload?: boolean;
  showAttachments?: boolean;
}) {
  const team = application.team;
  const declaration = application.declaration;

  const supportingFiles = application.attachments.filter(
    (attachment) => attachment.kind !== AttachmentKind.SIGNED_DECLARATION,
  );
  const signedDeclarationFiles = application.attachments.filter(
    (attachment) => attachment.kind === AttachmentKind.SIGNED_DECLARATION,
  );

  const currency = new Intl.NumberFormat("en-PG", {
    style: "currency",
    currency: "PGK",
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-10">
      <Section title="Applicant" formSection="Section A">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Full name</dt>
            <dd className="mt-0.5 text-sm font-medium">{applicant.fullName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Student ID</dt>
            <dd className="mt-0.5 font-mono text-sm">{applicant.studentId || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">Email</dt>
            <dd className={`mt-0.5 text-sm ${WRAP_ANYWHERE}`}>{applicant.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Phone</dt>
            <dd className="mt-0.5 text-sm">{application.applicantPhone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">School</dt>
            <dd className="mt-0.5 text-sm">{schoolName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Section</dt>
            <dd className="mt-0.5 text-sm">{sectionName ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Programme</dt>
            <dd className="mt-0.5 text-sm">{application.program || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Year level</dt>
            <dd className="mt-0.5 text-sm">
              {application.yearLevel ? YEAR_LEVEL_LABELS[application.yearLevel] : "—"}
            </dd>
          </div>
        </dl>
      </Section>

      <Separator />

      <Section title="Team information" formSection="Section B">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Team name</dt>
            <dd className="mt-0.5 text-sm font-medium">{team?.name || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Team leader</dt>
            <dd className="mt-0.5 text-sm">{team?.leaderName || "—"}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium text-muted-foreground">Contact email</dt>
            <dd className={`mt-0.5 text-sm ${WRAP_ANYWHERE}`}>{team?.leaderEmail || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Leader&rsquo;s phone</dt>
            <dd className="mt-0.5 text-sm">{team?.leaderPhone || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted-foreground">Supervisor</dt>
            <dd className="mt-0.5 text-sm">{team?.supervisorName || "Not nominated"}</dd>
          </div>
          {team?.supervisorEmail && (
            <div className="min-w-0">
              <dt className="text-xs font-medium text-muted-foreground">Supervisor email</dt>
              <dd className={`mt-0.5 text-sm ${WRAP_ANYWHERE}`}>{team.supervisorEmail}</dd>
            </div>
          )}
        </dl>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full min-w-[40rem] text-sm">
            <caption className="sr-only">Team members</caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  #
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Student ID
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  First name
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Surname
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Section
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Role
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(team?.members ?? []).map((member, index) => (
                <tr key={member.id}>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2 font-mono">{member.studentId}</td>
                  <td className="px-3 py-2">{member.firstName}</td>
                  <td className="px-3 py-2">{member.surname}</td>
                  <td className="px-3 py-2">
                    {(member.sectionId ? sectionNameById[member.sectionId] : null) ??
                      member.sectionLabel ??
                      "—"}
                  </td>
                  <td className="px-3 py-2">
                    {member.role || "—"}
                    {member.isLeader && (
                      <Badge variant="secondary" className="ml-2">
                        Leader
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
              {(team?.members.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    No team members recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Separator />

      <Section title="Venture (project)" formSection="Section C">
        <Answer label="Proposed venture / project title">
          <PlainAnswer value={application.projectTitle} />
        </Answer>

        <div className="grid gap-4 sm:grid-cols-2">
          <Answer label="Theme">
            <PlainAnswer value={application.theme} />
          </Answer>

          <Answer label="SDG alignment">
            {application.sdgAlignment.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Not provided</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {application.sdgAlignment.map((code) => (
                  <li key={code}>
                    <Badge variant="outline">{SDG_LABELS[code] ?? code}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Answer>
        </div>

        <Answer label="Problem statement">
          <RichTextView html={application.problemStatement} />
        </Answer>
        <Answer label="Tech-driven solution">
          <RichTextView html={application.proposedSolution} />
        </Answer>
        <Answer label="Innovation">
          <RichTextView html={application.innovation} />
        </Answer>
        <Answer label="Objectives">
          <RichTextView html={application.objectives} />
        </Answer>
        <Answer label="Target users / beneficiaries">
          <RichTextView html={application.targetUsers} />
        </Answer>
      </Section>

      <Separator />

      <Section title="Prototype details" formSection="Section D">
        <Answer label="Prototype type">
          <PlainAnswer value={application.prototypeType} />
        </Answer>
        <Answer label="Prototype features">
          <RichTextView html={application.prototypeFeatures} />
        </Answer>
        <Answer label="Development tools / platforms">
          <RichTextView html={application.developmentTools} />
        </Answer>
      </Section>

      <Separator />

      <Section title="Alternative solutions vs this solution" formSection="Section E">
        <Answer label="Alternatives">
          <RichTextView html={application.alternatives} />
        </Answer>
        <Answer label="Justification">
          <RichTextView html={application.justification} />
        </Answer>
      </Section>

      <Separator />

      <Section title="Impact & feasibility" formSection="Section F">
        <Answer label="Value proposition">
          <RichTextView html={application.valueProposition} />
        </Answer>
        <Answer label="Implementation plan">
          <RichTextView html={application.implementationPlan} />
        </Answer>
        <Answer label="Expected impact">
          <RichTextView html={application.expectedImpact} />
        </Answer>
        <Answer label="Timeline">
          <RichTextView html={application.timeline} />
        </Answer>
        <Answer label="Sustainability">
          <RichTextView html={application.sustainability} emptyLabel="Not provided (optional)" />
        </Answer>
        <Answer label="Budget">
          {application.budgetAmount === null ? (
            <p className="text-sm text-muted-foreground italic">Not provided (optional)</p>
          ) : (
            <p className="text-sm font-medium tabular-nums">
              {currency.format(application.budgetAmount)}
            </p>
          )}
        </Answer>
        {application.budgetNotes && (
          <Answer label="Budget notes">
            <RichTextView html={application.budgetNotes} />
          </Answer>
        )}
      </Section>

      {showAttachments && (
        <>
          <Separator />

          <Section title="Attachments" formSection="Section G">
            {allowDownload ? (
              <AttachmentList attachments={supportingFiles} canDelete={false} />
            ) : supportingFiles.length === 0 ? (
              <EmptyState icon={Paperclip} title="No files uploaded" />
            ) : (
              <ul className="divide-y rounded-md border text-sm">
                {supportingFiles.map((attachment) => (
                  <li key={attachment.id} className="flex justify-between gap-4 px-3 py-2">
                    <span className={`min-w-0 ${WRAP_ANYWHERE}`}>{attachment.fileName}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {formatBytes(attachment.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </>
      )}

      <Separator />

      <Section title="Declaration" formSection="Section H">
        {!declaration ? (
          <p className="text-sm text-muted-foreground italic">Not completed</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Method</dt>
              <dd className="mt-0.5 text-sm">
                {declaration.mode === DeclarationMode.ELECTRONIC
                  ? "Electronic declaration"
                  : "Signed document uploaded"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Signed by</dt>
              <dd className="mt-0.5 text-sm">{declaration.signatoryName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Date</dt>
              <dd className="mt-0.5 text-sm">
                {declaration.signedAt
                  ? new Date(declaration.signedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })
                  : "—"}
              </dd>
            </div>
            {declaration.mode === DeclarationMode.SIGNED_UPLOAD && (
              <div className="sm:col-span-3">
                <dt className="text-xs font-medium text-muted-foreground">Signed document</dt>
                <dd className="mt-1">
                  {allowDownload && signedDeclarationFiles.length > 0 ? (
                    <AttachmentList attachments={signedDeclarationFiles} canDelete={false} />
                  ) : (
                    <p className="text-sm">{declaration.signedDocumentName ?? "—"}</p>
                  )}
                </dd>
              </div>
            )}
          </dl>
        )}
      </Section>
    </div>
  );
}
