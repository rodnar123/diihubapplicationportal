import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import {
  ApplicationBundleDocument,
  ApplicationDocument,
  type ApplicationPdfData,
} from "@/lib/pdf/application-document";
import { DeclarationDocument } from "@/lib/pdf/declaration-document";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db/prisma";
import { getApplicationForViewer } from "@/services/application/application-service";
import { toApplicantDto, toApplicationDto } from "@/services/application/mappers";
import { getSectionLookup } from "@/services/reference/reference-data";

/**
 * Assembles the data an application PDF needs and renders it.
 *
 * Reference-data lookups (school, section names) happen here rather than in
 * the document so the React-PDF tree stays a pure function of its props —
 * which is what lets the same component be rendered one-off for a download or
 * in a loop for a bulk export.
 */

export async function buildApplicationPdfData(
  applicationId: string,
  viewer: { id: string; role: Role },
): Promise<ApplicationPdfData & { ownerName: string; referenceNumber: string | null }> {
  const record = await getApplicationForViewer(applicationId, viewer);

  const [owner, sectionLookup] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: record.ownerId },
      select: {
        id: true,
        name: true,
        email: true,
        studentProfile: { select: { studentId: true, firstName: true, surname: true } },
      },
    }),
    getSectionLookup(),
  ]);

  const application = toApplicationDto(record);
  const applicant = toApplicantDto(owner);

  const school = record.schoolId
    ? await prisma.school.findUnique({
        where: { id: record.schoolId },
        select: { name: true },
      })
    : null;

  const section = record.sectionId ? sectionLookup.get(record.sectionId) : null;

  return {
    application,
    applicant,
    schoolName: school?.name ?? null,
    sectionName: section?.name ?? null,
    sectionNameById: Object.fromEntries(
      [...sectionLookup.entries()].map(([id, value]) => [id, value.name]),
    ),
    generatedAt: new Date(),
    ownerName: owner.name,
    referenceNumber: application.referenceNumber,
  };
}

export async function renderApplicationPdf(
  applicationId: string,
  viewer: { id: string; role: Role },
): Promise<{ buffer: Buffer; fileName: string }> {
  const data = await buildApplicationPdfData(applicationId, viewer);

  const buffer = await renderToBuffer(<ApplicationDocument {...data} />);

  return { buffer, fileName: pdfFileName(data.referenceNumber, data.application.team?.name, data.ownerName) };
}

export async function renderDeclarationPdf(
  applicationId: string,
  viewer: { id: string; role: Role },
): Promise<{ buffer: Buffer; fileName: string }> {
  const data = await buildApplicationPdfData(applicationId, viewer);

  const buffer = await renderToBuffer(
    <DeclarationDocument
      application={data.application}
      applicant={data.applicant}
      generatedAt={data.generatedAt}
    />,
  );

  const base = slug(data.referenceNumber ?? data.application.team?.name ?? data.ownerName);
  return { buffer, fileName: `declaration-${base}.pdf` };
}

/**
 * Renders many applications into one printable file.
 *
 * A single document rather than a ZIP of separate PDFs: a review panel
 * printing a batch wants one continuous job, and it avoids adding an archive
 * dependency for no benefit.
 */
export async function renderApplicationBundlePdf(
  applicationIds: string[],
  viewer: { id: string; role: Role },
): Promise<{ buffer: Buffer; count: number }> {
  const generatedAt = new Date();

  // Sequential rather than parallel: each render holds a full document tree in
  // memory, and a hundred at once would spike hard for no wall-clock gain.
  const items: ApplicationPdfData[] = [];
  for (const id of applicationIds) {
    try {
      const data = await buildApplicationPdfData(id, viewer);
      items.push({ ...data, generatedAt });
    } catch (error) {
      console.warn("[pdf] skipping application in bundle", { applicationId: id, error });
    }
  }

  const buffer = await renderToBuffer(
    <ApplicationBundleDocument items={items} generatedAt={generatedAt} />,
  );

  return { buffer, count: items.length };
}

function slug(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "application"
  );
}

export function pdfFileName(
  referenceNumber: string | null,
  teamName: string | null | undefined,
  fallback: string,
): string {
  const base = referenceNumber ?? teamName ?? fallback;
  return `${slug(base)}.pdf`;
}
