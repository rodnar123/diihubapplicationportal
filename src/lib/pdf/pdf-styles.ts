import { StyleSheet } from "@react-pdf/renderer";

/**
 * Shared PDF styling.
 *
 * Only the built-in Helvetica family is used: registering a web font would add
 * a network fetch to every render, and the official form is a plain
 * institutional document where a system serif/sans is entirely appropriate.
 *
 * Colours are plain hex rather than the app's oklch tokens — React-PDF's
 * renderer does not understand CSS custom properties or modern colour spaces.
 */

/**
 * Print palette. Maroon and gold are the crest's own colours; the gold is
 * darkened from the on-screen value because bright yellow on white paper is
 * close to invisible.
 */
export const PDF_COLORS = {
  ink: "#1a1416",
  body: "#2b2126",
  muted: "#6b5860",
  faint: "#9c8891",
  border: "#ddd0d5",
  borderStrong: "#b9a4ac",
  surface: "#f7f1f3",
  maroon: "#800030",
  gold: "#8a6a00",
  white: "#ffffff",
} as const;

export const pdfStyles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 56,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9.5,
    lineHeight: 1.45,
    color: PDF_COLORS.body,
  },

  // --- Masthead ------------------------------------------------------------
  masthead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: PDF_COLORS.maroon,
    paddingBottom: 10,
    marginBottom: 4,
  },
  crest: {
    width: 42,
    height: 42,
  },
  crestFallback: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    borderColor: PDF_COLORS.maroon,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  crestFallbackText: {
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    color: PDF_COLORS.maroon,
  },
  mastheadText: { flex: 1 },
  university: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: PDF_COLORS.maroon,
  },
  host: {
    fontSize: 8.5,
    color: PDF_COLORS.muted,
    marginTop: 1,
  },
  formTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 13,
    color: PDF_COLORS.ink,
    marginTop: 10,
    marginBottom: 2,
  },

  // --- Reference strip -----------------------------------------------------
  referenceStrip: {
    flexDirection: "row",
    gap: 16,
    backgroundColor: PDF_COLORS.surface,
    borderWidth: 0.75,
    borderColor: PDF_COLORS.border,
    borderRadius: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 8,
    marginBottom: 14,
  },
  referenceCell: { flex: 1 },
  referenceLabel: {
    fontSize: 7,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: PDF_COLORS.muted,
  },
  referenceValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: PDF_COLORS.ink,
    marginTop: 1.5,
  },

  // --- Sections ------------------------------------------------------------
  section: { marginBottom: 14 },
  sectionHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    color: PDF_COLORS.white,
    backgroundColor: PDF_COLORS.maroon,
    paddingVertical: 3.5,
    paddingHorizontal: 7,
    marginBottom: 8,
  },
  fieldBlock: { marginBottom: 8 },
  fieldLabel: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    color: PDF_COLORS.ink,
    marginBottom: 2,
  },
  fieldHint: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    marginBottom: 3,
  },
  fieldValue: { fontSize: 9.5 },
  empty: {
    fontSize: 9,
    color: PDF_COLORS.faint,
    fontStyle: "italic",
  },

  // --- Inline key/value grid ----------------------------------------------
  grid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 },
  gridCell: { width: "33.333%", paddingHorizontal: 4, marginBottom: 7 },
  gridCellHalf: { width: "50%", paddingHorizontal: 4, marginBottom: 7 },

  // --- Rich-text blocks ----------------------------------------------------
  paragraph: { marginBottom: 4 },
  heading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 4,
    marginBottom: 3,
  },
  listItem: { flexDirection: "row", marginBottom: 2.5 },
  listMarker: { width: 14, color: PDF_COLORS.muted },
  listBody: { flex: 1 },

  // --- Tables --------------------------------------------------------------
  table: {
    borderWidth: 0.75,
    borderColor: PDF_COLORS.borderStrong,
    borderRadius: 2,
  },
  tableHeaderRow: {
    flexDirection: "row",
    backgroundColor: PDF_COLORS.surface,
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.borderStrong,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.border,
    minHeight: 18,
  },
  tableRowLast: { flexDirection: "row", minHeight: 18 },
  th: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderRightColor: PDF_COLORS.border,
  },
  td: {
    fontSize: 8.5,
    paddingVertical: 4,
    paddingHorizontal: 5,
    borderRightWidth: 0.5,
    borderRightColor: PDF_COLORS.border,
  },
  colIndex: { width: "6%" },
  colStudentId: { width: "17%" },
  colName: { width: "19%" },
  colSection: { width: "21%" },
  colRole: { width: "24%" },

  // --- Declaration ---------------------------------------------------------
  declarationBox: {
    borderWidth: 0.75,
    borderColor: PDF_COLORS.borderStrong,
    borderRadius: 2,
    padding: 9,
  },
  declarationText: { fontSize: 9.5, marginBottom: 8 },
  signatureRow: { flexDirection: "row", gap: 24, marginTop: 14 },
  signatureCell: { flex: 1 },
  signatureLine: {
    borderBottomWidth: 0.75,
    borderBottomColor: PDF_COLORS.ink,
    height: 22,
    marginBottom: 3,
  },
  signatureCaption: { fontSize: 8, color: PDF_COLORS.muted },
  signatureScript: {
    fontFamily: "Helvetica-Oblique",
    fontSize: 11,
    color: PDF_COLORS.ink,
    paddingBottom: 3,
  },

  // --- Official use --------------------------------------------------------
  officialBox: {
    borderWidth: 0.75,
    borderColor: PDF_COLORS.gold,
    borderRadius: 2,
    padding: 9,
    backgroundColor: "#fdf8ee",
  },
  officialHeading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: PDF_COLORS.gold,
    marginBottom: 6,
  },

  // --- Footer --------------------------------------------------------------
  footer: {
    position: "absolute",
    bottom: 24,
    left: 44,
    right: 44,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: PDF_COLORS.border,
    paddingTop: 6,
  },
  footerText: { fontSize: 7.5, color: PDF_COLORS.muted },

  watermark: {
    position: "absolute",
    top: 300,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
    fontSize: 62,
    // A maroon so pale it reads as a tint — the last cool grey in the print
    // palette, which sat oddly against the warm surface it overlays.
    color: "#f4ecef",
    transform: "rotate(-28deg)",
  },
});
