"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { templatePreviewRows } from "@/lib/excel-export";
import type { ShippingSettings } from "@/lib/shipping-settings";
import type { Order } from "@/lib/types";

type ExportPreviewProps = {
  headers: string[];
  orders: Order[];
  excludedOrderNumbers: Set<string>;
  settings: ShippingSettings;
};

export function ExportPreview({
  headers,
  orders,
  excludedOrderNumbers,
  settings,
}: ExportPreviewProps) {
  const rows = templatePreviewRows(orders, excludedOrderNumbers, settings);
  const includedCount = orders.filter(
    (order) => !excludedOrderNumbers.has(order.orderNumber),
  ).length;

  if (includedCount === 0) {
    return (
      <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No orders are currently included in the Excel export.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Preview headers and column order are read from the shipping template,
        the same workbook used for the downloaded Excel file. Converted orders
        start on Row 2.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-background">
              Excel row
            </TableHead>
            {headers.map((header, index) => (
              <TableHead key={`col-${index}`} className="min-w-36 whitespace-nowrap">
                {header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow className="bg-muted/40">
            <TableCell className="sticky left-0 z-10 bg-muted/40 font-medium">
              1
            </TableCell>
            {headers.map((header, index) => (
              <TableCell
                key={`header-${index}`}
                className="font-medium whitespace-nowrap"
              >
                {header}
              </TableCell>
            ))}
          </TableRow>
          {rows.map((row, index) => (
            <TableRow key={`preview-${index}`}>
              <TableCell className="sticky left-0 z-10 bg-background font-medium">
                {index + 2}
              </TableCell>
              {headers.map((header, columnIndex) => (
                <TableCell key={`${index}-${columnIndex}`} className="whitespace-pre">
                  {String(row[header] ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length < includedCount ? (
        <p className="text-xs text-muted-foreground">
          Showing the first {rows.length} of {includedCount} exported orders.
        </p>
      ) : null}
    </div>
  );
}
