"use client";

import { SampleButton } from "@/components/sample-button";
import { Button } from "@/components/ui/button";
import { decodeCsvBytes } from "@/lib/csv";
import { FileSpreadsheetIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

type UploadPanelProps = {
  fileName?: string;
  onFileText: (text: string, fileName: string) => void;
  onSample: () => void;
  onDownloadSampleExcel?: () => void;
  sampleExcelDisabled?: boolean;
  onError: (message: string) => void;
};

export function UploadPanel({
  fileName,
  onFileText,
  onSample,
  onDownloadSampleExcel,
  sampleExcelDisabled = false,
  onError,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function readFile(file: File) {
    const name = file.name.toLowerCase();
    if (
      !name.endsWith(".csv") &&
      !name.endsWith(".tsv") &&
      !name.endsWith(".txt") &&
      file.type !== "text/csv" &&
      file.type !== "text/tab-separated-values"
    ) {
      onError("Please choose a .csv file from eBay Seller Hub.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = reader.result;
      if (!(buffer instanceof ArrayBuffer)) {
        onError("The file could not be read.");
        return;
      }
      onFileText(decodeCsvBytes(buffer), file.name);
    };
    reader.onerror = () => onError("The file could not be read.");
    reader.readAsArrayBuffer(file);
  }

  return (
    <div
      className={`rounded-xl border border-dashed p-5 transition-colors ${
        dragging
          ? "border-foreground bg-muted/70"
          : "border-border bg-card"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) readFile(file);
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-muted p-2">
            <FileSpreadsheetIcon className="size-5" />
          </div>
          <div>
            <p className="font-medium">
              {fileName ? fileName : "Drop an eBay orders CSV"}
            </p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Seller Hub reports can list several item rows for one Order
              number. This desk keeps the first row of each order for shipping,
              then checks for matching recipients across different orders.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readFile(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            Choose CSV
          </Button>
          <SampleButton onClick={onSample} />
          {onDownloadSampleExcel ? (
            <Button
              type="button"
              variant="outline"
              disabled={sampleExcelDisabled}
              onClick={onDownloadSampleExcel}
            >
              Download sample Excel
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
