import {
  buildShippingCsv,
  csvHasOrderIdentity,
  groupFirstRowPerOrder,
  missingRequiredBuyerColumns,
  parseCsvText,
} from "@/lib/csv";
import {
  computeTotals,
  detectDuplicateGroups,
  reconcileReviewedMatchKeys,
} from "@/lib/duplicates";
import type { DeliveryFields, Order, Workspace } from "@/lib/types";

export type ManualOrderInput = {
  orderNumber: string;
  buyerUsername: string;
  itemTitle: string;
  quantity: string;
  delivery: DeliveryFields;
};

function withDerivedState(
  workspace: Omit<Workspace, "groups" | "totals">,
): Workspace {
  const groups = detectDuplicateGroups(workspace.orders);
  const totals = computeTotals(
    workspace.orders,
    groups,
    workspace.excludedOrderNumbers,
  );
  return { ...workspace, groups, totals };
}

export function createWorkspaceFromCsv(
  text: string,
  fileName: string,
): Workspace {
  const parsed = parseCsvText(text);
  if (!csvHasOrderIdentity(parsed.headers)) {
    const preview = parsed.headers
      .map((header) => header.trim())
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
    throw new Error(
      preview
        ? `Could not find an Order number or Sales record number column. Columns found: ${preview}.`
        : "This does not look like an eBay orders CSV. Export the Seller Hub orders report and try again.",
    );
  }

  const missingBuyerColumns = missingRequiredBuyerColumns(parsed.headers);
  if (missingBuyerColumns.length > 0) {
    throw new Error(
      `Missing required buyer columns: ${missingBuyerColumns.join(", ")}. Export a complete Seller Hub orders report and try again.`,
    );
  }

  const { orders, skippedEmptyOrderRows } = groupFirstRowPerOrder(parsed.rows);
  if (orders.length === 0) {
    throw new Error(
      "No orders were found. Order number cells can be blank only when Sales record number is filled in.",
    );
  }

  return withDerivedState({
    fileName,
    parseWarnings: parsed.warnings,
    skippedEmptyOrderRows,
    orders,
    excludedOrderNumbers: [],
    reviewedMatchKeys: [],
  });
}

export function createWorkspaceFromCsvFiles(
  files: Array<{ text: string; fileName: string }>,
): Workspace {
  if (files.length === 0) {
    throw new Error("Choose at least one eBay orders CSV.");
  }

  const parsedFiles = files.map((file) => {
    try {
      return createWorkspaceFromCsv(file.text, file.fileName);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The CSV could not be read.";
      throw new Error(`${file.fileName}: ${message}`);
    }
  });

  const seenOrderNumbers = new Set<string>();
  const repeatedAcrossFiles: string[] = [];
  const orders: Order[] = [];

  for (const parsed of parsedFiles) {
    for (const order of parsed.orders) {
      if (seenOrderNumbers.has(order.orderNumber)) {
        repeatedAcrossFiles.push(order.orderNumber);
        continue;
      }
      seenOrderNumbers.add(order.orderNumber);
      orders.push({ ...order, sourceRowIndex: orders.length });
    }
  }

  const parseWarnings = parsedFiles.flatMap((parsed) => parsed.parseWarnings);
  if (repeatedAcrossFiles.length > 0) {
    const preview = repeatedAcrossFiles.slice(0, 8).join(", ");
    const remaining = repeatedAcrossFiles.length - 8;
    parseWarnings.push(
      `Skipped ${repeatedAcrossFiles.length} repeated order${repeatedAcrossFiles.length === 1 ? "" : "s"} found in more than one file. The first occurrence was kept: ${preview}${remaining > 0 ? ` and ${remaining} more` : ""}.`,
    );
  }

  return withDerivedState({
    fileName:
      files.length === 1 ? files[0].fileName : `combined-${files.length}-files.csv`,
    parseWarnings,
    skippedEmptyOrderRows: parsedFiles.reduce(
      (total, parsed) => total + parsed.skippedEmptyOrderRows,
      0,
    ),
    orders,
    excludedOrderNumbers: [],
    reviewedMatchKeys: [],
  });
}

export function addManualOrder(
  workspace: Workspace | null,
  input: ManualOrderInput,
): Workspace {
  const orderNumber = input.orderNumber.trim();
  if (!orderNumber) {
    throw new Error("Order number is required for a manual order.");
  }
  if (workspace?.orders.some((order) => order.orderNumber === orderNumber)) {
    throw new Error(`Order ${orderNumber} already exists. Use Edit to update it.`);
  }

  const order: Order = {
    orderNumber,
    buyerUsername: input.buyerUsername.trim(),
    salesRecordNumber: "",
    itemTitle: input.itemTitle.trim(),
    quantity: input.quantity.trim() || "1",
    sourceRowIndex: workspace?.orders.length ?? 0,
    extraRowCount: 0,
    delivery: Object.fromEntries(
      Object.entries(input.delivery).map(([key, value]) => [key, value.trim()]),
    ) as DeliveryFields,
    raw: {},
  };

  return withDerivedState({
    fileName: workspace?.fileName ?? "manual-orders.csv",
    parseWarnings: workspace?.parseWarnings ?? [],
    skippedEmptyOrderRows: workspace?.skippedEmptyOrderRows ?? 0,
    orders: [...(workspace?.orders ?? []), order],
    excludedOrderNumbers: workspace?.excludedOrderNumbers ?? [],
    reviewedMatchKeys: workspace?.reviewedMatchKeys ?? [],
  });
}

export function updateOrderDelivery(
  workspace: Workspace,
  orderNumber: string,
  delivery: DeliveryFields,
): Workspace {
  const nextOrders: Order[] = workspace.orders.map((order) =>
    order.orderNumber === orderNumber ? { ...order, delivery } : order,
  );

  return withDerivedState({
    ...workspace,
    orders: nextOrders,
    reviewedMatchKeys: reconcileReviewedMatchKeys({
      previousOrders: workspace.orders,
      nextOrders,
      previousReviewedMatchKeys: workspace.reviewedMatchKeys,
    }),
  });
}

export function setGroupReviewed(
  workspace: Workspace,
  matchKey: string,
  reviewed: boolean,
): Workspace {
  const keys = new Set(workspace.reviewedMatchKeys);
  if (reviewed) keys.add(matchKey);
  else keys.delete(matchKey);
  return withDerivedState({
    ...workspace,
    reviewedMatchKeys: [...keys],
  });
}

export function setOrderExcluded(
  workspace: Workspace,
  orderNumber: string,
  excluded: boolean,
): Workspace {
  const excludedOrderNumbers = new Set(workspace.excludedOrderNumbers);
  if (excluded) excludedOrderNumbers.add(orderNumber);
  else excludedOrderNumbers.delete(orderNumber);
  return withDerivedState({
    ...workspace,
    excludedOrderNumbers: [...excludedOrderNumbers],
  });
}

export function exportWorkspace(workspace: Workspace) {
  return buildShippingCsv(workspace.orders, workspace.excludedOrderNumbers);
}
