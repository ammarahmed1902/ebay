"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { classificationLabel, displayValue } from "@/lib/labels";
import type { DuplicateGroup, Order } from "@/lib/types";

type OrdersTableProps = {
  orders: Order[];
  groups: DuplicateGroup[];
  excludedOrderNumbers: Set<string>;
  emptyMessage: string;
  onOpen: (order: Order) => void;
  onEdit: (order: Order) => void;
  onToggleExcluded: (orderNumber: string, excluded: boolean) => void;
  onOpenGroup: (group: DuplicateGroup) => void;
};

export function OrdersTable({
  orders,
  groups,
  excludedOrderNumbers,
  emptyMessage,
  onOpen,
  onEdit,
  onToggleExcluded,
  onOpenGroup,
}: OrdersTableProps) {
  const groupByOrder = new Map<string, DuplicateGroup>();
  for (const group of groups) {
    for (const order of group.orders) {
      groupByOrder.set(order.orderNumber, group);
    }
  }

  if (orders.length === 0) {
    return (
      <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">Export</TableHead>
          <TableHead>Order</TableHead>
          <TableHead>Buyer</TableHead>
          <TableHead>Recipient</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Address 1</TableHead>
          <TableHead>Address 2</TableHead>
          <TableHead>City / county</TableHead>
          <TableHead>Postcode</TableHead>
          <TableHead>Country</TableHead>
          <TableHead>Flags</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.map((order) => {
          const group = groupByOrder.get(order.orderNumber);
          const excluded = excludedOrderNumbers.has(order.orderNumber);
          const address2Differs =
            group?.memberClassifications[order.orderNumber] ===
            "address2-differs";
          return (
            <TableRow
              key={order.orderNumber}
              className={excluded ? "bg-muted/40 opacity-80" : undefined}
              data-order-row={order.orderNumber}
            >
              <TableCell>
                <Checkbox
                  checked={!excluded}
                  aria-label={`Include ${order.orderNumber} in export`}
                  onCheckedChange={(checked) =>
                    onToggleExcluded(order.orderNumber, checked === false)
                  }
                />
              </TableCell>
              <TableCell className="font-medium whitespace-pre">
                <button
                  type="button"
                  className="underline-offset-2 hover:underline"
                  onClick={() => onOpen(order)}
                >
                  {order.orderNumber}
                </button>
                {order.extraRowCount > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    +{order.extraRowCount} item row
                    {order.extraRowCount === 1 ? "" : "s"}
                  </p>
                ) : null}
              </TableCell>
              <TableCell className="whitespace-pre">{displayValue(order.buyerUsername, "—")}</TableCell>
              <TableCell className="whitespace-pre">{displayValue(order.delivery.postToName, "—")}</TableCell>
              <TableCell className="whitespace-pre">{displayValue(order.delivery.postToPhone, "—")}</TableCell>
              <TableCell className="max-w-44 truncate whitespace-pre">
                {displayValue(order.delivery.postToAddress1, "—")}
              </TableCell>
              <TableCell
                className={
                  address2Differs
                    ? "whitespace-pre bg-amber-100 font-medium text-amber-950"
                    : "whitespace-pre"
                }
              >
                {displayValue(order.delivery.postToAddress2)}
              </TableCell>
              <TableCell className="whitespace-pre">
                {displayValue(order.delivery.postToCity, "—")}
                {order.delivery.postToCounty.trim()
                  ? `, ${order.delivery.postToCounty}`
                  : ""}
              </TableCell>
              <TableCell className="whitespace-pre">{displayValue(order.delivery.postToPostcode, "—")}</TableCell>
              <TableCell className="whitespace-pre">{displayValue(order.delivery.postToCountry, "—")}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {excluded ? <Badge variant="secondary">Excluded</Badge> : null}
                  {group ? (
                    <button type="button" onClick={() => onOpenGroup(group)}>
                      <Badge variant="outline">
                        Group {group.groupNumber}:{" "}
                        {classificationLabel(
                          group.memberClassifications[order.orderNumber] ??
                            group.classification,
                        )}
                      </Badge>
                    </button>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpen(order)}
                  >
                    Open
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onEdit(order)}
                  >
                    Edit
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
