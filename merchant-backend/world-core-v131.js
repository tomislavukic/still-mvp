const RECEIPT_NOISE = /^(ukupno|total|subtotal|porez|tax|pdv|vat|za platiti|payment|plaćanje|placanje|gotovina|cash|kartica|card|povrat|change|račun|racun|invoice|receipt|oib|iban|vrijeme|time|datum|date)\b/i;

export function clean(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeText(value) {
  return clean(value, 500)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function safeDate(value) {
  const candidate = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const date = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== candidate ? null : candidate;
}

export function parseMoneyToCents(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null;
  let text = clean(String(value), 40).replace(/[^\d,.-]/g, '');
  if (!text) return null;
  const comma = text.lastIndexOf(','), dot = text.lastIndexOf('.');
  if (comma > dot) text = text.replace(/\./g, '').replace(',', '.');
  else text = text.replace(/,/g, '');
  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) : null;
}

export function detectCurrency(text, fallback = null) {
  const value = String(text || '');
  if (/\b(?:EUR)\b|€/i.test(value)) return 'EUR';
  if (/\b(?:USD)\b|\$/i.test(value)) return 'USD';
  if (/\b(?:GBP)\b|£/i.test(value)) return 'GBP';
  if (/\bHRK\b|\bkn\b/i.test(value)) return 'HRK';
  return fallback && /^[A-Z]{3}$/.test(fallback) ? fallback : null;
}

function receiptDate(text) {
  let match = String(text || '').match(/\b(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})\b/);
  if (match) return safeDate(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`);
  match = String(text || '').match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](20\d{2})\b/);
  return match ? safeDate(`${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`) : null;
}

function moneyAtEnd(line) {
  const match = line.match(/(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:[.,]\d{2}))\s*(EUR|USD|GBP|HRK|€|\$|£|kn)?\s*$/i);
  return match ? { cents: parseMoneyToCents(match[1]), currency: detectCurrency(match[2]) } : null;
}

function receiptLines(lines, currency) {
  const items = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    const money = moneyAtEnd(line);
    if (!money || money.cents === null) continue;
    const label = line.slice(0, line.lastIndexOf(moneyAtEndText(line))).replace(/[\s:=-]+$/, '').trim();
    if (label.length < 2 || RECEIPT_NOISE.test(label) || !/[\p{L}]/u.test(label)) continue;
    const quantityMatch = label.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s*[xX]\s*(?:\d+[.,]\d{2})?\s*$/);
    const quantity = quantityMatch ? Number(quantityMatch[1].replace(',', '.')) : 1;
    const title = clean(quantityMatch ? label.slice(0, quantityMatch.index).trim() : label, 180);
    if (title.length < 2) continue;
    items.push({
      rawLabel: clean(line, 500),
      title,
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      totalCents: money.cents,
      unitPriceCents: quantity > 0 ? Math.round(money.cents / quantity) : money.cents,
      currency: money.currency || currency,
      confidence: /\d+[.,]\d{2}\s*$/.test(line) ? 0.72 : 0.58
    });
  }
  return items.slice(0, 100);
}

function moneyAtEndText(line) {
  return line.match(/(-?\d{1,3}(?:[.\s]\d{3})*(?:,\d{2})|-?\d+(?:[.,]\d{2}))\s*(?:EUR|USD|GBP|HRK|€|\$|£|kn)?\s*$/i)?.[1] || '';
}

export function parseReceiptText(rawText) {
  const raw = clean(String(rawText || ''), 150000);
  const lines = raw.split(/\r?\n+/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const joined = lines.join(' ');
  const currency = detectCurrency(joined);
  const totalCandidates = lines
    .filter(line => /\b(ukupno|total|za platiti|amount due)\b/i.test(line))
    .map(line => moneyAtEnd(line))
    .filter(candidate => candidate?.cents !== null);
  const subtotalCandidate = lines.find(line => /\b(subtotal|međuzbroj|meduzbroj|osnovica)\b/i.test(line));
  const taxCandidate = lines.find(line => /\b(tax|porez|pdv|vat)\b/i.test(line));
  const merchant = lines.slice(0, 8).find(line =>
    /[\p{L}]{3}/u.test(line) &&
    !/\b(receipt|invoice|račun|racun|oib|vat|pdv|date|datum|time|vrijeme)\b/i.test(line) &&
    !/^\d[\d\s.,:/-]+$/.test(line)
  ) || null;
  const items = receiptLines(lines, currency);
  const total = totalCandidates.at(-1) || (items.length ? { cents: items.reduce((sum, item) => sum + item.totalCents, 0), currency } : null);
  const reference = joined.match(/(?:broj\s+računa|broj\s+racuna|invoice|receipt|račun|racun|br\.?)[\s:#-]*([A-Z0-9\/-]{4,40})/i)?.[1] || null;
  return {
    merchant: merchant ? clean(merchant, 180) : null,
    purchaseDate: receiptDate(joined),
    currency: total?.currency || currency,
    subtotalCents: subtotalCandidate ? moneyAtEnd(subtotalCandidate)?.cents ?? null : null,
    taxCents: taxCandidate ? moneyAtEnd(taxCandidate)?.cents ?? null : null,
    totalCents: total?.cents ?? null,
    reference: clean(reference, 120) || null,
    items,
    confidence: {
      merchant: merchant ? 0.45 : 0,
      purchaseDate: receiptDate(joined) ? 0.85 : 0,
      total: totalCandidates.length ? 0.82 : items.length ? 0.55 : 0,
      lineItems: items.length ? Math.min(0.88, 0.55 + items.length * 0.03) : 0
    }
  };
}

export function validateImageBytes(bytes, mimeType) {
  const mime = clean(mimeType, 120).toLocaleLowerCase();
  if (mime.includes('heic') || mime.includes('heif')) return { ok: false, code: 'heic_not_supported' };
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const jpeg = b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const png = b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a;
  const webp = b.length > 12 && String.fromCharCode(...b.slice(0, 4)) === 'RIFF' && String.fromCharCode(...b.slice(8, 12)) === 'WEBP';
  const detected = jpeg ? 'image/jpeg' : png ? 'image/png' : webp ? 'image/webp' : null;
  if (!detected) return { ok: false, code: 'invalid_image_content' };
  if (mime && mime !== detected && !(mime === 'image/jpg' && detected === 'image/jpeg')) return { ok: false, code: 'mime_mismatch' };
  return { ok: true, mimeType: detected };
}

export function duplicateCandidates(things, draft) {
  const title = normalizeText(draft?.title), serial = normalizeText(draft?.serialNumber), gtin = clean(draft?.gtin, 32);
  return (things || []).map(thing => {
    const signals = [];
    if (serial && normalizeText(thing.serialNumber) === serial) signals.push({ type: 'serial_number', weight: 100 });
    if (gtin && clean(thing.gtin, 32) === gtin) signals.push({ type: 'gtin', weight: 100 });
    if (title && normalizeText(thing.title) === title) signals.push({ type: 'title', weight: 55 });
    if (draft?.purchaseDate && thing.purchaseDate === draft.purchaseDate) signals.push({ type: 'purchase_date', weight: 25 });
    if (draft?.receiptId && thing.receiptIds?.includes(draft.receiptId)) signals.push({ type: 'receipt', weight: 100 });
    const score = Math.min(100, signals.reduce((sum, signal) => sum + signal.weight, 0));
    return score >= 55 ? { publicId: thing.publicId, title: thing.title, score, signals } : null;
  }).filter(Boolean).sort((a, b) => b.score - a.score || a.publicId.localeCompare(b.publicId));
}

export function rankNow(items, referenceTime = Date.now()) {
  const reference = Number(referenceTime);
  return (items || []).map(item => {
    const due = item.dueAt ? new Date(item.dueAt).getTime() : NaN;
    const overdue = Number.isFinite(due) && due < reference;
    const dueSoon = Number.isFinite(due) && due >= reference && due - reference <= 7 * 86400000;
    const priority = overdue ? 0 : item.status === 'WAITING' ? 1 : dueSoon ? 2 : item.kind === 'situation' ? 3 : 4;
    return { ...item, overdue, dueSoon, priority };
  }).filter(item => !['COMPLETED', 'RESOLVED', 'ARCHIVED'].includes(item.status))
    .sort((a, b) => a.priority - b.priority || String(a.dueAt || '9999').localeCompare(String(b.dueAt || '9999')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')) || String(a.publicId).localeCompare(String(b.publicId)));
}

export function validLoopTransition(from, to) {
  const transitions = {
    OPEN: new Set(['IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']),
    IN_PROGRESS: new Set(['OPEN', 'WAITING', 'COMPLETED', 'CANCELLED']),
    WAITING: new Set(['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    COMPLETED: new Set(),
    CANCELLED: new Set(['OPEN'])
  };
  return from === to || Boolean(transitions[from]?.has(to));
}

export function safeSearchTerm(value) {
  return clean(value, 120).replace(/[%_]/g, match => `\\${match}`);
}
