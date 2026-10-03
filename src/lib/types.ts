export type DeliveryFields = {
  postToName: string;
  postToPhone: string;
  postToAddress1: string;
  postToAddress2: string;
  postToCity: string;
  postToCounty: string;
  postToPostcode: string;
  postToCountry: string;
};

export type Order = {
  orderNumber: string;
  buyerUsername: string;
  salesRecordNumber: string;
  itemTitle: string;
  quantity: string;
  sourceRowIndex: number;
  extraRowCount: number;
  delivery: DeliveryFields;
  raw: Record<string, string>;
};

export type DuplicateClassification = "matching" | "address2-differs";

export type DuplicateGroup = {
  groupNumber: number;
  matchKey: string;
  classification: DuplicateClassification;
  orders: Order[];
  memberClassifications: Record<string, DuplicateClassification>;
};

export type Totals = {
  uniqueOrders: number;
  repeatedOrderRows: number;
  duplicateGroups: number;
  ordersInDuplicateGroups: number;
  groupsWithDifferentAddress2: number;
  includedExportOrders: number;
  excludedExportOrders: number;
};

export type ReviewStatus = "unreviewed" | "reviewed-keep-separate";

export type ParseWarning = {
  message: string;
};

export type Workspace = {
  fileName: string;
  parseWarnings: string[];
  skippedEmptyOrderRows: number;
  orders: Order[];
  groups: DuplicateGroup[];
  totals: Totals;
  excludedOrderNumbers: string[];
  reviewedMatchKeys: string[];
};

export const SHIPPING_EXPORT_HEADERS = [
  "Name",
  "Telephone",
  "Address line 1",
  "Address line 2",
  "City",
  "County",
  "Postcode",
  "Country",
  "Reference",
  "Buyer username",
] as const;

export type ShippingExportRow = {
  Name: string;
  Telephone: string;
  "Address line 1": string;
  "Address line 2": string;
  City: string;
  County: string;
  Postcode: string;
  Country: string;
  Reference: string;
  "Buyer username": string;
};
