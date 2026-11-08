// Parses pricelist text pasted from Google Sheets / Excel (tab-separated) or
// plain lines like "11 Diamonds – ₱11". Shared by the bulk-paste UI and API.

export type ParsedRow = {
  line: number; // 1-based line number in the pasted text, for error messages
  name: string;
  price: number;
  // undefined = column not present in the paste → leave existing value alone
  originalPrice?: number | null;
  status?: 'available' | 'sold_out';
  notes?: string | null;
};

export type ParseResult = { rows: ParsedRow[]; errors: string[]; columns: string[] };

type Col = 'name' | 'price' | 'originalPrice' | 'status' | 'notes';
const POSITIONAL: Col[] = ['name', 'price', 'originalPrice', 'status', 'notes'];
const COL_LABEL: Record<Col, string> = {
  name: 'Name', price: 'Price', originalPrice: 'Original Price', status: 'Status', notes: 'Notes',
};

export function normalizeName(s: string) {
  // "1,163 Diamonds" and "1163 diamonds" are the same item
  return s.toLowerCase().replace(/(\d),(?=\d{3}\b)/g, '$1').replace(/\s+/g, ' ').trim();
}

export function parseMoney(raw: string): number | null {
  const cleaned = raw.replace(/₱|php|p(?=\s*\d)/gi, '').replace(/[,\s]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseStatus(raw: string): 'available' | 'sold_out' | undefined {
  const s = raw.trim().toLowerCase();
  if (!s) return undefined;
  if (/sold|out of stock|unavail|^no$|^n$|^false$/.test(s)) return 'sold_out';
  if (/avail|in stock|^yes$|^y$|^true$/.test(s)) return 'available';
  return undefined;
}

function headerCol(cell: string): Col | null {
  const c = cell.trim().toLowerCase();
  if (/orig|old|regular|was|slash|before/.test(c)) return 'originalPrice';
  if (/price|amount|srp|cost|php|₱/.test(c)) return 'price';
  if (/name|item|package|product|diamond|denom/.test(c)) return 'name';
  if (/status|stock|avail/.test(c)) return 'status';
  if (/note|remark|desc/.test(c)) return 'notes';
  return null;
}

// "11 Diamonds – ₱11", "11 Diamonds - 11", "11 Diamonds: ₱11", "11 Diamonds ₱11"
const LINE_RE = /^(.+?)\s*(?:[–—:|=]|\s-\s|\s(?=₱))\s*₱?\s*([\d,]+(?:\.\d+)?)\s*$/;

export function parsePricelist(text: string): ParseResult {
  const errors: string[] = [];
  const rows: ParsedRow[] = [];
  const lines = text.replace(/\r/g, '').split('\n');
  const isTabular = lines.some((l) => l.includes('\t'));

  let cols: Col[] | null = null; // set only when a header row is detected
  let headerSeen = false;
  const seenCols = new Set<Col>(['name', 'price']);

  lines.forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const line = rawLine.trimEnd();
    if (!line.trim()) return;
    // Skip bare list numbers like "1." on their own line
    if (/^\s*\d+[.)]\s*$/.test(line)) return;

    if (isTabular) {
      const cells = line.split('\t').map((c) => c.trim());

      // First non-empty row: treat as header if it names columns and has no numeric price in col 2
      if (!headerSeen) {
        headerSeen = true;
        const mapped = cells.map(headerCol);
        if (mapped.includes('name') && mapped.includes('price') && parseMoney(cells[1] ?? '') === null) {
          cols = mapped.map((m) => m ?? ('' as Col));
          return;
        }
      }

      if (cols) {
        // Header mode: columns are known by name; a blank cell in a declared column clears that field
        const hdr = cols;
        const get = (c: Col) => {
          const i = hdr.indexOf(c);
          return i === -1 ? undefined : (cells[i] ?? '');
        };
        const name = (get('name') ?? '').replace(/^\d+[.)]\s+/, '').trim();
        const priceRaw = get('price') ?? '';
        if (!name && !priceRaw) return;
        if (!name) { errors.push(`Line ${lineNo}: missing item name.`); return; }
        const price = parseMoney(priceRaw);
        if (price === null) { errors.push(`Line ${lineNo} (${name}): "${priceRaw}" is not a valid price.`); return; }

        const row: ParsedRow = { line: lineNo, name, price };
        const orig = get('originalPrice');
        if (orig !== undefined) {
          if (orig === '') row.originalPrice = null;
          else {
            const o = parseMoney(orig);
            if (o === null) { errors.push(`Line ${lineNo} (${name}): "${orig}" is not a valid original price.`); return; }
            row.originalPrice = o;
          }
        }
        const status = get('status');
        if (status !== undefined) row.status = parseStatus(status);
        const notes = get('notes');
        if (notes !== undefined) row.notes = notes || null;
        rows.push(row);
        return;
      }

      // No header: Name, Price, then each extra non-empty cell is classified by its content
      // (number → original price, "sold out"/"available" → status, anything else → notes).
      // Absent cells leave existing values untouched.
      const name = (cells[0] ?? '').replace(/^\d+[.)]\s+/, '').trim();
      const priceRaw = cells[1] ?? '';
      if (!name && !priceRaw) return;
      if (!name) { errors.push(`Line ${lineNo}: missing item name.`); return; }
      const price = parseMoney(priceRaw);
      if (price === null) { errors.push(`Line ${lineNo} (${name}): "${priceRaw}" is not a valid price.`); return; }
      const row: ParsedRow = { line: lineNo, name, price };
      for (const cell of cells.slice(2)) {
        if (!cell) continue;
        const money = parseMoney(cell);
        const status = parseStatus(cell);
        if (money !== null && row.originalPrice === undefined) { row.originalPrice = money; seenCols.add('originalPrice'); }
        else if (status && row.status === undefined) { row.status = status; seenCols.add('status'); }
        else { row.notes = row.notes ? `${row.notes} · ${cell}` : cell; seenCols.add('notes'); }
      }
      rows.push(row);
    } else {
      const text = line.trim().replace(/^\d+[.)]\s+/, '');
      const m = text.match(LINE_RE);
      if (!m) { errors.push(`Line ${lineNo}: couldn't read "${text}". Use "Name – ₱Price" or paste from a sheet.`); return; }
      const price = parseMoney(m[2]);
      if (price === null) { errors.push(`Line ${lineNo}: invalid price in "${text}".`); return; }
      rows.push({ line: lineNo, name: m[1].trim(), price });
    }
  });

  // Duplicate names: keep the last one, warn
  const seen = new Map<string, number>();
  rows.forEach((r, i) => {
    const k = normalizeName(r.name);
    if (seen.has(k)) errors.push(`"${r.name}" appears more than once — the last one (line ${r.line}) will be used.`);
    seen.set(k, i);
  });
  const deduped = rows.filter((r, i) => seen.get(normalizeName(r.name)) === i);

  const presentCols = cols ? POSITIONAL.filter((c) => cols!.includes(c)) : POSITIONAL.filter((c) => seenCols.has(c));
  return { rows: deduped, errors, columns: presentCols.map((c) => COL_LABEL[c]) };
}
