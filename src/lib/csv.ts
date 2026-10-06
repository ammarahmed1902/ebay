import Papa from "papaparse";
import type { DeliveryFields, Order, ShippingExportRow } from "@/lib/types";
import { SHIPPING_EXPORT_HEADERS } from "@/lib/types";

type LogicalField =
  | keyof DeliveryFields
  | "orderNumber"
  | "buyerUsername"
  | "salesRecordNumber"
  | "itemTitle"
  | "quantity";

export function compactHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, "")
    .replace(/\u0000/g, "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<LogicalField, string[]> = {
  orderNumber: [
    "order number",
    "ordernumber",
    "order no",
    "order id",
    "orderid",
    "ebay order number",
    "ebay order id",
    "legacy order id",
  ],
  buyerUsername: [
    "buyer username",
    "buyer user name",
    "user id",
    "userid",
    "username",
  ],
  salesRecordNumber: [
    "sales record number",
    "sales record no",
    "salesrecordnumber",
    "sale record number",
  ],
  itemTitle: ["item title", "title"],
  quantity: ["quantity", "qty"],
  postToName: [
    "post to name",
    "ship to name",
    "recipient name",
    "shipto name",
  ],
  postToPhone: [
    "post to phone",
    "ship to phone",
    "recipient phone",
    "buyer phone number",
  ],
  postToAddress1: [
    "post to address 1",
    "post to address1",
    "ship to address 1",
    "ship to address1",
  ],
  postToAddress2: [
    "post to address 2",
    "post to address2",
    "ship to address 2",
    "ship to address2",
  ],
  postToCity: ["post to city", "ship to city", "post to town", "ship to town"],
  postToCounty: [
    "post to county",
    "ship to county",
    "post to state",
    "ship to state",
  ],
  postToPostcode: [
    "post to postcode",
    "post to postal code",
    "ship to postcode",
    "ship to postal code",
    "post to zip",
    "ship to zip",
  ],
  postToCountry: ["post to country", "ship to country"],
};

const COMPACT_TO_FIELD = new Map<string, LogicalField>();
for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
  [LogicalField, string[]]
>) {
  for (const alias of aliases) {
    COMPACT_TO_FIELD.set(compactHeader(alias), field);
  }
}

function fieldForHeader(header: string): LogicalField | null {
  return COMPACT_TO_FIELD.get(compactHeader(header)) ?? null;
}

export function normalizeCsvText(text: string): string {
  let value = text.replace(/^\uFEFF/, "");
  if (value.includes("\u0000")) {
    value = value.replace(/\u0000/g, "");
  }
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function parseMatrix(
  text: string,
  delimiter?: string,
): { rows: string[][]; delimiter: string } {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: "greedy",
    delimiter: delimiter ?? "",
  });
  const rows = (parsed.data ?? []).filter((row) =>
    row.some((value) => String(value ?? "").replace(/\u0000/g, "").trim() !== ""),
  );
  return {
    rows,
    delimiter: parsed.meta.delimiter || delimiter || ",",
  };
}

function headerScore(cells: string[]): number {
  const fields = new Set(
    cells.map(fieldForHeader).filter((field): field is LogicalField => field != null),
  );
  if (fields.size === 0) return 0;
  let score = fields.size;
  if (fields.has("orderNumber")) score += 4;
  if (fields.has("salesRecordNumber")) score += 3;
  if (fields.has("postToName")) score += 2;
  if (fields.has("postToAddress1")) score += 2;
  return score;
}

function findHeaderRowIndex(rows: string[][]): number {
  let bestIndex = -1;
  let bestScore = 0;
  const limit = Math.min(rows.length, 25);
  for (let index = 0; index < limit; index += 1) {
    const row = rows[index] ?? [];
    if (row.length === 1 && /^sep=./i.test(row[0]?.trim() ?? "")) continue;
    const fields = new Set(
      row.map(fieldForHeader).filter((field): field is LogicalField => field != null),
    );
    if (!fields.has("orderNumber") && !fields.has("salesRecordNumber")) {
      continue;
    }
    const score = headerScore(row);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

function cleanCell(value: string): string {
  let next = String(value ?? "").replace(/\u0000/g, "").trim();
  if (next.startsWith('="') && next.endsWith('"')) {
    next = next.slice(2, -1);
  }
  if (
    (next.startsWith('"') && next.endsWith('"')) ||
    (next.startsWith("'") && next.endsWith("'"))
  ) {
    next = next.slice(1, -1);
  }
  if (next.startsWith("'")) next = next.slice(1);
  return next.trim();
}

function readCell(row: string[], index: number | undefined): string {
  if (index == null) return "";
  return cleanCell(row[index] ?? "");
}

function columnIndex(
  headers: string[],
  field: LogicalField,
): number | undefined {
  const index = headers.findIndex((header) => fieldForHeader(header) === field);
  return index >= 0 ? index : undefined;
}

function isHeaderLikeValue(value: string, field: LogicalField): boolean {
  return fieldForHeader(value) === field;
}

function isReportMetadataIdentity(value: string): boolean {
  const normalized = value.trim().replace(/\s+/g, " ");
  return (
    /^(?:\d+\s+)?records?(?:\s*\(s\))?\s+downloaded$/i.test(normalized) ||
    /^seller\s*id\s*:/i.test(normalized)
  );
}

export type ParsedCsv = {
  rows: Record<string, string>[];
  headers: string[];
  warnings: string[];
  delimiter: string;
};

export function parseCsvText(text: string): ParsedCsv {
  const normalized = normalizeCsvText(text);
  const attempts: Array<string | undefined> = [undefined, ",", "\t", ";", "|"];
  let best: {
    headers: string[];
    records: Record<string, string>[];
    delimiter: string;
    identityCount: number;
  } | null = null;

  for (const delimiter of attempts) {
    const matrix = parseMatrix(normalized, delimiter);
    if (matrix.rows.length === 0) continue;
    const headerIndex = findHeaderRowIndex(matrix.rows);
    if (headerIndex < 0) continue;
    const headers = matrix.rows[headerIndex] ?? [];
    const orderIndex = columnIndex(headers, "orderNumber");
    const salesIndex = columnIndex(headers, "salesRecordNumber");
    const records: Record<string, string>[] = [];
    let identityCount = 0;

    for (const raw of matrix.rows.slice(headerIndex + 1)) {
      const object: Record<string, string> = {};
      headers.forEach((header, index) => {
        const key = header.replace(/\u0000/g, "").trim() || `column_${index + 1}`;
        object[key] = String(raw[index] ?? "").replace(/\u0000/g, "");
      });
      const orderNumber = readCell(raw, orderIndex);
      const salesRecord = readCell(raw, salesIndex);
      if (
        isHeaderLikeValue(orderNumber, "orderNumber") ||
        isHeaderLikeValue(salesRecord, "salesRecordNumber")
      ) {
        continue;
      }
      if (orderNumber || salesRecord) identityCount += 1;
      if (Object.values(object).some((value) => value.trim() !== "")) {
        records.push(object);
      }
    }

    if (
      !best ||
      identityCount > best.identityCount ||
      (identityCount === best.identityCount &&
        records.length > best.records.length)
    ) {
      best = {
        headers,
        records,
        delimiter: matrix.delimiter,
        identityCount,
      };
    }
    if (identityCount > 0 && delimiter === undefined) {
      break;
    }
  }

  if (!best) {
    return { rows: [], headers: [], warnings: [], delimiter: "," };
  }

  return {
    rows: best.records,
    headers: best.headers,
    warnings: [],
    delimiter: best.delimiter,
  };
}

export function mapCsvRow(
  row: Record<string, string>,
  sourceRowIndex: number,
): Omit<Order, "extraRowCount"> {
  const byField: Partial<Record<LogicalField, string>> = {};
  for (const [header, value] of Object.entries(row)) {
    const field = fieldForHeader(header);
    if (!field || byField[field]) continue;
    const rawValue = String(value ?? "").replace(/\u0000/g, "");
    byField[field] =
      field === "orderNumber" || field === "salesRecordNumber"
        ? cleanCell(rawValue)
        : rawValue;
  }

  const orderNumber =
    (byField.orderNumber ?? "").trim() ||
    (byField.salesRecordNumber ?? "").trim();

  return {
    orderNumber,
    buyerUsername: byField.buyerUsername ?? "",
    salesRecordNumber: byField.salesRecordNumber ?? "",
    itemTitle: byField.itemTitle ?? "",
    quantity: byField.quantity ?? "",
    sourceRowIndex,
    delivery: {
      postToName: byField.postToName ?? "",
      postToPhone: byField.postToPhone ?? "",
      postToAddress1: byField.postToAddress1 ?? "",
      postToAddress2: byField.postToAddress2 ?? "",
      postToCity: byField.postToCity ?? "",
      postToCounty: byField.postToCounty ?? "",
      postToPostcode: byField.postToPostcode ?? "",
      postToCountry: byField.postToCountry ?? "",
    },
    raw: row,
  };
}

export function csvHasOrderIdentity(headers: string[]): boolean {
  return headers.some((header) => {
    const field = fieldForHeader(header);
    return field === "orderNumber" || field === "salesRecordNumber";
  });
}

export function csvHasOrderNumber(headers: string[]): boolean {
  return csvHasOrderIdentity(headers);
}

export function groupFirstRowPerOrder(
  rows: Record<string, string>[],
): { orders: Order[]; skippedEmptyOrderRows: number } {
  const orders: Order[] = [];
  const byNumber = new Map<string, Order>();
  let skippedEmptyOrderRows = 0;

  rows.forEach((row, index) => {
    const mapped = mapCsvRow(row, index);
    if (!mapped.orderNumber) {
      skippedEmptyOrderRows += 1;
      return;
    }
    if (isReportMetadataIdentity(mapped.orderNumber)) return;

    const existing = byNumber.get(mapped.orderNumber);
    if (existing) {
      existing.extraRowCount += 1;
      return;
    }

    const order: Order = { ...mapped, extraRowCount: 0 };
    byNumber.set(mapped.orderNumber, order);
    orders.push(order);
  });

  return { orders, skippedEmptyOrderRows };
}

export function toShippingRow(order: Order): ShippingExportRow {
  return {
    Name: order.delivery.postToName,
    Telephone: order.delivery.postToPhone,
    "Address line 1": order.delivery.postToAddress1,
    "Address line 2": order.delivery.postToAddress2,
    City: order.delivery.postToCity,
    County: order.delivery.postToCounty,
    Postcode: order.delivery.postToPostcode,
    Country: order.delivery.postToCountry,
    Reference: order.orderNumber,
    "Buyer username": order.buyerUsername,
  };
}

export function buildShippingCsv(
  orders: Order[],
  excludedOrderNumbers: Iterable<string>,
): { csv: string; rows: ShippingExportRow[] } {
  const excluded = new Set(excludedOrderNumbers);
  const rows = orders
    .filter((order) => !excluded.has(order.orderNumber))
    .map(toShippingRow);

  const csv = Papa.unparse({
    fields: [...SHIPPING_EXPORT_HEADERS],
    data: rows.map((row) =>
      SHIPPING_EXPORT_HEADERS.map((header) => row[header]),
    ),
  });

  return { csv, rows };
}

export function buildCsvFromRecords(
  headers: string[],
  records: Array<Record<string, string>>,
): string {
  return Papa.unparse({
    fields: headers,
    data: records.map((record) => headers.map((header) => record[header] ?? "")),
  });
}

export function decodeCsvBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(bytes);
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xef &&
    bytes[1] === 0xbb &&
    bytes[2] === 0xbf
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }

  let nulls = 0;
  const sample = Math.min(bytes.length, 200);
  for (let index = 1; index < sample; index += 2) {
    if (bytes[index] === 0) nulls += 1;
  }
  if (sample > 10 && nulls / Math.floor(sample / 2) > 0.6) {
    return new TextDecoder("utf-16le").decode(bytes);
  }

  return new TextDecoder("utf-8").decode(bytes);
}
