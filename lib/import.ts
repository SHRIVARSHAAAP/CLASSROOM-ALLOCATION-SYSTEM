export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === "," && !quoted) {
      row.push(value.trim());
      value = "";
    } else if (ch === "\n" && !quoted) {
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = "";
    } else if (ch !== "\r") value += ch;
  }
  if (quoted) throw new Error("Unclosed quote in CSV.");
  if (row.length || value) {
    row.push(value.trim());
    rows.push(row);
  }
  return rows;
}
