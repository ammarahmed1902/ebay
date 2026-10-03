"use client";

import { DuplicatePanel } from "@/components/duplicate-panel";
import { ExportPreview } from "@/components/export-preview";
import {
  EditDeliveryDialog,
  OrderDetailDialog,
} from "@/components/order-dialogs";
import { OrdersTable } from "@/components/orders-table";
import { ShippingSettingsPanel } from "@/components/shipping-settings-panel";
import { StatsBar, type DeskFocus } from "@/components/stats-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UploadPanel } from "@/components/upload-panel";
import {
  loadTemplateBufferFromPublic,
  readShippingTemplate,
  TemplateFormatError,
} from "@/lib/excel-export";
import {
  createShippingExcelBlob,
  downloadShippingExcel,
  shippingExcelFileName,
  triggerBlobDownload,
} from "@/lib/download-shipping-excel";
import { SAMPLE_CSV, SAMPLE_FILE_NAME } from "@/lib/sample";
import {
  DEFAULT_SHIPPING_SETTINGS,
  loadShippingSettings,
  type ShippingSettings,
} from "@/lib/shipping-settings";
import type { DeliveryFields, DuplicateGroup, Order, Workspace } from "@/lib/types";
import {
  createWorkspaceFromCsv,
  setGroupReviewed,
  setOrderExcluded,
  updateOrderDelivery,
} from "@/lib/workspace";
import { DownloadIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type TabValue = "orders" | "duplicates" | "export";

export function ShippingDesk() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabValue>("orders");
  const [focus, setFocus] = useState<DeskFocus>("orders");
  const [highlightGroupNumber, setHighlightGroupNumber] = useState<number | null>(
    null,
  );
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [settings, setSettings] = useState<ShippingSettings>(
    DEFAULT_SHIPPING_SETTINGS,
  );
  const [exporting, setExporting] = useState(false);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [templateHeaders, setTemplateHeaders] = useState<string[] | null>(null);
  const [templateSheetName, setTemplateSheetName] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    setSettings(loadShippingSettings());
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadTemplateBufferFromPublic()
      .then((buffer) => {
        const template = readShippingTemplate(buffer);
        if (cancelled) return;
        setTemplateBuffer(buffer);
        setTemplateHeaders(template.headers);
        setTemplateSheetName(template.sheetName);
      })
      .catch((caught) => {
        if (cancelled) return;
        setTemplateError(
          caught instanceof Error
            ? caught.message
            : "The shipping Excel template could not be read. Export is blocked.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const excluded = useMemo(
    () => new Set(workspace?.excludedOrderNumbers ?? []),
    [workspace],
  );

  const visibleOrders = useMemo(() => {
    if (!workspace) return [];
    if (focus === "repeats") {
      return workspace.orders.filter((order) => order.extraRowCount > 0);
    }
    return workspace.orders;
  }, [workspace, focus]);

  const visibleGroups = useMemo(() => {
    if (!workspace) return [];
    if (focus === "address2") {
      return workspace.groups.filter(
        (group) => group.classification === "address2-differs",
      );
    }
    return workspace.groups;
  }, [workspace, focus]);

  function loadCsv(text: string, fileName: string) {
    try {
      const next = createWorkspaceFromCsv(text, fileName);
      setWorkspace(next);
      setError(null);
      setFocus("orders");
      setTab("orders");
      setHighlightGroupNumber(null);
      setOpenOrder(null);
      setEditingOrder(null);
    } catch (caught) {
      setWorkspace(null);
      setError(
        caught instanceof Error
          ? caught.message
          : "The CSV could not be read.",
      );
    }
  }

  function handleFocus(nextFocus: DeskFocus) {
    setFocus(nextFocus);
    if (
      nextFocus === "duplicates" ||
      nextFocus === "duplicate-orders" ||
      nextFocus === "address2"
    ) {
      setTab("duplicates");
      setHighlightGroupNumber(workspace?.groups[0]?.groupNumber ?? null);
    } else {
      setTab("orders");
      setHighlightGroupNumber(null);
    }
  }

  function openGroup(group: DuplicateGroup) {
    setTab("duplicates");
    setFocus(
      group.classification === "address2-differs" ? "address2" : "duplicates",
    );
    setHighlightGroupNumber(group.groupNumber);
    requestAnimationFrame(() => {
      document
        .getElementById(`duplicate-group-${group.groupNumber}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleExcluded(orderNumber: string, excludedOrder: boolean) {
    if (!workspace) return;
    setWorkspace(setOrderExcluded(workspace, orderNumber, excludedOrder));
  }

  function saveDelivery(orderNumber: string, delivery: DeliveryFields) {
    if (!workspace) return;
    const next = updateOrderDelivery(workspace, orderNumber, delivery);
    setWorkspace(next);
    setEditingOrder(null);
    setOpenOrder(
      next.orders.find((order) => order.orderNumber === orderNumber) ?? null,
    );
  }

  async function downloadExport() {
    if (!workspace || !templateBuffer) {
      setError(
        templateError ??
          "The shipping Excel template could not be read. Export is blocked.",
      );
      return;
    }
    setExporting(true);
    setError(null);
    try {
      await downloadShippingExcel(workspace, settings, templateBuffer);
    } catch (caught) {
      setError(
        caught instanceof TemplateFormatError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The shipping Excel file could not be generated.",
      );
    } finally {
      setExporting(false);
    }
  }

  async function downloadSampleExcel() {
    if (!templateBuffer) {
      setError(
        templateError ??
          "The shipping Excel template could not be read. Export is blocked.",
      );
      return;
    }
    setExporting(true);
    setError(null);
    try {
      const sampleWorkspace = createWorkspaceFromCsv(
        SAMPLE_CSV,
        SAMPLE_FILE_NAME,
      );
      const blob = await createShippingExcelBlob(
        sampleWorkspace,
        settings,
        templateBuffer,
      );
      triggerBlobDownload(blob, "sample-ebay-live-shipping.xlsx");
    } catch (caught) {
      setError(
        caught instanceof TemplateFormatError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "The sample Excel file could not be generated.",
      );
    } finally {
      setExporting(false);
    }
  }

  const filterLabel =
    focus === "repeats"
      ? "Showing orders that had extra item rows in the CSV."
      : focus === "address2"
        ? "Showing duplicate groups where address line 2 differs."
        : focus === "duplicates" || focus === "duplicate-orders"
          ? "Showing potential duplicate delivery groups."
          : null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            eBay to shipping Excel
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            Shipping desk
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Keep one shipping row for each unique Order number, then review
            different orders that share the same recipient details. Matching
            deliveries are warnings for you to check — they are never merged,
            deleted, or combined automatically.
          </p>
        </div>
        {workspace ? (
          <div className="rounded-xl border bg-card px-4 py-3 text-sm">
            <p>
              Export will include{" "}
              <span className="font-semibold tabular-nums">
                {workspace.totals.includedExportOrders}
              </span>{" "}
              shipping order
              {workspace.totals.includedExportOrders === 1 ? "" : "s"}
              {workspace.totals.excludedExportOrders > 0
                ? ` and skip ${workspace.totals.excludedExportOrders} excluded.`
                : "."}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Worksheet: {templateSheetName ?? "unavailable"} ·{" "}
              {DEFAULT_SHIPPING_SETTINGS.serviceType}
            </p>
            <Button
              className="mt-3 w-full sm:w-auto"
              disabled={exporting || !templateBuffer}
              onClick={() => void downloadExport()}
            >
              <DownloadIcon data-icon="inline-start" />
              Download shipping Excel
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              File: {workspace ? shippingExcelFileName(workspace.fileName) : ""}
            </p>
          </div>
        ) : null}
      </header>

      <UploadPanel
        fileName={workspace?.fileName}
        onFileText={loadCsv}
        onSample={() => loadCsv(SAMPLE_CSV, SAMPLE_FILE_NAME)}
        onDownloadSampleExcel={() => void downloadSampleExcel()}
        sampleExcelDisabled={!templateBuffer || exporting}
        onError={setError}
      />

      {templateError || error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>
            {[templateError, error].filter(Boolean).join(" ")}
          </AlertDescription>
        </Alert>
      ) : null}

      {!workspace ? (
        <div className="rounded-xl border bg-muted/20 px-5 py-12 text-center">
          <h2 className="font-heading text-lg font-medium">
            No orders loaded yet
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Upload a Seller Hub orders report, or load the sample file to see
            unique-order totals, extra item rows, and potential duplicate
            deliveries.
          </p>
        </div>
      ) : (
        <>
          <StatsBar totals={workspace.totals} focus={focus} onFocus={handleFocus} />

          {workspace.parseWarnings.length > 0 ? (
            <Alert>
              <AlertTitle>CSV notes</AlertTitle>
              <AlertDescription>
                {workspace.parseWarnings.join(" ")}
              </AlertDescription>
            </Alert>
          ) : null}

          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (
                value === "orders" ||
                value === "duplicates" ||
                value === "export"
              ) {
                setTab(value);
                if (
                  value === "orders" &&
                  (focus === "duplicates" ||
                    focus === "duplicate-orders" ||
                    focus === "address2")
                ) {
                  setFocus("orders");
                  setHighlightGroupNumber(null);
                }
                if (
                  value === "duplicates" &&
                  (focus === "orders" || focus === "repeats")
                ) {
                  setFocus("duplicates");
                }
              }
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList>
                <TabsTrigger value="orders">
                  Shipping orders ({workspace.totals.uniqueOrders})
                </TabsTrigger>
                <TabsTrigger value="duplicates">
                  Potential duplicates ({workspace.totals.duplicateGroups})
                </TabsTrigger>
                <TabsTrigger value="export">Excel export</TabsTrigger>
              </TabsList>
              {filterLabel ? (
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm text-muted-foreground">{filterLabel}</p>
                  {(focus === "repeats" || focus === "address2") && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setFocus(tab === "duplicates" ? "duplicates" : "orders");
                        setHighlightGroupNumber(null);
                      }}
                    >
                      Show all
                    </Button>
                  )}
                </div>
              ) : null}
            </div>

            <TabsContent value="orders" className="mt-4">
              <OrdersTable
                orders={visibleOrders}
                groups={workspace.groups}
                excludedOrderNumbers={excluded}
                emptyMessage={
                  focus === "repeats"
                    ? "No orders had extra item-detail rows."
                    : "No orders to show."
                }
                onOpen={setOpenOrder}
                onEdit={setEditingOrder}
                onToggleExcluded={toggleExcluded}
                onOpenGroup={openGroup}
              />
            </TabsContent>

            <TabsContent value="export" className="mt-4 space-y-4">
              <ShippingSettingsPanel settings={settings} onChange={setSettings} />
              {templateHeaders ? (
                <ExportPreview
                  headers={templateHeaders}
                  orders={workspace.orders}
                  excludedOrderNumbers={excluded}
                  settings={settings}
                />
              ) : (
                <p className="rounded-lg border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
                  {templateError ??
                    "Reading the shipping template before showing the export preview."}
                </p>
              )}
            </TabsContent>

            <TabsContent value="duplicates" className="mt-4">
              <DuplicatePanel
                groups={visibleGroups}
                excludedOrderNumbers={excluded}
                reviewedMatchKeys={workspace.reviewedMatchKeys}
                highlightGroupNumber={highlightGroupNumber}
                emptyMessage={
                  focus === "address2"
                    ? "No duplicate groups have a different address line 2."
                    : "No potential duplicate deliveries were found."
                }
                onOpenOrder={setOpenOrder}
                onEditOrder={setEditingOrder}
                onToggleExcluded={toggleExcluded}
                onMarkReviewed={(matchKey, reviewed) =>
                  setWorkspace(setGroupReviewed(workspace, matchKey, reviewed))
                }
              />
            </TabsContent>
          </Tabs>
        </>
      )}

      <OrderDetailDialog
        order={openOrder}
        open={Boolean(openOrder) && !editingOrder}
        onOpenChange={(open) => {
          if (!open) setOpenOrder(null);
        }}
        onEdit={() => {
          if (openOrder) setEditingOrder(openOrder);
        }}
      />
      <EditDeliveryDialog
        order={editingOrder}
        open={Boolean(editingOrder)}
        onOpenChange={(open) => {
          if (!open) setEditingOrder(null);
        }}
        onSave={(delivery) => {
          if (editingOrder) saveDelivery(editingOrder.orderNumber, delivery);
        }}
      />
    </div>
  );
}
