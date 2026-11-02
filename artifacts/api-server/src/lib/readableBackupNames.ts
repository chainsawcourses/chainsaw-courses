/** Human-readable names, with record identifiers retained to distinguish namesakes. */
export function learnerBackupName(name: unknown, userId: unknown): string {
  const clean = String(name ?? "").normalize("NFC").replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return `${clean || "Unnamed learner"} - User ${String(userId)}`;
}

export function progressCsv(name: string, tables: Array<{ name: string; rows: Record<string, unknown>[] }>, userId: number): Buffer {
  const rows: unknown[][] = [["Learner", "Dataset", "Record", "Field", "Value"]];
  for (const table of tables) {
    for (const row of table.rows.filter((row) => Number(row.user_id) === userId)) {
      for (const [field, value] of Object.entries(row)) {
        rows.push([name, table.name, row.id ?? "", field, value instanceof Date ? value.toISOString() : typeof value === "object" && value !== null ? JSON.stringify(value) : value ?? ""]);
      }
    }
  }
  if (rows.length === 1) rows.push([name, "Progress", "", "Status", "No progress recorded"]);
  const cell = (value: unknown) => {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  return Buffer.from("\ufeff" + rows.map((row) => row.map(cell).join(",")).join("\r\n"), "utf8");
}
