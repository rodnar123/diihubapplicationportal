import { Text, View } from "@react-pdf/renderer";

import { parseRichText, type InlineRun } from "@/lib/pdf/parse-rich-text";
import { PDF_COLORS, pdfStyles } from "@/lib/pdf/pdf-styles";

/**
 * Building blocks shared by the application and declaration documents.
 */

function runStyle(run: InlineRun) {
  // React-PDF has no synthetic bold/italic: the weight has to be selected by
  // picking the right member of the Helvetica family.
  const fontFamily =
    run.bold && run.italic
      ? "Helvetica-BoldOblique"
      : run.bold
        ? "Helvetica-Bold"
        : run.italic
          ? "Helvetica-Oblique"
          : "Helvetica";

  return {
    fontFamily,
    textDecoration: run.underline
      ? ("underline" as const)
      : run.strike
        ? ("line-through" as const)
        : undefined,
  };
}

function Runs({ runs }: { runs: InlineRun[] }) {
  return (
    <>
      {runs.map((run, index) => (
        <Text key={index} style={runStyle(run)}>
          {run.text}
        </Text>
      ))}
    </>
  );
}

/**
 * Renders a stored rich-text answer, preserving emphasis and list structure.
 */
export function RichText({ html, empty = "Not provided" }: { html: string | null; empty?: string }) {
  const blocks = parseRichText(html);

  if (blocks.length === 0) {
    return <Text style={pdfStyles.empty}>{empty}</Text>;
  }

  return (
    <View>
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          return (
            <Text key={blockIndex} style={pdfStyles.heading}>
              <Runs runs={block.runs} />
            </Text>
          );
        }

        if (block.type === "list") {
          return (
            <View key={blockIndex} style={{ marginBottom: 4 }}>
              {block.items.map((item, itemIndex) => (
                <View key={itemIndex} style={pdfStyles.listItem}>
                  <Text style={pdfStyles.listMarker}>
                    {block.ordered ? `${itemIndex + 1}.` : "•"}
                  </Text>
                  <Text style={pdfStyles.listBody}>
                    <Runs runs={item} />
                  </Text>
                </View>
              ))}
            </View>
          );
        }

        return (
          <Text key={blockIndex} style={pdfStyles.paragraph}>
            <Runs runs={block.runs} />
          </Text>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  hint,
  value,
  html,
}: {
  label: string;
  hint?: string;
  value?: string | null;
  html?: string | null;
}) {
  return (
    <View style={pdfStyles.fieldBlock} wrap={false}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      {hint && <Text style={pdfStyles.fieldHint}>{hint}</Text>}
      {html !== undefined ? (
        <RichText html={html ?? null} />
      ) : value?.trim() ? (
        <Text style={pdfStyles.fieldValue}>{value}</Text>
      ) : (
        <Text style={pdfStyles.empty}>Not provided</Text>
      )}
    </View>
  );
}

/**
 * A long-form answer that may run over a page break; `wrap` is left on so a
 * two-page problem statement is not silently clipped.
 */
export function LongField({
  label,
  hint,
  html,
}: {
  label: string;
  hint?: string;
  html: string | null;
}) {
  return (
    <View style={pdfStyles.fieldBlock}>
      <Text style={pdfStyles.fieldLabel}>{label}</Text>
      {hint && <Text style={pdfStyles.fieldHint}>{hint}</Text>}
      <RichText html={html} />
    </View>
  );
}

export function GridCell({
  label,
  value,
  half = false,
}: {
  label: string;
  value: string | null;
  half?: boolean;
}) {
  return (
    <View style={half ? pdfStyles.gridCellHalf : pdfStyles.gridCell}>
      <Text style={pdfStyles.referenceLabel}>{label}</Text>
      <Text style={value?.trim() ? pdfStyles.fieldValue : pdfStyles.empty}>
        {value?.trim() || "—"}
      </Text>
    </View>
  );
}

export function SectionHeading({ children }: { children: string }) {
  return <Text style={pdfStyles.sectionHeading}>{children}</Text>;
}

export function SignatureLine({
  caption,
  value,
}: {
  caption: string;
  value?: string | null;
}) {
  return (
    <View style={pdfStyles.signatureCell}>
      <View style={pdfStyles.signatureLine}>
        {value ? (
          <Text style={pdfStyles.signatureScript}>{value}</Text>
        ) : (
          <Text> </Text>
        )}
      </View>
      <Text style={pdfStyles.signatureCaption}>{caption}</Text>
    </View>
  );
}

/**
 * Placeholder crest. Swap for an `<Image src="…" />` once the university
 * supplies the artwork; nothing else in the document needs to change.
 */
export function Crest() {
  return (
    <View style={pdfStyles.crestFallback}>
      <Text style={pdfStyles.crestFallbackText}>UoT</Text>
    </View>
  );
}

export function PageFooter({ reference }: { reference: string }) {
  return (
    <View style={pdfStyles.footer} fixed>
      <Text style={pdfStyles.footerText}>{reference}</Text>
      <Text
        style={pdfStyles.footerText}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}

export const PDF_PALETTE = PDF_COLORS;
