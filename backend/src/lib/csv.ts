/** RFC 4180-style CSV rows, including escaped quotes and embedded newlines. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ',') { row.push(field.trim()); field = ''; }
    else if (char === '\n') { row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (quoted) throw new Error('CSV contains an unterminated quoted field.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
