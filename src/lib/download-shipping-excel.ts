import {
  buildShippingWorkbookBuffer,
  loadTemplateBufferFromPublic,
  TemplateFormatError,
} from "@/lib/excel-export";
import type { ShippingSettings } from "@/lib/shipping-settings";
import type { Workspace } from "@/lib/types";

export async function createShippingExcelBlob(
  workspace: Workspace,
  settings: ShippingSettings,
  templateBuffer?: ArrayBuffer,
): Promise<Blob> {
  const resolvedTemplateBuffer = templateBuffer ?? await loadTemplateBufferFromPublic();
  const output = await buildShippingWorkbookBuffer({
    orders: workspace.orders,
    excludedOrderNumbers: workspace.excludedOrderNumbers,
    settings,
    templateBuffer: resolvedTemplateBuffer,
  });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function shippingExcelFileName(sourceFileName: string): string {
  const baseName = sourceFileName.replace(/\.(csv|tsv|txt)$/i, "");
  return `${baseName}-ebay-live-shipping.xlsx`;
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadShippingExcel(
  workspace: Workspace,
  settings: ShippingSettings,
  templateBuffer?: ArrayBuffer,
): Promise<void> {
  try {
    const blob = await createShippingExcelBlob(
      workspace,
      settings,
      templateBuffer,
    );
    triggerBlobDownload(blob, shippingExcelFileName(workspace.fileName));
  } catch (error) {
    if (error instanceof TemplateFormatError) throw error;
    throw new Error(
      error instanceof Error
        ? error.message
        : "The shipping Excel file could not be generated.",
    );
  }
}
