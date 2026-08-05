import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/db/prisma";

/**
 * Schools and their sections, as offered in the form's select controls.
 */

export interface SectionOption {
  id: string;
  code: string;
  name: string;
}

export interface SchoolOption {
  id: string;
  code: string;
  name: string;
  sections: SectionOption[];
}

export const getSchoolsWithSections = cache(async (): Promise<SchoolOption[]> => {
  const schools = await prisma.school.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      sections: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });

  return schools;
});

/**
 * Flat section lookup, used to resolve a section id to its display label
 * without re-walking the school tree.
 */
export const getSectionLookup = cache(async (): Promise<Map<string, { name: string; schoolName: string }>> => {
  const sections = await prisma.section.findMany({
    select: { id: true, name: true, school: { select: { name: true } } },
  });

  return new Map(
    sections.map((section) => [section.id, { name: section.name, schoolName: section.school.name }]),
  );
});
