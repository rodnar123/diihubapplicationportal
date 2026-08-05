import { Document, Page, Text, View } from "@react-pdf/renderer";

import { Crest, GridCell, PageFooter, SectionHeading, SignatureLine } from "@/lib/pdf/pdf-primitives";
import { pdfStyles } from "@/lib/pdf/pdf-styles";
import { CHALLENGE_HOST, CHALLENGE_NAME, UNIVERSITY_NAME } from "@/domain/challenge/constants";
import type { ApplicantDto, ApplicationDto } from "@/domain/application/types";

/**
 * The stand-alone declaration, for teams that would rather sign on paper.
 *
 * It repeats enough of the application's identifying detail that a signed
 * scan can be matched back to the right entry without the covering form.
 */
export function DeclarationDocument({
  application,
  applicant,
  generatedAt,
}: {
  application: ApplicationDto;
  applicant: ApplicantDto;
  generatedAt: Date;
}) {
  const team = application.team;
  const reference = application.referenceNumber ?? `Draft — ${team?.name || applicant.fullName}`;

  const declarationText = `We hereby declare that this proposal and prototype are original works of our team and submitted for the ${CHALLENGE_HOST}, ${CHALLENGE_NAME} ${application.challengeYear}.`;

  return (
    <Document
      title={`Declaration — ${reference}`}
      author={UNIVERSITY_NAME}
      creator={`${UNIVERSITY_NAME} Student Challenge Portal`}
    >
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.masthead}>
          <Crest />
          <View style={pdfStyles.mastheadText}>
            <Text style={pdfStyles.university}>{UNIVERSITY_NAME}</Text>
            <Text style={pdfStyles.host}>{CHALLENGE_HOST}</Text>
          </View>
        </View>

        <Text style={pdfStyles.formTitle}>
          {CHALLENGE_NAME} {application.challengeYear} — Declaration
        </Text>

        <View style={pdfStyles.section}>
          <SectionHeading>Application details</SectionHeading>
          <View style={pdfStyles.grid}>
            <GridCell label="Reference" value={application.referenceNumber ?? "Draft"} />
            <GridCell label="Team name" value={team?.name ?? null} />
            <GridCell label="Team leader" value={team?.leaderName ?? applicant.fullName} />
            <GridCell label="Leader's student ID" value={team?.leaderStudentId ?? applicant.studentId} />
            <GridCell label="Contact email" value={team?.leaderEmail ?? applicant.email} />
            <GridCell label="Project title" value={application.projectTitle} />
          </View>
        </View>

        <View style={pdfStyles.section}>
          <SectionHeading>Declaration</SectionHeading>
          <View style={pdfStyles.declarationBox}>
            <Text style={[pdfStyles.declarationText, { fontSize: 11, lineHeight: 1.6 }]}>
              {declarationText}
            </Text>

            <Text style={pdfStyles.fieldHint}>
              Print this page, have the team leader sign and date it by hand, then upload a scan or
              clear photograph of the signed page to the portal.
            </Text>

            <View style={pdfStyles.signatureRow}>
              <SignatureLine caption="Team Leader Signature" />
              <SignatureLine caption="Date" />
            </View>

            <View style={pdfStyles.signatureRow}>
              <SignatureLine caption="Team Leader Name (please print)" />
              <SignatureLine caption="Student ID" />
            </View>
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.fieldHint}>
            All team members named on the application are bound by this declaration. Submitting work
            that is not your team&rsquo;s own is an academic integrity matter and will be referred to
            the university.
          </Text>
        </View>

        <PageFooter
          reference={`${reference} · Generated ${generatedAt.toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}`}
        />
      </Page>
    </Document>
  );
}
