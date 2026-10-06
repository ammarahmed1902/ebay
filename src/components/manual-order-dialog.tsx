"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DeliveryFields } from "@/lib/types";
import type { ManualOrderInput } from "@/lib/workspace";
import { PackagePlusIcon } from "lucide-react";
import { useState } from "react";

const EMPTY_DELIVERY: DeliveryFields = {
  postToName: "",
  postToPhone: "",
  postToAddress1: "",
  postToAddress2: "",
  postToCity: "",
  postToCounty: "",
  postToPostcode: "",
  postToCountry: "United Kingdom",
};

const DELIVERY_FIELDS: Array<{
  key: keyof DeliveryFields;
  label: string;
  placeholder?: string;
  required?: boolean;
}> = [
  { key: "postToName", label: "Recipient name", required: true },
  { key: "postToPhone", label: "Phone", required: true },
  { key: "postToAddress1", label: "Address line 1", required: true },
  { key: "postToAddress2", label: "Address line 2" },
  { key: "postToCity", label: "City", required: true },
  { key: "postToCounty", label: "County / state" },
  { key: "postToPostcode", label: "Postcode", required: true },
  { key: "postToCountry", label: "Country", required: true },
];

export function ManualOrderDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (order: ManualOrderInput) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? <ManualOrderForm onOpenChange={onOpenChange} onSave={onSave} /> : null}
    </Dialog>
  );
}

function ManualOrderForm({
  onOpenChange,
  onSave,
}: {
  onOpenChange: (open: boolean) => void;
  onSave: (order: ManualOrderInput) => void;
}) {
  const [draft, setDraft] = useState<ManualOrderInput>({
    orderNumber: "",
    buyerUsername: "",
    itemTitle: "",
    quantity: "1",
    delivery: EMPTY_DELIVERY,
  });

  return (
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <PackagePlusIcon className="size-5" />
        </div>
        <DialogTitle>Add a shipping order</DialogTitle>
        <DialogDescription>
          Enter one order manually. It will be checked for duplicate delivery
          details and included in the same Excel export.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
        <Field
          id="manual-order-number"
          label="Order number"
          required
          value={draft.orderNumber}
          onChange={(value) => setDraft((current) => ({ ...current, orderNumber: value }))}
        />
        <Field
          id="manual-buyer"
          label="Buyer username"
          value={draft.buyerUsername}
          onChange={(value) => setDraft((current) => ({ ...current, buyerUsername: value }))}
        />
        <Field
          id="manual-item"
          label="Item description"
          value={draft.itemTitle}
          onChange={(value) => setDraft((current) => ({ ...current, itemTitle: value }))}
        />
        <Field
          id="manual-quantity"
          label="Quantity"
          value={draft.quantity}
          onChange={(value) => setDraft((current) => ({ ...current, quantity: value }))}
        />
        <div className="sm:col-span-2 my-1 border-t" />
        {DELIVERY_FIELDS.map((field) => (
          <Field
            key={field.key}
            id={`manual-${field.key}`}
            label={field.label}
            required={field.required}
            value={draft.delivery[field.key]}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                delivery: { ...current.delivery, [field.key]: value },
              }))
            }
          />
        ))}
        <DialogFooter className="mt-2 sm:col-span-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit">Add order</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  id,
  label,
  value,
  required,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}{required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      <Input
        id={id}
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
