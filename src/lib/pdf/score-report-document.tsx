import { Document, Page, Text, View } from "@react-pdf/renderer";

import { Crest, PageFooter, SectionHeading } from "@/lib/pdf/pdf-primitives";
import { PDF_COLORS, pdfStyles } from "@/lib/pdf/pdf-styles";
import type { ScoreReport, ScoreReportEntry } from "@/services/admin/score-report";

/**
 * The panel's marking as a printable record.
 *
 * The same report as the workbook, in the form you file rather than the form
 * you edit: a summary page, then one page per entry laid out like the marking
 * sheet — criteria down, markers across, a subtotal closing each section.
 *
 * Column widths are fixed proportions rather than measured, because a PDF has
 * no reflow: the marker columns share whatever the description leaves, so four
 * assessors fit on a page and eight would be unreadable in any layout.
 */

const CELL_BORDER = { borderBottomWidth: 0.5, borderBottomColor: PDF_COLORS.border } as const;

/** Widths as fractions of the row. Markers divide what is left of `rest`. */
const COL = { criterion: 0.3, description: 0.38, max: 0.07 } as const;

function markerWidth(count: number): string {
  const rest = 1 - COL.criterion - COL.description - COL.max;
  return `${((rest / Math.max(count, 1)) * 100).toFixed(3)}%`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(3)}%`;
}

export function ScoreReportDocument({ report }: { report: ScoreReport }) {
  const stamp = report.generatedAt.toISOString().slice(0, 16).replace("T", " ");

  return (
    <Document
      title={`DiiHub BizTech Challenge ${report.challengeYear} — panel scores`}
      author="PNGUoT DiiHub BizTech Challenge portal"
    >
      <Page size="A4" orientation="landscape" style={pdfStyles.page}>
        <Crest />
        <SectionHeading>{`Panel scores ${report.challengeYear}`}</SectionHeading>
        <Text style={{ fontSize: 8.5, color: PDF_COLORS.muted, marginBottom: 10 }}>
          Generated {stamp} · {report.entries.length}{" "}
          {report.entries.length === 1 ? "entry" : "entries"} · rubric of{" "}
          {report.criteriaCount} lines
        </Text>

        <View style={{ flexDirection: "row", backgroundColor: PDF_COLORS.surface, paddingVertical: 4 }}>
          <Text style={{ width: "14%", fontSize: 8, fontWeight: 700 }}>Reference</Text>
          <Text style={{ width: "36%", fontSize: 8, fontWeight: 700 }}>Project</Text>
          <Text style={{ width: "16%", fontSize: 8, fontWeight: 700 }}>Team</Text>
          <Text style={{ width: "16%", fontSize: 8, fontWeight: 700 }}>Status</Text>
          <Text style={{ width: "9%", fontSize: 8, fontWeight: 700, textAlign: "center" }}>
            Average
          </Text>
          <Text style={{ width: "9%", fontSize: 8, fontWeight: 700, textAlign: "center" }}>
            Markers
          </Text>
        </View>

        {report.entries.map((entry) => (
          <View
            key={entry.applicationId}
            style={{ flexDirection: "row", paddingVertical: 3, ...CELL_BORDER }}
            wrap={false}
          >
            <Text style={{ width: "14%", fontSize: 8 }}>{entry.referenceNumber ?? "—"}</Text>
            <Text style={{ width: "36%", fontSize: 8 }}>{entry.projectTitle ?? "—"}</Text>
            <Text style={{ width: "16%", fontSize: 8 }}>{entry.teamName ?? "—"}</Text>
            <Text style={{ width: "16%", fontSize: 8 }}>{entry.status}</Text>
            <Text style={{ width: "9%", fontSize: 8, textAlign: "center" }}>
              {entry.average ?? "—"}
            </Text>
            <Text style={{ width: "9%", fontSize: 8, textAlign: "center" }}>
              {entry.submittedMarkers}
            </Text>
          </View>
        ))}

        <PageFooter reference={`Panel scores ${report.challengeYear}`} />
      </Page>

      {report.entries.map((entry) => (
        <EntryPage key={entry.applicationId} entry={entry} />
      ))}
    </Document>
  );
}

function EntryPage({ entry }: { entry: ScoreReportEntry }) {
  const width = markerWidth(entry.markers.length);

  return (
    <Page size="A4" orientation="landscape" style={pdfStyles.page}>
      <SectionHeading>{entry.referenceNumber ?? "—"}</SectionHeading>
      <Text style={{ fontSize: 11, fontWeight: 700, marginBottom: 2 }}>
        {entry.projectTitle ?? "Untitled"}
      </Text>
      <Text style={{ fontSize: 8.5, color: PDF_COLORS.muted, marginBottom: 8 }}>
        Team {entry.teamName ?? "—"} · {entry.theme ?? "No theme"} · {entry.status}
      </Text>

      {entry.markers.length === 0 ? (
        <Text style={{ fontSize: 9, color: PDF_COLORS.muted }}>
          Nobody has been allocated this entry, so there are no marks to report.
        </Text>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              backgroundColor: PDF_COLORS.surface,
              paddingVertical: 4,
            }}
          >
            <Text style={{ width: pct(COL.criterion), fontSize: 7.5, fontWeight: 700 }}>
              Criterion
            </Text>
            <Text style={{ width: pct(COL.description), fontSize: 7.5, fontWeight: 700 }}>
              Description
            </Text>
            <Text
              style={{ width: pct(COL.max), fontSize: 7.5, fontWeight: 700, textAlign: "center" }}
            >
              Max
            </Text>
            {entry.markers.map((marker) => (
              <Text
                key={marker.assignmentId}
                style={{ width, fontSize: 7.5, fontWeight: 700, textAlign: "center" }}
              >
                {marker.name}
                {marker.submitted ? "" : "\n(in progress)"}
              </Text>
            ))}
          </View>

          {entry.groups.map((group) => (
            <View key={group.code} wrap={false}>
              <Text
                style={{
                  fontSize: 8.5,
                  fontWeight: 700,
                  color: PDF_COLORS.maroon,
                  marginTop: 6,
                  marginBottom: 2,
                }}
              >
                {group.name}
              </Text>

              {group.lines.map((line) => (
                <View
                  key={line.criterionId}
                  style={{ flexDirection: "row", paddingVertical: 2, ...CELL_BORDER }}
                >
                  <Text style={{ width: pct(COL.criterion), fontSize: 7.5 }}>{line.name}</Text>
                  <Text
                    style={{ width: pct(COL.description), fontSize: 6.8, color: PDF_COLORS.muted }}
                  >
                    {line.description ?? ""}
                  </Text>
                  <Text style={{ width: pct(COL.max), fontSize: 7.5, textAlign: "center" }}>
                    {line.maxValue}
                  </Text>
                  {line.marks.map((mark, index) => (
                    <Text
                      key={entry.markers[index]?.assignmentId ?? index}
                      style={{ width, fontSize: 7.5, textAlign: "center" }}
                    >
                      {mark ?? "—"}
                    </Text>
                  ))}
                </View>
              ))}

              <View
                style={{
                  flexDirection: "row",
                  paddingVertical: 2,
                  backgroundColor: PDF_COLORS.surface,
                }}
              >
                <Text
                  style={{
                    width: pct(COL.criterion + COL.description),
                    fontSize: 7.5,
                    fontWeight: 700,
                  }}
                >
                  {group.name} — subtotal
                </Text>
                <Text
                  style={{ width: pct(COL.max), fontSize: 7.5, fontWeight: 700, textAlign: "center" }}
                >
                  {group.maxTotal}
                </Text>
                {group.subtotals.map((value, index) => (
                  <Text
                    key={entry.markers[index]?.assignmentId ?? index}
                    style={{ width, fontSize: 7.5, fontWeight: 700, textAlign: "center" }}
                  >
                    {value ?? "—"}
                  </Text>
                ))}
              </View>
            </View>
          ))}

          <View
            style={{
              flexDirection: "row",
              paddingVertical: 4,
              marginTop: 6,
              borderTopWidth: 1,
              borderTopColor: PDF_COLORS.borderStrong,
            }}
          >
            <Text
              style={{ width: pct(COL.criterion + COL.description), fontSize: 9, fontWeight: 700 }}
            >
              TOTAL
            </Text>
            <Text style={{ width: pct(COL.max), fontSize: 9, fontWeight: 700, textAlign: "center" }}>
              {entry.maxTotal}
            </Text>
            {entry.markers.map((marker) => (
              <Text
                key={marker.assignmentId}
                style={{ width, fontSize: 9, fontWeight: 700, textAlign: "center" }}
              >
                {marker.total ?? "—"}
              </Text>
            ))}
          </View>

          <Text style={{ fontSize: 9, fontWeight: 700, marginTop: 4 }}>
            Average of {entry.submittedMarkers} submitted{" "}
            {entry.submittedMarkers === 1 ? "card" : "cards"}: {entry.average ?? "—"}
          </Text>
        </>
      )}

      {entry.decisionNote && (
        <View style={{ marginTop: 10 }} wrap={false}>
          <Text style={{ fontSize: 8.5, fontWeight: 700, marginBottom: 2 }}>
            Panel decision note
          </Text>
          <Text style={{ fontSize: 8, color: PDF_COLORS.body }}>{entry.decisionNote}</Text>
        </View>
      )}

      <PageFooter reference={entry.referenceNumber ?? "Panel scores"} />
    </Page>
  );
}
