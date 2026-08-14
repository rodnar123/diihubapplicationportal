"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CategoryBarChart, OrdinalBarChart } from "@/components/admin/charts";

export interface BreakdownSeries {
  label: string;
  count: number;
}

/**
 * The four "same measure, different cut" breakdowns — school, section, year
 * level and theme — in one card.
 *
 * They were four half-width cards, which cost about 700px of the dashboard's
 * height to show four views of a single number nobody compares side by side.
 * Tabbing them keeps every view one click away and lets the remaining cards
 * carry the two charts that genuinely want their own space: where entries sit
 * in the workflow, and how submissions are trending.
 *
 * The panels are all mounted rather than lazily rendered, so switching tabs
 * does not re-run Recharts' entry animation on data the reviewer has already
 * seen.
 */
export function BreakdownTabs({
  bySchool,
  bySection,
  byYearLevel,
  byTheme,
}: {
  bySchool: BreakdownSeries[];
  bySection: BreakdownSeries[];
  byYearLevel: BreakdownSeries[];
  byTheme: BreakdownSeries[];
}) {
  return (
    <Tabs defaultValue="school">
      <TabsList className="w-full max-w-md">
        <TabsTrigger value="school">School</TabsTrigger>
        <TabsTrigger value="section">Section</TabsTrigger>
        <TabsTrigger value="year">Year level</TabsTrigger>
        <TabsTrigger value="theme">Theme</TabsTrigger>
      </TabsList>

      <TabsContent value="school" forceMount className="data-[state=inactive]:hidden">
        <CategoryBarChart data={bySchool} emptyLabel="No applications yet" />
      </TabsContent>
      <TabsContent value="section" forceMount className="data-[state=inactive]:hidden">
        <CategoryBarChart data={bySection} emptyLabel="No applications yet" />
      </TabsContent>
      <TabsContent value="year" forceMount className="data-[state=inactive]:hidden">
        <OrdinalBarChart data={byYearLevel} emptyLabel="No applications yet" />
      </TabsContent>
      <TabsContent value="theme" forceMount className="data-[state=inactive]:hidden">
        <CategoryBarChart data={byTheme} emptyLabel="No themes selected yet" />
      </TabsContent>
    </Tabs>
  );
}
