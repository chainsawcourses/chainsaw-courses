import type { AccessStatus } from "./accessPolicy";

export type { AccessStatus } from "./accessPolicy";

export type CourseAccessStatusText = {
  label: "Course access expires" | "Course access ended";
  date: string;
};

export function formatCourseAccessStatus(accessExpiresAt: string | null, status: AccessStatus): CourseAccessStatusText | null {
  if (!accessExpiresAt || status === "unknown") return null;
  const date = new Date(accessExpiresAt);
  if (Number.isNaN(date.getTime())) return null;
  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return {
    label: status === "expired" ? "Course access ended" : "Course access expires",
    date: formattedDate,
  };
}