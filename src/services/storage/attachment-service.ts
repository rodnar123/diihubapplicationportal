import "server-only";

import { randomUUID } from "node:crypto";

import { AttachmentKind, Role } from "@/generated/prisma/enums";
import type { AttachmentDto } from "@/domain/application/types";
import { describeAllowedTypes, type AppSettings } from "@/domain/settings/app-settings";
import { isEditableByStudent } from "@/domain/application/status";
import type { SessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { AppError, forbidden, invalidState, notFound } from "@/lib/errors";
import { serverEnv } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { AUDIT_ACTIONS, recordAudit } from "@/services/audit/audit-log";
import { getAppSettings } from "@/services/settings/settings-service";
import { toAttachmentDto } from "@/services/application/mappers";

/**
 * Uploads, downloads and deletions for supporting evidence.
 *
 * Objects live in a private Supabase Storage bucket and are only ever reached
 * through a short-lived signed URL minted after an authorisation check — the
 * bucket is never public, and a path is never guessable from the UI.
 */

const SIGNED_URL_TTL_SECONDS = 120;

/**
 * Leading bytes for the formats we accept.
 *
 * A browser's `Content-Type` is attacker-controlled, and the extension is just
 * text. Checking the actual magic bytes is what stops an executable being
 * uploaded as `report.pdf`. Formats without a stable signature (Office XML is
 * a ZIP, so it shares PK) are covered by the ZIP entry.
 */
const FILE_SIGNATURES: Array<{ mime: RegExp; bytes: number[][] }> = [
  { mime: /^application\/pdf$/, bytes: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
  { mime: /^image\/png$/, bytes: [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]] },
  { mime: /^image\/jpeg$/, bytes: [[0xff, 0xd8, 0xff]] },
  { mime: /^image\/gif$/, bytes: [[0x47, 0x49, 0x46, 0x38]] },
  { mime: /^image\/webp$/, bytes: [[0x52, 0x49, 0x46, 0x46]] }, // RIFF….WEBP
  {
    // ZIP container: .zip, .docx, .pptx
    mime: /^application\/(zip|x-zip-compressed|vnd\.openxmlformats-officedocument\..+)$/,
    bytes: [
      [0x50, 0x4b, 0x03, 0x04],
      [0x50, 0x4b, 0x05, 0x06],
      [0x50, 0x4b, 0x07, 0x08],
    ],
  },
  { mime: /^application\/msword$/, bytes: [[0xd0, 0xcf, 0x11, 0xe0]] }, // OLE2
];

function matchesSignature(mimeType: string, header: Uint8Array): boolean {
  const rule = FILE_SIGNATURES.find((entry) => entry.mime.test(mimeType));
  // An accepted type with no signature rule is allowed through; the MIME
  // allowlist has already bounded what can get this far.
  if (!rule) return true;

  return rule.bytes.some((signature) =>
    signature.every((byte, index) => header[index] === byte),
  );
}

/** Strips anything that could be used for traversal or shell tricks. */
function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 120) || "file";
}

function storageBucket(): string {
  return serverEnv.SUPABASE_STORAGE_BUCKET;
}

async function assertUploadAllowed(
  user: SessionUser,
  applicationId: string,
  file: File,
  settings: AppSettings,
) {
  const application = await prisma.application.findFirst({
    where: { id: applicationId, deletedAt: null },
    select: {
      ownerId: true,
      status: true,
      _count: { select: { attachments: { where: { deletedAt: null } } } },
    },
  });

  if (!application) throw notFound("That application no longer exists.");
  if (application.ownerId !== user.id) {
    throw forbidden("You can only add files to your own application.");
  }
  if (!isEditableByStudent(application.status)) {
    throw invalidState("Your application has been submitted; files can no longer be changed.");
  }

  const maxBytes = settings["uploads.maxFileSizeMb"] * 1024 * 1024;
  if (file.size === 0) {
    throw new AppError("UPLOAD_REJECTED", "That file is empty.");
  }
  if (file.size > maxBytes) {
    throw new AppError(
      "UPLOAD_REJECTED",
      `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${settings["uploads.maxFileSizeMb"]} MB per file.`,
    );
  }

  if (!settings["uploads.allowedMimeTypes"].includes(file.type)) {
    throw new AppError(
      "UPLOAD_REJECTED",
      `"${file.name}" is not an accepted file type. Allowed: ${describeAllowedTypes(settings["uploads.allowedMimeTypes"])}.`,
    );
  }

  if (application._count.attachments >= settings["uploads.maxFilesPerApplication"]) {
    throw new AppError(
      "UPLOAD_REJECTED",
      `You have reached the limit of ${settings["uploads.maxFilesPerApplication"]} files. Remove one before adding another.`,
    );
  }
}

export async function uploadAttachment(
  user: SessionUser,
  applicationId: string,
  file: File,
  kind: AttachmentKind = AttachmentKind.SUPPORTING_DOCUMENT,
): Promise<AttachmentDto> {
  const settings = await getAppSettings();
  await assertUploadAllowed(user, applicationId, file, settings);

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!matchesSignature(file.type, buffer.subarray(0, 12))) {
    throw new AppError(
      "UPLOAD_REJECTED",
      `"${file.name}" does not appear to be a genuine ${file.type.split("/").pop()?.toUpperCase()} file.`,
    );
  }

  const fileName = safeFileName(file.name);
  const storagePath = `${applicationId}/${randomUUID()}-${fileName}`;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(storageBucket()).upload(storagePath, buffer, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    console.error("[storage] upload failed", { storagePath, error });
    throw new AppError("INTERNAL", "We could not store that file. Please try again.");
  }

  try {
    const attachment = await prisma.attachment.create({
      data: {
        applicationId,
        kind,
        fileName,
        storagePath,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedById: user.id,
      },
    });

    await recordAudit({
      action: AUDIT_ACTIONS.attachmentUploaded,
      entityType: "Attachment",
      entityId: attachment.id,
      actorId: user.id,
      actorEmail: user.email,
      metadata: { applicationId, fileName, sizeBytes: file.size, mimeType: file.type },
    });

    return toAttachmentDto(attachment);
  } catch (error) {
    // Do not leave an orphaned object behind if the row could not be written.
    await supabase.storage.from(storageBucket()).remove([storagePath]);
    throw error;
  }
}

export async function deleteAttachment(user: SessionUser, attachmentId: string): Promise<void> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    include: {
      application: { select: { ownerId: true, status: true } },
      declaration: { select: { id: true } },
    },
  });

  if (!attachment) throw notFound("That file no longer exists.");
  if (attachment.application.ownerId !== user.id) {
    throw forbidden("You can only remove files from your own application.");
  }
  if (!isEditableByStudent(attachment.application.status)) {
    throw invalidState("Your application has been submitted; files can no longer be changed.");
  }

  await prisma.$transaction(async (tx) => {
    // Removing the file a declaration points at would leave the declaration
    // incomplete, so clear the link in the same transaction.
    if (attachment.declaration) {
      await tx.declaration.update({
        where: { id: attachment.declaration.id },
        data: { signedDocumentId: null, accepted: false },
      });
    }

    // Soft delete: the audit trail must still be able to name the file.
    await tx.attachment.update({
      where: { id: attachmentId },
      data: { deletedAt: new Date() },
    });
  });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.storage.from(storageBucket()).remove([attachment.storagePath]);
  if (error) {
    // The row is already soft-deleted, so the file is unreachable from the UI;
    // an orphaned object is a housekeeping problem, not a correctness one.
    console.warn("[storage] object removal failed", { path: attachment.storagePath, error });
  }

  await recordAudit({
    action: AUDIT_ACTIONS.attachmentDeleted,
    entityType: "Attachment",
    entityId: attachmentId,
    actorId: user.id,
    actorEmail: user.email,
    metadata: { applicationId: attachment.applicationId, fileName: attachment.fileName },
  });
}

/**
 * Mints a short-lived download URL after checking the caller may see the file.
 */
export async function createAttachmentDownloadUrl(
  viewer: { id: string; role: Role; email: string },
  attachmentId: string,
): Promise<{ url: string; fileName: string }> {
  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, deletedAt: null },
    include: { application: { select: { id: true, ownerId: true } } },
  });

  if (!attachment) throw notFound("That file no longer exists.");

  const isOwner = attachment.application.ownerId === viewer.id;
  const isStaff = viewer.role === Role.ADMIN || viewer.role === Role.REVIEWER;

  if (!isOwner && !isStaff) {
    throw forbidden("You do not have permission to download this file.");
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage
    .from(storageBucket())
    .createSignedUrl(attachment.storagePath, SIGNED_URL_TTL_SECONDS, {
      download: attachment.fileName,
    });

  if (error || !data?.signedUrl) {
    console.error("[storage] signed URL failed", { attachmentId, error });
    throw new AppError("INTERNAL", "We could not prepare that download. Please try again.");
  }

  await recordAudit({
    action: AUDIT_ACTIONS.attachmentDownloaded,
    entityType: "Attachment",
    entityId: attachmentId,
    actorId: viewer.id,
    actorEmail: viewer.email,
    metadata: { applicationId: attachment.application.id, fileName: attachment.fileName },
  });

  return { url: data.signedUrl, fileName: attachment.fileName };
}

/** Fetches the raw bytes of an attachment — used when bundling a PDF export. */
export async function readAttachmentBytes(storagePath: string): Promise<Buffer | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(storageBucket()).download(storagePath);

  if (error || !data) {
    console.warn("[storage] download failed", { storagePath, error });
    return null;
  }

  return Buffer.from(await data.arrayBuffer());
}
