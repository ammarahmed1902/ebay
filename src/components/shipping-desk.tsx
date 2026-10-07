"use client";

import { DuplicatePanel } from "@/components/duplicate-panel";
import { ExportPreview } from "@/components/export-preview";
import {
  EditDeliveryDialog,
  OrderDetailDialog,
} from "@/components/order-dialogs";
import { OrdersTable } from "@/components/orders-table";
import { ManualOrderDialog } from "@/components/manual-order-dialog";
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
  addManualOrder,
  createWorkspaceFromCsv,
  createWorkspaceFromCsvFiles,
  setGroupReviewed,
  setOrderExcluded,
  updateOrderDelivery,
} from "@/lib/workspace";
import { DownloadIcon, ShieldCheckIcon, SparklesIcon } from "lucide-react";
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
  const [manualOrderOpen, setManualOrderOpen] = useState(false);
  const [settings, setSettings] = useState<ShippingSettings>(
    DEFAULT_SHIPPING_SETTINGS,
  );
  const [exporting, setExporting] = useState(false);
  const [templateBuffer, setTemplateBuffer] = useState<ArrayBuffer | null>(null);
  const [templateHeaders, setTemplateHeaders] = useState<string[] | null>(null);
  const [templateSheetName, setTemplateSheetName] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => setSettings(loadShippingSettings()));
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

  function loadCsvFiles(files: Array<{ text: string; fileName: string }>) {
    try {
      const next = createWorkspaceFromCsvFiles(files);
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
    <main className="relative isolate min-h-screen overflow-hidden">
      <div className="ambient-gradient pointer-events-none absolute -inset-x-[8%] -top-16 -z-10 h-[42rem]" />
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="animate-rise flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-2">
          <p className="inline-flex items-center gap-2 rounded-full border bg-background/75 px-3 py-1.5 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase shadow-sm backdrop-blur">
            <SparklesIcon className="size-3.5 text-primary" /> eBay to shipping Excel
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Shipping, without the spreadsheet chaos.
          </h1>
          <p className="text-sm leading-6 text-muted-foreground sm:text-base">
            Keep one shipping row for each unique Order number, then review
            different orders that share the same buyer username, name, phone,
            address line 1, and postcode. Matches are warnings for you to check
            — they are never merged, deleted, or combined automatically.
          </p>
        </div>
        {workspace ? (
          <div className="animate-rise rounded-2xl border border-white/60 bg-card/90 px-5 py-4 text-sm shadow-xl shadow-slate-900/5 backdrop-blur">
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
        onFilesText={loadCsvFiles}
        onSample={() => loadCsvFiles([{ text: SAMPLE_CSV, fileName: SAMPLE_FILE_NAME }])}
        onDownloadSampleExcel={() => void downloadSampleExcel()}
        sampleExcelDisabled={!templateBuffer || exporting}
        onError={setError}
        onAddManual={() => setManualOrderOpen(true)}
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
        <div className="animate-rise rounded-2xl border bg-card/70 px-5 py-14 text-center shadow-sm backdrop-blur">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
            <ShieldCheckIcon className="size-6" />
          </div>
          <h2 className="font-heading text-lg font-medium">
            No orders loaded yet
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Upload a Seller Hub report, add an order manually, or load the sample
            file. Everything stays in your browser.
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
      <ManualOrderDialog
        open={manualOrderOpen}
        onOpenChange={setManualOrderOpen}
        onSave={(input) => {
          try {
            setWorkspace((current) => addManualOrder(current, input));
            setError(null);
            setFocus("orders");
            setTab("orders");
            setManualOrderOpen(false);
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "The order could not be added.");
          }
        }}
      />
      <footer className="mt-2 flex justify-center border-t border-border/60 pt-5 text-sm text-muted-foreground sm:justify-end">
        <p>
          Developed by{" "}
          <a
            href="https://ammarahmedecommerce.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-foreground underline decoration-primary/40 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary"
          >
            Ammar Ahmed
          </a>
        </p>
      </footer>
      </div>
    </main>
  );
}
