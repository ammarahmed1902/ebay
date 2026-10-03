"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { Totals } from "@/lib/types";

export type DeskFocus =
  | "orders"
  | "repeats"
  | "duplicates"
  | "duplicate-orders"
  | "address2";

const STATS: Array<{
  key: DeskFocus;
  label: string;
  hint: string;
  value: (totals: Totals) => number;
}> = [
  {
    key: "orders",
    label: "Total unique orders",
    hint: "Distinct, non-empty Order numbers",
    value: (totals) => totals.uniqueOrders,
  },
  {
    key: "repeats",
    label: "Repeated order rows",
    hint: "Extra CSV rows for an existing Order number",
    value: (totals) => totals.repeatedOrderRows,
  },
  {
    key: "duplicates",
    label: "Potential duplicate delivery groups",
    hint: "Different orders with matching recipient details",
    value: (totals) => totals.duplicateGroups,
  },
  {
    key: "duplicate-orders",
    label: "Orders in duplicate groups",
    hint: "Unique orders belonging to those groups",
    value: (totals) => totals.ordersInDuplicateGroups,
  },
  {
    key: "address2",
    label: "Groups with different address line 2",
    hint: "Same delivery match, different Post to address 2",
    value: (totals) => totals.groupsWithDifferentAddress2,
  },
];

type StatsBarProps = {
  totals: Totals;
  focus: DeskFocus;
  onFocus: (focus: DeskFocus) => void;
};

export function StatsBar({ totals, focus, onFocus }: StatsBarProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {STATS.map((stat) => {
        const active = focus === stat.key;
        return (
          <button
            key={stat.key}
            type="button"
            onClick={() => onFocus(stat.key)}
            className="text-left"
            data-stat={stat.key}
          >
            <Card
              size="sm"
              className={`h-full transition-colors ${
                active
                  ? "ring-2 ring-foreground"
                  : "hover:bg-muted/40"
              }`}
            >
              <CardContent className="space-y-1">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {stat.label}
                </p>
                <p className="font-heading text-3xl font-semibold tabular-nums">
                  {stat.value(totals)}
                </p>
                <p className="text-xs text-muted-foreground">{stat.hint}</p>
              </CardContent>
            </Card>
          </button>
        );
      })}
    </div>
  );
}
