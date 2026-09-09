import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { ScoreReportDocument } from "@/lib/pdf/score-report-document";
import type { ScoreReport } from "@/services/admin/score-report";

/**
 * Renders the score report to a printable file.
 *
 * A one-line wrapper, and worth its own module for the same reason
 * `pdf-service` exists: constructing the element inside the route's try/catch
 * would be constructing JSX somewhere that cannot catch its errors, since
 * rendering happens later. Building it here keeps the route free of JSX and
 * the failure where it can actually be handled.
 */
export async function renderScoreReportPdf(report: ScoreReport): Promise<Buffer> {
  return renderToBuffer(<ScoreReportDocument report={report} />);
}
