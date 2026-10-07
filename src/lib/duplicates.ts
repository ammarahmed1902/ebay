import type {
  DuplicateClassification,
  DuplicateGroup,
  Order,
  Totals,
} from "@/lib/types";
import { address2Key, orderDuplicateMatchKey } from "@/lib/normalize";

function classifyMembers(orders: Order[]): {
  classification: DuplicateClassification;
  memberClassifications: Record<string, DuplicateClassification>;
} {
  const keys = orders.map((order) => address2Key(order.delivery.postToAddress2));
  const unique = new Set(keys);

  if (unique.size <= 1) {
    return {
      classification: "matching",
      memberClassifications: Object.fromEntries(
        orders.map((order) => [order.orderNumber, "matching" as const]),
      ),
    };
  }

  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let majorityKey: string | null = null;
  let majorityCount = 0;
  let tied = false;
  for (const [key, count] of counts) {
    if (count > majorityCount) {
      majorityKey = key;
      majorityCount = count;
      tied = false;
    } else if (count === majorityCount) {
      tied = true;
    }
  }

  const hasMajority = !tied && majorityCount > orders.length / 2;

  return {
    classification: "address2-differs",
    memberClassifications: Object.fromEntries(
      orders.map((order) => {
        const key = address2Key(order.delivery.postToAddress2);
        const member: DuplicateClassification =
          hasMajority && key === majorityKey ? "matching" : "address2-differs";
        return [order.orderNumber, member];
      }),
    ),
  };
}

export function detectDuplicateGroups(orders: Order[]): DuplicateGroup[] {
  const buckets = new Map<string, Order[]>();

  for (const order of orders) {
    const key = orderDuplicateMatchKey(order);
    if (!key) continue;
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(order);
    } else {
      buckets.set(key, [order]);
    }
  }

  const groups: DuplicateGroup[] = [];
  for (const [matchKey, members] of buckets) {
    if (members.length < 2) continue;
    const { classification, memberClassifications } = classifyMembers(members);
    groups.push({
      groupNumber: groups.length + 1,
      matchKey,
      classification,
      orders: members,
      memberClassifications,
    });
  }

  groups.sort(
    (a, b) => a.orders[0].sourceRowIndex - b.orders[0].sourceRowIndex,
  );
  groups.forEach((group, index) => {
    group.groupNumber = index + 1;
  });

  return groups;
}

export function computeTotals(
  orders: Order[],
  groups: DuplicateGroup[],
  excludedOrderNumbers: Iterable<string>,
): Totals {
  const excluded = new Set(excludedOrderNumbers);
  const excludedExportOrders = orders.filter((order) =>
    excluded.has(order.orderNumber),
  ).length;

  return {
    uniqueOrders: orders.length,
    repeatedOrderRows: orders.reduce(
      (sum, order) => sum + order.extraRowCount,
      0,
    ),
    duplicateGroups: groups.length,
    ordersInDuplicateGroups: groups.reduce(
      (sum, group) => sum + group.orders.length,
      0,
    ),
    groupsWithDifferentAddress2: groups.filter(
      (group) => group.classification === "address2-differs",
    ).length,
    includedExportOrders: orders.length - excludedExportOrders,
    excludedExportOrders,
  };
}

export function reconcileReviewedMatchKeys(options: {
  previousOrders: Order[];
  nextOrders: Order[];
  previousReviewedMatchKeys: Iterable<string>;
}): string[] {
  const previousKeyByOrder = new Map(
    options.previousOrders.map((order) => [
      order.orderNumber,
      orderDuplicateMatchKey(order),
    ]),
  );

  const invalidated = new Set<string>();
  for (const order of options.nextOrders) {
    const previousKey = previousKeyByOrder.get(order.orderNumber);
    const nextKey = orderDuplicateMatchKey(order);
    if (previousKey && previousKey !== nextKey) {
      invalidated.add(previousKey);
    }
  }

  return [...options.previousReviewedMatchKeys].filter(
    (key) => !invalidated.has(key),
  );
}

export function reviewStatusForGroup(
  group: DuplicateGroup,
  reviewedMatchKeys: Iterable<string>,
): "unreviewed" | "reviewed-keep-separate" {
  return new Set(reviewedMatchKeys).has(group.matchKey)
    ? "reviewed-keep-separate"
    : "unreviewed";
}
