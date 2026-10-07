import { describe, expect, it } from "vitest";
import { buildCsvFromRecords, buildShippingCsv } from "@/lib/csv";
import { SAMPLE_CSV, SAMPLE_FILE_NAME } from "@/lib/sample";
import {
  addManualOrder,
  createWorkspaceFromCsv,
  createWorkspaceFromCsvFiles,
  exportWorkspace,
  setGroupReviewed,
  setOrderExcluded,
  updateOrderDelivery,
} from "@/lib/workspace";
import type { DeliveryFields } from "@/lib/types";

const HEADERS = [
  "Order number",
  "Buyer username",
  "Post to name",
  "Post to phone",
  "Post to address 1",
  "Post to address 2",
  "Post to city",
  "Post to county",
  "Post to postcode",
  "Post to country",
  "Item title",
  "Quantity",
];

const BASE_DELIVERY = {
  "Post to name": "Riley Chen",
  "Post to phone": "07700 900001",
  "Post to address 1": "10 High Street",
  "Post to address 2": "W/N",
  "Post to city": "Oxford",
  "Post to county": "Oxfordshire",
  "Post to postcode": "OX1 1BP",
  "Post to country": "United Kingdom",
};

function csv(
  rows: Array<
    Partial<Record<(typeof HEADERS)[number], string>> & {
      "Order number": string;
    }
  >,
) {
  const records = rows.map((row, index) => ({
    "Order number": row["Order number"],
    "Buyer username": row["Buyer username"] ?? "shared_buyer",
    "Post to name": row["Post to name"] ?? BASE_DELIVERY["Post to name"],
    "Post to phone": row["Post to phone"] ?? BASE_DELIVERY["Post to phone"],
    "Post to address 1":
      row["Post to address 1"] ?? BASE_DELIVERY["Post to address 1"],
    "Post to address 2":
      row["Post to address 2"] ?? BASE_DELIVERY["Post to address 2"],
    "Post to city": row["Post to city"] ?? BASE_DELIVERY["Post to city"],
    "Post to county": row["Post to county"] ?? BASE_DELIVERY["Post to county"],
    "Post to postcode":
      row["Post to postcode"] ?? BASE_DELIVERY["Post to postcode"],
    "Post to country":
      row["Post to country"] ?? BASE_DELIVERY["Post to country"],
    "Item title": row["Item title"] ?? `Item ${index + 1}`,
    Quantity: row.Quantity ?? "1",
  }));
  return buildCsvFromRecords(HEADERS, records);
}

function deliveryFrom(
  workspaceOrderDelivery: DeliveryFields,
  patch: Partial<DeliveryFields>,
): DeliveryFields {
  return { ...workspaceOrderDelivery, ...patch };
}

describe("order grouping and totals", () => {
  it("rejects uploads missing essential buyer and delivery columns", () => {
    const text = buildCsvFromRecords(
      ["Order number", "Buyer username", "Post to name"],
      [
        {
          "Order number": "MISSING-1",
          "Buyer username": "buyer",
          "Post to name": "Buyer Name",
        },
      ],
    );

    expect(() => createWorkspaceFromCsv(text, "incomplete.csv")).toThrow(
      "Missing required buyer columns: Post to phone, Post to address 1, Post to postcode.",
    );
  });

  it("combines multiple CSV files and keeps the first occurrence of cross-file orders", () => {
    const workspace = createWorkspaceFromCsvFiles([
      {
        fileName: "first.csv",
        text: csv([
          { "Order number": "MULTI-1", "Post to name": "First version" },
          { "Order number": "MULTI-2" },
        ]),
      },
      {
        fileName: "second.csv",
        text: csv([
          { "Order number": "MULTI-1", "Post to name": "Second version" },
          { "Order number": "MULTI-3" },
        ]),
      },
    ]);

    expect(workspace.fileName).toBe("combined-2-files.csv");
    expect(workspace.orders.map((order) => order.orderNumber)).toEqual([
      "MULTI-1",
      "MULTI-2",
      "MULTI-3",
    ]);
    expect(workspace.orders[0]?.delivery.postToName).toBe("First version");
    expect(workspace.parseWarnings.join(" ")).toMatch(/MULTI-1/);
    expect(workspace.totals.includedExportOrders).toBe(3);
  });

  it("counts unique orders and repeated item rows without inflating orders", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "A-1", "Item title": "Mug" },
        { "Order number": "A-1", "Item title": "Saucer" },
        { "Order number": "A-1", "Item title": "Spoon" },
        { "Order number": "B-1", "Post to name": "Other Person" },
      ]),
      "orders.csv",
    );

    expect(workspace.totals.uniqueOrders).toBe(2);
    expect(workspace.totals.repeatedOrderRows).toBe(2);
    expect(workspace.orders.map((order) => order.orderNumber)).toEqual([
      "A-1",
      "B-1",
    ]);
    expect(workspace.orders[0]?.itemTitle).toBe("Mug");
    expect(workspace.orders[0]?.extraRowCount).toBe(2);
  });

  it("does not count empty Order numbers", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "A-1" },
        { "Order number": "", "Buyer username": "blank" },
      ]),
      "orders.csv",
    );
    expect(workspace.totals.uniqueOrders).toBe(1);
    expect(workspace.skippedEmptyOrderRows).toBe(1);
  });
});

describe("duplicate delivery detection", () => {
  it("groups different Order numbers when the five buyer fields match", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "DUP-1", "Buyer username": "same-buyer" },
        { "Order number": "DUP-2", "Buyer username": "same-buyer" },
      ]),
      "orders.csv",
    );

    expect(workspace.totals.duplicateGroups).toBe(1);
    expect(workspace.totals.ordersInDuplicateGroups).toBe(2);
    expect(workspace.groups[0]?.orders.map((order) => order.orderNumber)).toEqual(
      ["DUP-1", "DUP-2"],
    );
    expect(workspace.groups[0]?.classification).toBe("matching");
  });

  it("flags groups where only address line 2 differs, including eBay codes", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "L2-1", "Post to address 2": "Flat 2" },
        { "Order number": "L2-2", "Post to address 2": "COM24" },
      ]),
      "orders.csv",
    );

    expect(workspace.totals.duplicateGroups).toBe(1);
    expect(workspace.totals.groupsWithDifferentAddress2).toBe(1);
    expect(workspace.groups[0]?.classification).toBe("address2-differs");
    expect(workspace.groups[0]?.orders.map((order) => order.delivery.postToAddress2)).toEqual(
      ["Flat 2", "COM24"],
    );
  });

  it("treats blank versus populated address line 2 as a difference", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "BL-1", "Post to address 2": "" },
        { "Order number": "BL-2", "Post to address 2": "W/N" },
      ]),
      "orders.csv",
    );

    expect(workspace.groups).toHaveLength(1);
    expect(workspace.groups[0]?.classification).toBe("address2-differs");
    expect(workspace.totals.groupsWithDifferentAddress2).toBe(1);
  });

  it("puts three matching orders into one group of three", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "T-1" },
        { "Order number": "T-2" },
        { "Order number": "T-3" },
      ]),
      "orders.csv",
    );

    expect(workspace.totals.duplicateGroups).toBe(1);
    expect(workspace.totals.ordersInDuplicateGroups).toBe(3);
    expect(workspace.groups[0]?.orders).toHaveLength(3);
  });

  it("does not inflate duplicate counts with repeated item rows", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "R-1", "Item title": "First" },
        { "Order number": "R-1", "Item title": "Second" },
        { "Order number": "R-2", "Item title": "Other" },
      ]),
      "orders.csv",
    );

    expect(workspace.totals.uniqueOrders).toBe(2);
    expect(workspace.totals.repeatedOrderRows).toBe(1);
    expect(workspace.totals.duplicateGroups).toBe(1);
    expect(workspace.totals.ordersInDuplicateGroups).toBe(2);
  });

  it.each([
    ["Buyer username", "different-buyer"],
    ["Post to name", "Different Name"],
    ["Post to phone", "07700 900999"],
    ["Post to address 1", "99 Other Road"],
    ["Post to postcode", "CB1 1AA"],
  ] as const)("does not match when %s differs", (field, value) => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "D-1" },
        { "Order number": "D-2", [field]: value },
      ]),
      "orders.csv",
    );
    expect(workspace.groups).toHaveLength(0);
    expect(workspace.totals.duplicateGroups).toBe(0);
  });

  it("still matches when city, county, or country differs", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "PLACE-1" },
        {
          "Order number": "PLACE-2",
          "Post to city": "Cambridge",
          "Post to county": "Cambridgeshire",
          "Post to country": "France",
        },
      ]),
      "orders.csv",
    );
    expect(workspace.groups).toHaveLength(1);
  });

  it("does not create groups when required delivery fields are missing", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "M-1", "Post to phone": "" },
        { "Order number": "M-2", "Post to phone": "" },
      ]),
      "orders.csv",
    );
    expect(workspace.groups).toHaveLength(0);
  });

  it("normalizes formatting for matching but preserves original export values", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        {
          "Order number": "N-1",
          "Post to name": "  Casey  Rowe ",
          "Post to phone": "(07700) 900-888",
          "Post to address 1": "2  Mill   Lane",
          "Post to postcode": "ba1 1ne",
          "Post to country": "uk",
        },
        {
          "Order number": "N-2",
          "Post to name": "casey rowe",
          "Post to phone": "07700 900888",
          "Post to address 1": "2 Mill Lane",
          "Post to postcode": "BA1 1NE",
          "Post to country": "United Kingdom",
        },
      ]),
      "orders.csv",
    );

    expect(workspace.groups).toHaveLength(1);
    const { rows } = buildShippingCsv(workspace.orders, []);
    expect(rows[0]?.Name).toBe("  Casey  Rowe ");
    expect(rows[0]?.Telephone).toBe("(07700) 900-888");
    expect(rows[0]?.Postcode).toBe("ba1 1ne");
    expect(rows[0]?.Country).toBe("uk");
    expect(rows[1]?.Name).toBe("casey rowe");
    expect(rows[1]?.Postcode).toBe("BA1 1NE");
    expect(rows[1]?.Country).toBe("United Kingdom");
    expect(rows[0]?.Reference).toBe("N-1");
    expect(rows[1]?.Reference).toBe("N-2");
  });

  it("does not guess missing phone country codes", () => {
    const workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "P-1", "Post to phone": "07700900123" },
        { "Order number": "P-2", "Post to phone": "+447700900123" },
      ]),
      "orders.csv",
    );
    expect(workspace.groups).toHaveLength(0);
  });
});

describe("edits, review, and export", () => {
  it("creates a workspace from one manual order and rejects duplicate order numbers", () => {
    const input = {
      orderNumber: "MAN-1",
      buyerUsername: "manual_buyer",
      itemTitle: "Manual item",
      quantity: "1",
      delivery: {
        postToName: "Ava Reed",
        postToPhone: "07700 900333",
        postToAddress1: "3 Market Road",
        postToAddress2: "",
        postToCity: "Leeds",
        postToCounty: "West Yorkshire",
        postToPostcode: "LS1 1AA",
        postToCountry: "United Kingdom",
      },
    };
    const workspace = addManualOrder(null, input);
    expect(workspace.fileName).toBe("manual-orders.csv");
    expect(workspace.orders[0]?.orderNumber).toBe("MAN-1");
    expect(workspace.totals.includedExportOrders).toBe(1);
    expect(() => addManualOrder(workspace, input)).toThrow(/already exists/i);
  });

  it("recalculates duplicate counts and clears review when compared details change", () => {
    let workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "E-1" },
        { "Order number": "E-2" },
      ]),
      "orders.csv",
    );

    const matchKey = workspace.groups[0]?.matchKey;
    expect(matchKey).toBeTruthy();
    workspace = setGroupReviewed(workspace, matchKey!, true);
    expect(workspace.reviewedMatchKeys).toContain(matchKey);

    workspace = updateOrderDelivery(
      workspace,
      "E-2",
      deliveryFrom(workspace.orders[1]!.delivery, {
        postToAddress1: "11 High Street",
      }),
    );

    expect(workspace.totals.duplicateGroups).toBe(0);
    expect(workspace.reviewedMatchKeys).not.toContain(matchKey);
  });

  it("updates address line 2 classification after an edit without merging orders", () => {
    let workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "A2-1", "Post to address 2": "Flat 1" },
        { "Order number": "A2-2", "Post to address 2": "Flat 1" },
      ]),
      "orders.csv",
    );
    expect(workspace.groups[0]?.classification).toBe("matching");

    workspace = updateOrderDelivery(
      workspace,
      "A2-2",
      deliveryFrom(workspace.orders[1]!.delivery, {
        postToAddress2: "W/N",
      }),
    );

    expect(workspace.totals.duplicateGroups).toBe(1);
    expect(workspace.groups[0]?.classification).toBe("address2-differs");
    expect(workspace.orders).toHaveLength(2);
  });

  it("keeps reviewed orders separate in the export", () => {
    let workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "X-1" },
        { "Order number": "X-2" },
      ]),
      "orders.csv",
    );
    workspace = setGroupReviewed(workspace, workspace.groups[0]!.matchKey, true);
    const exported = exportWorkspace(workspace);
    expect(exported.rows).toHaveLength(2);
    expect(exported.rows.map((row) => row.Reference)).toEqual(["X-1", "X-2"]);
  });

  it("only explicit exclusions reduce the exported order count", () => {
    let workspace = createWorkspaceFromCsv(
      csv([
        { "Order number": "Z-1" },
        { "Order number": "Z-2" },
        { "Order number": "Z-3", "Post to name": "Someone Else" },
      ]),
      "orders.csv",
    );

    expect(workspace.totals.includedExportOrders).toBe(3);
    expect(workspace.totals.excludedExportOrders).toBe(0);

    workspace = setOrderExcluded(workspace, "Z-2", true);
    expect(workspace.totals.includedExportOrders).toBe(2);
    expect(workspace.totals.excludedExportOrders).toBe(1);

    const exported = exportWorkspace(workspace);
    expect(exported.rows.map((row) => row.Reference)).toEqual(["Z-1", "Z-3"]);

    workspace = setOrderExcluded(workspace, "Z-2", false);
    expect(exportWorkspace(workspace).rows).toHaveLength(3);
  });
});

describe("real-world eBay CSV imports", () => {
  it("ignores eBay report footer rows instead of treating them as orders", () => {
    const text = [
      "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to address 2,Post to city,Post to county,Post to postcode,Post to country",
      "04-15250-08826,jacgeo-2000,Toby Roberts,07700 900111,12 Maple Street,,York,North Yorkshire,YO1 7HH,United Kingdom",
      "record(s) downloaded,,,,,,,,,",
      "Seller ID : caledonian-youth,,,,,,,,,",
      "24-15229-61546,mowl_to,Tom Mowlem,07700 900222,9 King Street,,Leeds,West Yorkshire,LS1 1BA,United Kingdom",
      "83 record(s) downloaded,,,,,,,,,",
      "Seller ID: discounted-shop-777,,,,,,,,,",
    ].join("\n");

    const workspace = createWorkspaceFromCsv(text, "seller-report.csv");
    expect(workspace.orders.map((order) => order.orderNumber)).toEqual([
      "04-15250-08826",
      "24-15229-61546",
    ]);
    expect(workspace.totals.uniqueOrders).toBe(2);
    expect(exportWorkspace(workspace).rows.map((row) => row.Reference)).toEqual([
      "04-15250-08826",
      "24-15229-61546",
    ]);
  });

  it("uses Sales record number when Order number cells are blank", () => {
    const text = [
      "Sales record number,Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to address 2,Post to city,Post to county,Post to postcode,Post to country",
      "1001,,alice_uk,Alice Hart,07700 900111,12 Maple Street,,York,North Yorkshire,YO1 7HH,United Kingdom",
      "1002,,bob_shopper,Bob Keene,0161 496 0100,44 Canal Walk,Apartment 3,Manchester,Greater Manchester,M1 1AE,United Kingdom",
    ].join("\n");

    const workspace = createWorkspaceFromCsv(text, "ebay-blank-order-number.csv");
    expect(workspace.orders.map((order) => order.orderNumber)).toEqual([
      "1001",
      "1002",
    ]);
  });

  it("skips preamble rows and Excel sep= markers", () => {
    const text = [
      "Orders report generated 2 October 2026",
      "sep=,",
      "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to address 2,Post to city,Post to county,Post to postcode,Post to country",
      "11-123-456,alice_uk,Alice Hart,07700 900111,12 Maple Street,,York,North Yorkshire,YO1 7HH,United Kingdom",
    ].join("\n");

    const workspace = createWorkspaceFromCsv(text, "ebay-preamble.csv");
    expect(workspace.totals.uniqueOrders).toBe(1);
    expect(workspace.orders[0]?.orderNumber).toBe("11-123-456");
  });

  it("reads tab-separated OrderNumber headers", () => {
    const text = [
      "SalesRecordNumber\tOrderNumber\tBuyerUsername\tPostToName\tPostToPhone\tPostToAddress1\tPostToAddress2\tPostToCity\tPostToCounty\tPostToPostcode\tPostToCountry",
      "55\t11-999-001\tshopper\tAda West\t07700900999\t1 High St\tW/N\tBath\tSomerset\tBA1 1AA\tUnited Kingdom",
    ].join("\n");

    const workspace = createWorkspaceFromCsv(text, "file-exchange.tsv");
    expect(workspace.orders[0]?.orderNumber).toBe("11-999-001");
    expect(workspace.orders[0]?.delivery.postToName).toBe("Ada West");
  });

  it("reads semicolon-delimited Seller Hub exports", () => {
    const text = [
      "Order number;Buyer username;Post to name;Post to phone;Post to address 1;Post to address 2;Post to city;Post to county;Post to postcode;Post to country",
      "22-100-200;buyer1;Sam Lee;07700 900222;9 King Street;;Leeds;West Yorkshire;LS1 1BA;United Kingdom",
    ].join("\n");

    const workspace = createWorkspaceFromCsv(text, "ebay-semicolon.csv");
    expect(workspace.totals.uniqueOrders).toBe(1);
    expect(workspace.orders[0]?.delivery.postToCity).toBe("Leeds");
  });

  it("strips null bytes from a UTF-16 misread", () => {
    const plain = [
      "Order number,Buyer username,Post to name,Post to phone,Post to address 1,Post to address 2,Post to city,Post to county,Post to postcode,Post to country",
      "11-1,user,Anna,07700 900111,1 High St,,York,Yorks,YO1 1AA,UK",
    ].join("\n");
    const text = [...plain].join("\u0000");

    const workspace = createWorkspaceFromCsv(text, "utf16.csv");
    expect(workspace.orders[0]?.orderNumber).toBe("11-1");
  });
});

describe("sample file", () => {
  it("covers the demo totals for unique orders, repeats, and duplicate groups", () => {
    const workspace = createWorkspaceFromCsv(SAMPLE_CSV, SAMPLE_FILE_NAME);
    expect(workspace.totals.uniqueOrders).toBe(17);
    expect(workspace.totals.repeatedOrderRows).toBe(2);
    expect(workspace.totals.duplicateGroups).toBe(5);
    expect(workspace.totals.ordersInDuplicateGroups).toBe(11);
    expect(workspace.totals.groupsWithDifferentAddress2).toBe(2);
    expect(workspace.totals.includedExportOrders).toBe(17);
  });
});
