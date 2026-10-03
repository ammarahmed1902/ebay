import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { normalizeCountry } from "@/lib/normalize";
import type { ShippingSettings } from "@/lib/shipping-settings";
import type { Order } from "@/lib/types";

export const TEMPLATE_PUBLIC_PATH = "/ebay-live-shipping-template.xlsx";

const TEXT_HEADERS = new Set([
  "senderContactNumber",
  "senderPostcode",
  "recipientContactName",
  "recipientContactNumber",
  "recipientLine1",
  "recipientLine2",
  "recipientPostcode",
  "Reference",
]);

const NUMERIC_HEADERS = new Set([
  "numberOfPackages",
  "packageWeight",
  "length",
  "width",
  "height",
  "commodityQuantity",
  "commodityWeight",
  "customsValue",
]);

export type TemplateRowValues = Record<string, string | number | "">;

export type ShippingCell = {
  type: string;
  value: string;
};

export type ShippingWorkbookView = {
  sheetName: string;
  headers: string[];
  columnCount: number;
  row1Xml: string;
  colsXml: string;
  stylesXml: string;
  row1Height: string | null;
  dataRowNumbers: number[];
  dataRows: ShippingCell[][];
  textContent: string;
};

export class TemplateFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateFormatError";
  }
}

const UNREADABLE_TEMPLATE =
  "The shipping Excel template could not be read. Export is blocked until ebay-live-shipping-template.xlsx is available and its header layout can be preserved.";

export function literalSpreadsheetText(value: string): string {
  if (/^[\t\r\n ]*[=+\-@]/.test(value)) return `'${value}`;
  return value;
}

export function recipientCountryCode(raw: string): string {
  const normalized = normalizeCountry(raw);
  if (/^[A-Z]{2}$/.test(normalized)) return normalized;
  return raw.trim();
}

export function mapOrderToTemplateRow(
  order: Order,
  settings: ShippingSettings,
): TemplateRowValues {
  const delivery = order.delivery;
  const itemDescription =
    settings.itemDescription.trim() !== ""
      ? settings.itemDescription
      : order.itemTitle;

  return {
    serviceType: settings.serviceType,
    shipmentType: settings.shipmentType,
    senderContactName: settings.senderContactName,
    senderCompany: settings.senderCompany,
    senderContactNumber: settings.senderContactNumber,
    senderLine1: settings.senderLine1,
    senderPostcode: settings.senderPostcode,
    senderCity: settings.senderCity,
    senderState: settings.senderState,
    senderCountry: settings.senderCountry,
    senderEmail: settings.senderEmail,
    recipientContactName: delivery.postToName,
    recipientContactNumber: delivery.postToPhone,
    recipientLine1: delivery.postToAddress1,
    recipientLine2: delivery.postToAddress2,
    recipientPostcode: delivery.postToPostcode,
    recipientCity: delivery.postToCity,
    recipientState: delivery.postToCounty,
    recipientCountry: recipientCountryCode(delivery.postToCountry),
    numberOfPackages: settings.numberOfPackages,
    packageWeight: settings.packageWeight,
    weightUnits: settings.weightUnits,
    length: settings.length,
    width: settings.width,
    height: settings.height,
    etdEnabled: settings.etdEnabled,
    packageType: settings.packageType,
    currencyType: settings.currencyType,
    commodityType: settings.commodityType,
    itemDescription,
    manufacturingCountry: settings.manufacturingCountry,
    commodityQuantity: settings.commodityQuantity,
    commodityMeasureUnit: settings.commodityMeasureUnit,
    commodityWeight: settings.commodityWeight,
    customsValue: settings.customsValue,
    purposeOfShipment: settings.purposeOfShipment,
    generateInvoice: settings.generateInvoice,
    Reference: order.orderNumber,
  };
}

export function readShippingTemplate(
  templateBuffer: ArrayBuffer,
): ShippingWorkbookView {
  return openShippingWorkbook(templateBuffer);
}

export function assertTemplatePreserved(
  source: ShippingWorkbookView,
  output: ShippingWorkbookView,
): void {
  const problems: string[] = [];
  if (source.sheetName !== output.sheetName) problems.push("worksheet name");
  if (
    source.columnCount !== output.columnCount ||
    source.headers.some((header, index) => header !== output.headers[index])
  ) {
    problems.push("Row 1 headers");
  }
  if (source.row1Xml !== output.row1Xml || source.row1Height !== output.row1Height) {
    problems.push("Row 1 formatting");
  }
  if (source.colsXml !== output.colsXml) problems.push("column widths");
  if (source.stylesXml !== output.stylesXml) problems.push("header styles");
  if (problems.length > 0) {
    throw new TemplateFormatError(
      `The export could not preserve the template's ${problems.join(", ")}. Export is blocked.`,
    );
  }
}

export function templatePreviewRows(
  orders: Order[],
  excludedOrderNumbers: Iterable<string>,
  settings: ShippingSettings,
  limit = 25,
): TemplateRowValues[] {
  const excluded = new Set(excludedOrderNumbers);
  return orders
    .filter((order) => !excluded.has(order.orderNumber))
    .slice(0, limit)
    .map((order) => mapOrderToTemplateRow(order, settings));
}

export async function loadTemplateBufferFromPublic(
  baseUrl = "",
): Promise<ArrayBuffer> {
  try {
    const response = await fetch(`${baseUrl}${TEMPLATE_PUBLIC_PATH}`);
    if (!response.ok) {
      throw new TemplateFormatError(UNREADABLE_TEMPLATE);
    }
    return response.arrayBuffer();
  } catch (error) {
    if (error instanceof TemplateFormatError) throw error;
    throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  }
}

export async function buildShippingWorkbookBuffer(options: {
  orders: Order[];
  excludedOrderNumbers: Iterable<string>;
  settings: ShippingSettings;
  templateBuffer: ArrayBuffer;
}): Promise<ArrayBuffer> {
  const source = openShippingWorkbook(options.templateBuffer);
  const excluded = new Set(options.excludedOrderNumbers);
  const included = options.orders.filter(
    (order) => !excluded.has(order.orderNumber),
  );
  const files = unzipTemplate(options.templateBuffer);
  const { sheetPath, sharedStrings } = locateTemplateParts(files);
  const sheetXml = strFromU8(files[sheetPath]);
  const row1Xml = source.row1Xml;
  const dataXml = included
    .map((order, index) =>
      dataRowXml(
        index + 2,
        source.headers,
        mapOrderToTemplateRow(order, options.settings),
      ),
    )
    .join("");
  const nextSheet = replaceSheetData(sheetXml, row1Xml, dataXml, source.columnCount, included.length);
  files[sheetPath] = strToU8(nextSheet);
  if (sharedStrings) {
    files["xl/sharedStrings.xml"] = strToU8(
      blankUnusedSharedStrings(strFromU8(sharedStrings), sharedStringIndexes(row1Xml)),
    );
  }

  const zipped = zipSync(files);
  const output = zipped.buffer.slice(
    zipped.byteOffset,
    zipped.byteOffset + zipped.byteLength,
  ) as ArrayBuffer;
  assertTemplatePreserved(source, openShippingWorkbook(output));
  return output;
}

function dataRowXml(
  rowNumber: number,
  headers: string[],
  values: TemplateRowValues,
): string {
  const cells = headers.map((header, index) => {
    const raw = header === "" ? "" : (values[header] ?? "");
    return cellXml(index + 1, rowNumber, header, raw === "" ? "" : String(raw));
  });
  return `<row r="${rowNumber}" spans="1:${headers.length}">${cells.join("")}</row>`;
}

function cellXml(
  column: number,
  rowNumber: number,
  header: string,
  value: string,
): string {
  const ref = `${columnLetter(column)}${rowNumber}`;
  if (
    !TEXT_HEADERS.has(header) &&
    NUMERIC_HEADERS.has(header) &&
    /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)
  ) {
    return `<c r="${ref}"><v>${value}</v></c>`;
  }
  const text = literalSpreadsheetText(value);
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function replaceSheetData(
  sheetXml: string,
  row1Xml: string,
  dataXml: string,
  columnCount: number,
  dataRowCount: number,
): string {
  const sheetData = /<sheetData>[\s\S]*?<\/sheetData>/.exec(sheetXml);
  if (!sheetData || !sheetData[0].includes(row1Xml)) {
    throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  }
  const replaced = `${sheetXml.slice(0, sheetData.index)}<sheetData>${row1Xml}${dataXml}</sheetData>${sheetXml.slice(sheetData.index + sheetData[0].length)}`;
  const lastRow = Math.max(1, dataRowCount + 1);
  const ref = `A1:${columnLetter(columnCount)}${lastRow}`;
  return replaced.replace(/<dimension\b([^>]*)\/>/, (_match, attrs: string) => {
    const nextAttrs = /\bref="/.test(attrs)
      ? attrs.replace(/\bref="[^"]*"/, ` ref="${ref}"`)
      : ` ref="${ref}"${attrs}`;
    return `<dimension${nextAttrs}/>`;
  });
}

export function openShippingWorkbook(
  templateBuffer: ArrayBuffer,
): ShippingWorkbookView {
  const files = unzipTemplate(templateBuffer);
  const { sheetPath, sheetName } = locateTemplateParts(files);
  const sheetXml = strFromU8(files[sheetPath]);
  const stylesXml = strFromU8(mustFile(files, "xl/styles.xml"));
  const sharedXml = files["xl/sharedStrings.xml"]
    ? strFromU8(files["xl/sharedStrings.xml"])
    : "";
  const strings = sharedXml ? parseSharedStrings(sharedXml) : [];
  const row1Xml = extractRowXml(sheetXml, 1);
  if (!row1Xml) {
    throw new TemplateFormatError(
      "The shipping template is missing Row 1, so its header layout cannot be preserved. Export is blocked.",
    );
  }
  const parsedCells = parseRowCells(row1Xml, strings);
  const columnCount = headerColumnCount(row1Xml, parsedCells);
  if (columnCount < 1) {
    throw new TemplateFormatError(
      "The shipping template has no header columns. Export is blocked.",
    );
  }
  const headers = Array.from({ length: columnCount }, (_value, index) => {
    return parsedCells.find((cell) => cell.column === index + 1)?.value ?? "";
  });
  const dataRowNumbers = rowNumbers(sheetXml).filter((rowNumber) => rowNumber >= 2);
  const dataRows = dataRowNumbers.map((rowNumber) => {
    const rowXml = extractRowXml(sheetXml, rowNumber) ?? "";
    const cells = parseRowCells(rowXml, strings);
    return Array.from({ length: columnCount }, (_value, index) => {
      const cell = cells.find((item) => item.column === index + 1);
      return { type: cell?.type ?? "", value: cell?.value ?? "" };
    });
  });

  return {
    sheetName,
    headers,
    columnCount,
    row1Xml,
    colsXml: /<cols>[\s\S]*?<\/cols>/.exec(sheetXml)?.[0] ?? "",
    stylesXml,
    row1Height: /\bht="([^"]+)"/.exec(row1Xml)?.[1] ?? null,
    dataRowNumbers,
    dataRows,
    textContent: Object.values(files).map((bytes) => bytesToLatin1(bytes)).join("\n"),
  };
}

function unzipTemplate(templateBuffer: ArrayBuffer): Record<string, Uint8Array> {
  try {
    const bytes = new Uint8Array(templateBuffer);
    if (bytes.byteLength < 4) throw new Error("too small");
    return unzipSync(bytes);
  } catch (error) {
    if (error instanceof TemplateFormatError) throw error;
    throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  }
}

function locateTemplateParts(files: Record<string, Uint8Array>): {
  sheetPath: string;
  sheetName: string;
  sharedStrings: Uint8Array | undefined;
} {
  const workbookXml = strFromU8(mustFile(files, "xl/workbook.xml"));
  const sheetTags = [...workbookXml.matchAll(/<sheet\b([^>]*)\/>/g)];
  if (sheetTags.length !== 1) {
    throw new TemplateFormatError(
      "The shipping template must contain its original worksheet so the export layout can be preserved. Export is blocked.",
    );
  }
  const attrs = sheetTags[0][1] ?? "";
  const sheetName = /name="([^"]*)"/.exec(attrs)?.[1];
  const relationId = /r:id="([^"]+)"/.exec(attrs)?.[1];
  if (!sheetName || !relationId) {
    throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  }
  const rels = strFromU8(mustFile(files, "xl/_rels/workbook.xml.rels"));
  const relation = new RegExp(
    `<Relationship\\b[^>]*\\bId="${escapeRegExp(relationId)}"[^>]*\\/>`,
  ).exec(rels);
  const target = relation ? /Target="([^"]+)"/.exec(relation[0])?.[1] : undefined;
  if (!target) throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  const sheetPath = resolveSheetPath(target);
  if (!files[sheetPath]) throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  return {
    sheetPath,
    sheetName,
    sharedStrings: files["xl/sharedStrings.xml"],
  };
}

function resolveSheetPath(target: string): string {
  const cleaned = target.replace(/\\/g, "/");
  if (cleaned.startsWith("/")) return cleaned.slice(1);
  if (cleaned.startsWith("xl/")) return cleaned;
  return `xl/${cleaned}`;
}

function mustFile(files: Record<string, Uint8Array>, path: string): Uint8Array {
  const file = files[path];
  if (!file) throw new TemplateFormatError(UNREADABLE_TEMPLATE);
  return file;
}

function extractRowXml(sheetXml: string, rowNumber: number): string | null {
  return new RegExp(`<row r="${rowNumber}"[\\s>][\\s\\S]*?<\\/row>`).exec(sheetXml)?.[0] ?? null;
}

function rowNumbers(sheetXml: string): number[] {
  return [...sheetXml.matchAll(/<row r="(\d+)"/g)].map((match) => Number(match[1]));
}

function headerColumnCount(
  rowXml: string,
  cells: Array<{ column: number }>,
): number {
  const spans = /\bspans="(\d+):(\d+)"/.exec(rowXml);
  const spanEnd = spans ? Number(spans[2]) : 0;
  const maxCell = cells.reduce((max, cell) => Math.max(max, cell.column), 0);
  return Math.max(spanEnd, maxCell);
}

function parseRowCells(
  rowXml: string,
  sharedStrings: string[],
): Array<{ column: number; type: string; value: string }> {
  return [...rowXml.matchAll(/<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)].map(
    (match) => {
      const column = columnIndex(match[1]);
      const attrs = match[2] ?? "";
      const body = match[3] ?? "";
      if (/<f[\s>]/.test(body)) {
        return { column, type: "formula", value: "" };
      }
      const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? (body.includes("<v>") ? "n" : "");
      let value = "";
      if (type === "s") {
        const index = Number(/<v>(\d+)<\/v>/.exec(body)?.[1]);
        value = sharedStrings[index] ?? "";
      } else if (type === "inlineStr") {
        value = decodeXml(
          [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""),
        );
      } else if (type === "n" || type === "str") {
        value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "");
      }
      return { column, type, value };
    },
  );
}

function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeXml(
      [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => part[1]).join(""),
    ),
  );
}

function sharedStringIndexes(rowXml: string): Set<number> {
  const used = new Set<number>();
  for (const match of rowXml.matchAll(/<c\b[^>]*\bt="s"[^>]*>[\s\S]*?<\/c>/g)) {
    const index = /<v>(\d+)<\/v>/.exec(match[0]);
    if (index) used.add(Number(index[1]));
  }
  return used;
}

function blankUnusedSharedStrings(xml: string, used: Set<number>): string {
  let index = 0;
  return xml.replace(/<si\b[^>]*>[\s\S]*?<\/si>/g, (item) => {
    const current = index;
    index += 1;
    return used.has(current) ? item : "<si><t></t></si>";
  });
}

function columnLetter(index: number): string {
  let current = index;
  let letters = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    current = Math.floor((current - 1) / 26);
  }
  return letters;
}

function columnIndex(letters: string): number {
  let index = 0;
  for (const char of letters) {
    index = index * 26 + (char.charCodeAt(0) - 64);
  }
  return index;
}

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, digits: string) =>
      String.fromCodePoint(Number(digits)),
    )
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&amp;/g, "&");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function bytesToLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}
