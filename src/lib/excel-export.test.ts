import fs from "node:fs/promises";
import path from "node:path";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { createWorkspaceFromCsv } from "@/lib/workspace";
import { SAMPLE_CSV } from "@/lib/sample";
import {
  assertTemplatePreserved,
  buildShippingWorkbookBuffer,
  literalSpreadsheetText,
  loadTemplateBufferFromPublic,
  mapOrderToTemplateRow,
  openShippingWorkbook,
  TemplateFormatError,
  templatePreviewRows,
} from "@/lib/excel-export";
import { DEFAULT_SHIPPING_SETTINGS } from "@/lib/shipping-settings";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "public/ebay-live-shipping-template.xlsx",
);

const TEMPLATE_HEADERS = [
  "serviceType",
  "shipmentType",
  "senderContactName",
  "senderCompany",
  "senderContactNumber",
  "senderLine1",
  "senderPostcode",
  "senderCity",
  "senderState",
  "senderCountry",
  "senderEmail",
  "recipientContactName",
  "recipientContactNumber",
  "recipientLine1",
  "recipientLine2",
  "recipientPostcode",
  "recipientCity",
  "recipientState",
  "recipientCountry",
  "numberOfPackages",
  "packageWeight",
  "weightUnits",
  "length",
  "width",
  "height",
  "etdEnabled",
  "packageType",
  "currencyType",
  "commodityType",
  "itemDescription",
  "manufacturingCountry",
  "commodityQuantity",
  "commodityMeasureUnit",
  "commodityWeight",
  "customsValue",
  "purposeOfShipment",
  "generateInvoice",
  "Reference",
] as const;

async function readTemplateBuffer(): Promise<ArrayBuffer> {
  const file = await fs.readFile(TEMPLATE_PATH);
  return file.buffer.slice(
    file.byteOffset,
    file.byteOffset + file.byteLength,
  ) as ArrayBuffer;
}

function cell(
  view: ReturnType<typeof openShippingWorkbook>,
  rowIndex: number,
  header: string,
) {
  const column = view.headers.indexOf(header);
  return view.dataRows[rowIndex]?.[column];
}

describe("excel template source", () => {
  it("reads Row 1 from the supplied workbook", async () => {
    const template = openShippingWorkbook(await readTemplateBuffer());
    expect(template.sheetName).toBe("Ebay Live Shipping 24");
    expect(template.headers).toEqual([...TEMPLATE_HEADERS]);
    expect(template.columnCount).toBe(TEMPLATE_HEADERS.length);
    expect(template.row1Height).toBe("44");
    expect(template.row1Xml).toContain('ht="44"');
    expect(template.row1Xml).toContain('r="A1"');
    expect(template.colsXml).toContain('min="1" max="1" width="9.81640625"');
    expect(template.stylesXml).toContain('name val="Arial"');
    expect(template.dataRowNumbers[0]).toBe(2);
    expect(template.textContent).toContain("Musarat Bibi");
  });
});

describe("excel export structure", () => {
  it("preserves the template layout and replaces sample orders from Row 2", async () => {
    const templateBuffer = await readTemplateBuffer();
    const template = openShippingWorkbook(templateBuffer);
    const workspace = createWorkspaceFromCsv(
      [
        "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to address 2,Post to city,Post to county,Post to postcode,Post to country,Item title,Quantity",
        '000123,buyer_a,=Ada West,07700900999,1 High Street,W/N,Bath,Somerset,BA1 1NE,United Kingdom,Blue vase,1',
        "26-999-002,buyer_b,Bob Keene,01614960100,44 Canal Walk,,Manchester,Greater Manchester,M1 1AE,United Kingdom,Notebook,1",
      ].join("\n"),
      "orders.csv",
    );

    const outputBuffer = await buildShippingWorkbookBuffer({
      orders: workspace.orders,
      excludedOrderNumbers: [],
      settings: DEFAULT_SHIPPING_SETTINGS,
      templateBuffer,
    });
    const exported = openShippingWorkbook(outputBuffer);

    expect(exported.sheetName).toBe(template.sheetName);
    expect(exported.headers).toEqual(template.headers);
    expect(exported.columnCount).toBe(template.columnCount);
    expect(exported.row1Xml).toBe(template.row1Xml);
    expect(exported.row1Height).toBe(template.row1Height);
    expect(exported.colsXml).toBe(template.colsXml);
    expect(exported.stylesXml).toBe(template.stylesXml);
    expect(exported.dataRowNumbers).toEqual([2, 3]);
    expect(exported.row1Xml.startsWith('<row r="1"')).toBe(true);

    expect(cell(exported, 0, "Reference")).toEqual({
      type: "inlineStr",
      value: "000123",
    });
    expect(cell(exported, 0, "recipientContactNumber")).toEqual({
      type: "inlineStr",
      value: "07700900999",
    });
    expect(cell(exported, 0, "recipientPostcode")).toEqual({
      type: "inlineStr",
      value: "BA1 1NE",
    });
    expect(cell(exported, 0, "recipientLine2")).toEqual({
      type: "inlineStr",
      value: "W/N",
    });
    expect(cell(exported, 0, "senderPostcode")).toEqual({
      type: "inlineStr",
      value: DEFAULT_SHIPPING_SETTINGS.senderPostcode,
    });
    expect(cell(exported, 0, "senderContactNumber")?.type).toBe("inlineStr");
    expect(cell(exported, 0, "recipientContactName")?.value).toBe(
      literalSpreadsheetText("=Ada West"),
    );
    expect(cell(exported, 0, "recipientContactName")?.type).toBe("inlineStr");
    expect(cell(exported, 1, "Reference")?.value).toBe("26-999-002");
    expect(cell(exported, 0, "packageWeight")).toEqual({
      type: "n",
      value: DEFAULT_SHIPPING_SETTINGS.packageWeight,
    });
    expect(exported.dataRows.flat().some((item) => item.type === "formula")).toBe(
      false,
    );
    expect(exported.textContent).not.toContain("Musarat Bibi");
    expect(exported.textContent).not.toContain("ebay3zn38ta");
    expect(exported.textContent).not.toContain("26-15209-76449");
    expect(exported.textContent).not.toContain("Camomile");

    const preview = templatePreviewRows(
      workspace.orders,
      [],
      DEFAULT_SHIPPING_SETTINGS,
    );
    expect(template.headers.map((header) => String(preview[0]?.[header] ?? ""))).toContain(
      "000123",
    );
    expect(preview[0]?.recipientLine2).toBe("W/N");
  });

  it("keeps a blank template header in its original position", async () => {
    const templateBuffer = await readTemplateBuffer();
    const files = unzipSync(new Uint8Array(templateBuffer));
    const sheetPath = "xl/worksheets/sheet1.xml";
    const sheet = strFromU8(files[sheetPath]).replace(
      /<c r="D1"[^>]*>[\s\S]*?<\/c>/,
      "",
    );
    files[sheetPath] = strToU8(sheet);
    const zipped = zipSync(files);
    const modified = zipped.buffer.slice(
      zipped.byteOffset,
      zipped.byteOffset + zipped.byteLength,
    ) as ArrayBuffer;
    const modifiedView = openShippingWorkbook(modified);
    expect(modifiedView.headers[3]).toBe("");
    expect(modifiedView.headers[4]).toBe("senderContactNumber");

    const workspace = createWorkspaceFromCsv(
      [
        "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to city,Post to county,Post to postcode,Post to country",
        "A-1,buyer-one,One,07700900111,1 Street,York,N Yorkshire,YO1 7HH,United Kingdom",
      ].join("\n"),
      "orders.csv",
    );
    const output = openShippingWorkbook(
      await buildShippingWorkbookBuffer({
        orders: workspace.orders,
        excludedOrderNumbers: [],
        settings: DEFAULT_SHIPPING_SETTINGS,
        templateBuffer: modified,
      }),
    );
    expect(output.headers).toEqual(modifiedView.headers);
    expect(output.row1Xml).toBe(modifiedView.row1Xml);
    expect(output.columnCount).toBe(modifiedView.columnCount);
    expect(output.dataRows[0]?.[3]).toEqual({ type: "inlineStr", value: "" });
    expect(output.dataRowNumbers).toEqual([2]);
  });

  it("maps eBay delivery fields literally without formulas", () => {
    const workspace = createWorkspaceFromCsv(SAMPLE_CSV, "sample.csv");
    const order = workspace.orders[0]!;
    const row = mapOrderToTemplateRow(order, DEFAULT_SHIPPING_SETTINGS);
    expect(row.recipientContactName).toBe(order.delivery.postToName);
    expect(row.recipientLine2).toBe(order.delivery.postToAddress2);
    expect(row.Reference).toBe(order.orderNumber);
    expect(row.recipientCountry).toBe("GB");
    expect(literalSpreadsheetText("=cmd")).toBe("'=cmd");
    expect(literalSpreadsheetText("+44")).toBe("'+44");
    expect(literalSpreadsheetText("-note")).toBe("'-note");
    expect(literalSpreadsheetText("@sum")).toBe("'@sum");
  });

  it("respects explicit export exclusions", async () => {
    const templateBuffer = await readTemplateBuffer();
    const workspace = createWorkspaceFromCsv(
      [
        "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to address 2,Post to city,Post to county,Post to postcode,Post to country",
        "A-1,b1,One,07700 900111,1 Street,,York,N Yorkshire,YO1 7HH,United Kingdom",
        "B-1,b2,Two,07700 900222,2 Street,,Leeds,W Yorkshire,LS1 1BA,United Kingdom",
      ].join("\n"),
      "orders.csv",
    );

    const exported = openShippingWorkbook(
      await buildShippingWorkbookBuffer({
        orders: workspace.orders,
        excludedOrderNumbers: ["B-1"],
        settings: DEFAULT_SHIPPING_SETTINGS,
        templateBuffer,
      }),
    );
    expect(exported.dataRowNumbers).toEqual([2]);
    expect(cell(exported, 0, "Reference")?.value).toBe("A-1");
    expect(JSON.stringify(exported.dataRows)).not.toContain("B-1");
  });

  it("blocks export when the template is missing or its layout cannot be preserved", async () => {
    const orders = createWorkspaceFromCsv(
      [
        "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to city,Post to county,Post to postcode,Post to country",
        "A-1,buyer-one,One,07700900111,1 Street,York,N Yorkshire,YO1 7HH,United Kingdom",
      ].join("\n"),
      "orders.csv",
    ).orders;

    await expect(
      buildShippingWorkbookBuffer({
        orders,
        excludedOrderNumbers: [],
        settings: DEFAULT_SHIPPING_SETTINGS,
        templateBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
      }),
    ).rejects.toBeInstanceOf(TemplateFormatError);

    const emptyZip = zipSync({ "hello.txt": strToU8("no workbook") });
    await expect(
      buildShippingWorkbookBuffer({
        orders,
        excludedOrderNumbers: [],
        settings: DEFAULT_SHIPPING_SETTINGS,
        templateBuffer: emptyZip.buffer.slice(
          emptyZip.byteOffset,
          emptyZip.byteOffset + emptyZip.byteLength,
        ) as ArrayBuffer,
      }),
    ).rejects.toBeInstanceOf(TemplateFormatError);

    const templateBuffer = await readTemplateBuffer();
    const files = unzipSync(new Uint8Array(templateBuffer));
    const sheetPath = "xl/worksheets/sheet1.xml";
    files[sheetPath] = strToU8(
      strFromU8(files[sheetPath]).replace(/<row r="1"[\s>][\s\S]*?<\/row>/, ""),
    );
    const broken = zipSync(files);
    await expect(
      buildShippingWorkbookBuffer({
        orders,
        excludedOrderNumbers: [],
        settings: DEFAULT_SHIPPING_SETTINGS,
        templateBuffer: broken.buffer.slice(
          broken.byteOffset,
          broken.byteOffset + broken.byteLength,
        ) as ArrayBuffer,
      }),
    ).rejects.toThrow(/Row 1/);

    const template = openShippingWorkbook(templateBuffer);
    expect(() =>
      assertTemplatePreserved(template, {
        ...template,
        sheetName: "Renamed sheet",
        row1Height: "10",
      }),
    ).toThrow(/Export is blocked/);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(null, { status: 404 });
    await expect(loadTemplateBufferFromPublic()).rejects.toBeInstanceOf(
      TemplateFormatError,
    );
    globalThis.fetch = originalFetch;
  });
});
