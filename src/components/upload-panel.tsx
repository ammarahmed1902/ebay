"use client";

import { SampleButton } from "@/components/sample-button";
import { Button } from "@/components/ui/button";
import { decodeCsvBytes } from "@/lib/csv";
import { FileSpreadsheetIcon, PackagePlusIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

type UploadPanelProps = {
  fileName?: string;
  onFilesText: (files: Array<{ text: string; fileName: string }>) => void;
  onSample: () => void;
  onDownloadSampleExcel?: () => void;
  sampleExcelDisabled?: boolean;
  onError: (message: string) => void;
  onAddManual: () => void;
};

export function UploadPanel({
  fileName,
  onFilesText,
  onSample,
  onDownloadSampleExcel,
  sampleExcelDisabled = false,
  onError,
  onAddManual,
}: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function isAcceptedFile(file: File) {
    const name = file.name.toLowerCase();
    return (
      name.endsWith(".csv") ||
      name.endsWith(".tsv") ||
      name.endsWith(".txt") ||
      file.type === "text/csv" ||
      file.type === "text/tab-separated-values"
    );
  }

  async function readFiles(files: File[]) {
    if (files.length === 0) return;
    const invalid = files.find((file) => !isAcceptedFile(file));
    if (invalid) {
      onError(`${invalid.name} is not a CSV, TSV, or text file.`);
      return;
    }
    try {
      const decoded = await Promise.all(
        files.map(async (file) => ({
          text: decodeCsvBytes(await file.arrayBuffer()),
          fileName: file.name,
        })),
      );
      onFilesText(decoded);
    } catch {
      onError("One or more files could not be read.");
    }
  }

  return (
    <div
      className={`group rounded-2xl border border-dashed p-5 shadow-sm transition-all duration-300 ${
        dragging
          ? "scale-[1.01] border-primary bg-primary/5 shadow-lg"
          : "border-border/80 bg-card/90 hover:border-primary/40 hover:shadow-md"
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void readFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-muted p-2">
            <FileSpreadsheetIcon className="size-5" />
          </div>
          <div>
            <p className="font-medium">
              {fileName ? fileName : "Drop one or more eBay orders CSVs"}
            </p>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Select several Seller Hub reports together. Their unique orders
              are combined into one worksheet using the unchanged shipping template.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              void readFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon data-icon="inline-start" />
            Choose CSV files
          </Button>
          <Button type="button" variant="secondary" onClick={onAddManual}>
            <PackagePlusIcon data-icon="inline-start" />
            Add manually
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
