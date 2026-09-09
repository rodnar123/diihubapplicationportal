import "server-only";

import ExcelJS from "exceljs";

import type { ScoreReport, ScoreReportEntry } from "@/services/admin/score-report";

/**
 * The panel's marking as a workbook: a Summary tab, then one tab per entry.
 *
 * Laid out to match the sheet the assessors mark on, because the office reads
 * both. Criteria run down the page in the printed order, markers run across it,
 * and each section closes with its subtotal against the section total — so a
 * reader checking a typed-up sheet against the paper is comparing the same
 * eight numbers in the same eight places.
 *
 * Excel rather than CSV because the shape is the point: a flat file cannot hold
 * a tab per entry, and flattening the markers into rows would lose the very
 * comparison the sheet exists to make.
 */

/** Excel refuses these in a sheet name, and silently truncates past 31 chars. */
const ILLEGAL_SHEET_CHARS = /[*?:\\/[\]]/g;

/**
 * Sheet names must be unique as well as legal, and truncation is what makes
 * two of them collide — so the de-duplicating suffix is applied after the trim,
 * not before, and eats into the name rather than pushing past the limit.
 */
function sheetNameFor(entry: ScoreReportEntry, taken: Set<string>): string {
  const reference = entry.referenceNumber?.replace(/^DBTC-\d{4}-/, "") ?? "—";
  // Collapse afterwards, not before: swapping an illegal character for a space
  // is what creates the double space, as in "AGROTech: Smart Tool".
  const title = (entry.projectTitle ?? "Untitled")
    .replace(ILLEGAL_SHEET_CHARS, " ")
    .replace(/\s+/g, " ")
    .trim();

  const base = `${reference} ${title}`.slice(0, 31).trim();
  if (!taken.has(base)) {
    taken.add(base);
    return base;
  }

  for (let n = 2; n < 100; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
  }

  return base;
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF7A0B2E" },
};

const SECTION_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2E7EB" },
};

export async function buildScoreWorkbook(report: ScoreReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PNGUoT DiiHub BizTech Challenge portal";
  workbook.created = report.generatedAt;

  addSummarySheet(workbook, report);

  const taken = new Set<string>();
  for (const entry of report.entries) {
    addEntrySheet(workbook, sheetNameFor(entry, taken), entry);
  }

  // exceljs types this as the DOM's ArrayBuffer; under Node it is a Buffer.
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data as ArrayBuffer);
}

function addSummarySheet(workbook: ExcelJS.Workbook, report: ScoreReport) {
  const sheet = workbook.addWorksheet("Summary");

  sheet.mergeCells("A1:G1");
  const title = sheet.getCell("A1");
  title.value = `DiiHub BizTech Challenge ${report.challengeYear} — panel scores`;
  title.font = { bold: true, size: 14 };

  sheet.mergeCells("A2:G2");
  sheet.getCell("A2").value =
    `Generated ${report.generatedAt.toISOString().slice(0, 16).replace("T", " ")} · ` +
    `${report.entries.length} ${report.entries.length === 1 ? "entry" : "entries"} · ` +
    `rubric of ${report.criteriaCount} lines`;
  sheet.getCell("A2").font = { italic: true, color: { argb: "FF666666" } };

  const header = sheet.addRow([]);
  header.values = [];
  const columns = sheet.addRow([
    "Reference",
    "Project",
    "Team",
    "Theme",
    "Status",
    "Average",
    "Markers",
  ]);
  styleHeaderRow(columns);

  for (const entry of report.entries) {
    sheet.addRow([
      entry.referenceNumber ?? "—",
      entry.projectTitle ?? "—",
      entry.teamName ?? "—",
      entry.theme ?? "—",
      entry.status,
      // Blank rather than zero: no submitted card is not a score of nothing.
      entry.average ?? "",
      entry.submittedMarkers,
    ]);
  }

  sheet.columns = [
    { width: 18 },
    { width: 52 },
    { width: 20 },
    { width: 30 },
    { width: 16 },
    { width: 10 },
    { width: 10 },
  ];
  sheet.views = [{ state: "frozen", ySplit: 4 }];
  header.height = 6;
}

function addEntrySheet(workbook: ExcelJS.Workbook, name: string, entry: ScoreReportEntry) {
  const sheet = workbook.addWorksheet(name);
  const markerCount = Math.max(entry.markers.length, 1);
  const lastColumn = 4 + markerCount; // criteria, section, description, max, …markers

  sheet.mergeCells(1, 1, 1, lastColumn);
  const heading = sheet.getCell(1, 1);
  heading.value = `${entry.referenceNumber ?? "—"} · ${entry.projectTitle ?? "Untitled"}`;
  heading.font = { bold: true, size: 13 };

  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value =
    `Team ${entry.teamName ?? "—"} · ${entry.theme ?? "No theme"} · ${entry.status}`;
  sheet.getCell(2, 1).font = { color: { argb: "FF666666" } };

  sheet.addRow([]);

  const columns = sheet.addRow([
    "Section",
    "Criterion",
    "Description",
    "Max",
    ...entry.markers.map((marker) =>
      // The column says whose marks these are, and says so when they are not
      // there yet — an empty unlabelled column reads as a zero.
      marker.submitted ? marker.name : `${marker.name} (in progress)`,
    ),
    ...(entry.markers.length === 0 ? ["No markers allocated"] : []),
  ]);
  styleHeaderRow(columns);

  for (const group of entry.groups) {
    for (const [index, line] of group.lines.entries()) {
      const row = sheet.addRow([
        index === 0 ? group.name : "",
        line.name,
        line.description ?? "",
        line.maxValue,
        ...line.marks.map((mark) => mark ?? ""),
      ]);
      row.alignment = { vertical: "top", wrapText: true };
      row.getCell(1).font = { bold: true };
      for (let c = 4; c <= lastColumn; c += 1) {
        row.getCell(c).alignment = { horizontal: "center", vertical: "top" };
      }
    }

    const subtotal = sheet.addRow([
      "",
      `${group.name} — subtotal`,
      "",
      group.maxTotal,
      ...group.subtotals.map((value) => value ?? ""),
    ]);
    subtotal.font = { bold: true };
    subtotal.eachCell((cell) => {
      cell.fill = SECTION_FILL;
    });
    for (let c = 4; c <= lastColumn; c += 1) {
      subtotal.getCell(c).alignment = { horizontal: "center" };
    }
  }

  sheet.addRow([]);

  const total = sheet.addRow([
    "",
    "TOTAL",
    "",
    entry.maxTotal,
    ...entry.markers.map((marker) => marker.total ?? ""),
  ]);
  total.font = { bold: true, size: 12 };
  for (let c = 4; c <= lastColumn; c += 1) {
    total.getCell(c).alignment = { horizontal: "center" };
  }

  const average = sheet.addRow([
    "",
    `Average of ${entry.submittedMarkers} submitted ${entry.submittedMarkers === 1 ? "card" : "cards"}`,
    "",
    "",
    entry.average ?? "",
  ]);
  average.font = { bold: true };

  if (entry.decisionNote) {
    sheet.addRow([]);
    const label = sheet.addRow(["", "Panel decision note"]);
    label.font = { bold: true };
    const noteRow = sheet.addRow(["", entry.decisionNote]);
    sheet.mergeCells(noteRow.number, 2, noteRow.number, lastColumn);
    noteRow.getCell(2).alignment = { wrapText: true, vertical: "top" };
    noteRow.height = 90;
  }

  const perLineNotes = entry.groups
    .flatMap((group) => group.lines)
    .flatMap((line) =>
      line.notes
        .map((note, index) => ({ note, marker: entry.markers[index], line }))
        .filter((item) => item.note && item.note.trim().length > 0),
    );

  if (perLineNotes.length > 0) {
    sheet.addRow([]);
    const label = sheet.addRow(["", "Marker comments"]);
    label.font = { bold: true };
    for (const item of perLineNotes) {
      const row = sheet.addRow(["", item.marker?.name ?? "—", `${item.line.name}: ${item.note}`]);
      sheet.mergeCells(row.number, 3, row.number, lastColumn);
      row.getCell(3).alignment = { wrapText: true, vertical: "top" };
    }
  }

  sheet.columns = [
    { width: 30 },
    { width: 34 },
    { width: 60 },
    { width: 7 },
    ...entry.markers.map(() => ({ width: 16 })),
  ];
  sheet.views = [{ state: "frozen", xSplit: 2, ySplit: 4 }];
}

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  row.height = 24;
}
