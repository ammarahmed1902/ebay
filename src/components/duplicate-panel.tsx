"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { reviewStatusForGroup } from "@/lib/duplicates";
import {
  classificationLabel,
  displayValue,
  reviewLabel,
} from "@/lib/labels";
import type { DuplicateGroup, Order } from "@/lib/types";

type DuplicatePanelProps = {
  groups: DuplicateGroup[];
  excludedOrderNumbers: Set<string>;
  reviewedMatchKeys: string[];
  highlightGroupNumber?: number | null;
  emptyMessage: string;
  onOpenOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onToggleExcluded: (orderNumber: string, excluded: boolean) => void;
  onMarkReviewed: (matchKey: string, reviewed: boolean) => void;
};

export function DuplicatePanel({
  groups,
  excludedOrderNumbers,
  reviewedMatchKeys,
  highlightGroupNumber,
  emptyMessage,
  onOpenOrder,
  onEditOrder,
  onToggleExcluded,
  onMarkReviewed,
}: DuplicatePanelProps) {
  if (groups.length === 0) {
    return (
      <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="grid gap-4">
      {groups.map((group) => {
        const review = reviewStatusForGroup(group, reviewedMatchKeys);
        const highlighted = highlightGroupNumber === group.groupNumber;
        const address2Differs = group.classification === "address2-differs";
        return (
          <Card
            key={group.matchKey}
            id={`duplicate-group-${group.groupNumber}`}
            className={highlighted ? "ring-2 ring-foreground" : undefined}
          >
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>
                    Group {group.groupNumber} · {group.orders.length} orders
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    These matches are a review warning, not proof that the
                    orders were placed twice.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      address2Differs ? "destructive" : "secondary"
                    }
                  >
                    {classificationLabel(group.classification)}
                  </Badge>
                  <Badge
                    variant={
                      review === "reviewed-keep-separate"
                        ? "outline"
                        : "default"
                    }
                  >
                    {reviewLabel(review)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Field
                  label="Order numbers"
                  value={group.orders.map((order) => order.orderNumber).join(", ")}
                />
                <Field
                  label="Buyer usernames"
                  value={group.orders
                    .map((order) => displayValue(order.buyerUsername, "—"))
                    .join(", ")}
                />
                <Field
                  label="Recipient name"
                  value={group.orders[0]?.delivery.postToName ?? ""}
                />
                <Field
                  label="Phone"
                  value={group.orders[0]?.delivery.postToPhone ?? ""}
                />
                <Field
                  label="Address line 1"
                  value={group.orders[0]?.delivery.postToAddress1 ?? ""}
                />
                <Field
                  label="City, county, postcode, country"
                  value={[
                    group.orders[0]?.delivery.postToCity,
                    group.orders[0]?.delivery.postToCounty,
                    group.orders[0]?.delivery.postToPostcode,
                    group.orders[0]?.delivery.postToCountry,
                  ]
                    .filter((part) => (part ?? "").trim() !== "")
                    .join(", ")}
                />
              </dl>

              <div>
                <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Address line 2 for each order
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {group.orders.map((order) => {
                    const differs =
                      group.memberClassifications[order.orderNumber] ===
                      "address2-differs" || address2Differs;
                    return (
                      <div
                        key={order.orderNumber}
                        className={`rounded-lg border px-3 py-2 ${
                          differs
                            ? "border-amber-300 bg-amber-100 text-amber-950"
                            : "bg-muted/40"
                        }`}
                      >
                        <p className="text-xs font-medium">
                          {order.orderNumber}
                        </p>
                        <p className="mt-1 break-words font-medium whitespace-pre-wrap">
                          {displayValue(order.delivery.postToAddress2)}
                        </p>
                        <p className="mt-1 text-xs">
                          {classificationLabel(
                            group.memberClassifications[order.orderNumber] ??
                              group.classification,
                          )}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Order</th>
                      <th className="py-2 pr-3 font-medium">Buyer</th>
                      <th className="py-2 pr-3 font-medium">Classification</th>
                      <th className="py-2 pr-3 font-medium">Export</th>
                      <th className="py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.orders.map((order) => {
                      const excluded = excludedOrderNumbers.has(
                        order.orderNumber,
                      );
                      return (
                        <tr key={order.orderNumber} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">
                            {order.orderNumber}
                          </td>
                          <td className="py-2 pr-3">
                            {displayValue(order.buyerUsername, "—")}
                          </td>
                          <td className="py-2 pr-3">
                            {classificationLabel(
                              group.memberClassifications[order.orderNumber] ??
                                group.classification,
                            )}
                          </td>
                          <td className="py-2 pr-3">
                            {excluded ? "Excluded" : "Included"}
                          </td>
                          <td className="py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => onOpenOrder(order)}
                              >
                                Open
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onEditOrder(order)}
                              >
                                Edit
                              </Button>
                              {excluded ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  onClick={() =>
                                    onToggleExcluded(order.orderNumber, false)
                                  }
                                >
                                  Undo exclusion
                                </Button>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    onToggleExcluded(order.orderNumber, true)
                                  }
                                >
                                  Exclude from export
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
            <CardFooter className="justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Export still keeps one shipping row per Order number unless you
                exclude an order.
              </p>
              {review === "reviewed-keep-separate" ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onMarkReviewed(group.matchKey, false)}
                >
                  Clear review
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => onMarkReviewed(group.matchKey, true)}
                >
                  Reviewed — keep separate
                </Button>
              )}
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words">{displayValue(value, "—")}</dd>
    </div>
  );
}
