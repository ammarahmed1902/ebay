import {
  buildShippingCsv,
  csvHasOrderIdentity,
  groupFirstRowPerOrder,
  parseCsvText,
} from "@/lib/csv";
import {
  computeTotals,
  detectDuplicateGroups,
  reconcileReviewedMatchKeys,
} from "@/lib/duplicates";
import type { DeliveryFields, Order, Workspace } from "@/lib/types";

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
