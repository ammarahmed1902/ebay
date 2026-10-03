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
import type { DeliveryFields, Order } from "@/lib/types";
import { useState } from "react";

const FIELD_LABELS: Array<{ key: keyof DeliveryFields; label: string }> = [
  { key: "postToName", label: "Post to name" },
  { key: "postToPhone", label: "Post to phone" },
  { key: "postToAddress1", label: "Post to address 1" },
  { key: "postToAddress2", label: "Post to address 2" },
  { key: "postToCity", label: "Post to city" },
  { key: "postToCounty", label: "Post to county" },
  { key: "postToPostcode", label: "Post to postcode" },
  { key: "postToCountry", label: "Post to country" },
];

export function OrderDetailDialog({
  order,
  extraNote,
  open,
  onOpenChange,
  onEdit,
}: {
  order: Order | null;
  extraNote?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Order {order.orderNumber}</DialogTitle>
          <DialogDescription>
            First CSV row for this Order number. Extra item rows are not extra
            orders.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Detail label="Buyer username" value={order.buyerUsername} />
          <Detail label="Sales record number" value={order.salesRecordNumber} />
          <Detail label="Item title (first row)" value={order.itemTitle} />
          <Detail label="Quantity (first row)" value={order.quantity} />
          <Detail
            label="Repeated item rows"
            value={String(order.extraRowCount)}
          />
          {FIELD_LABELS.map((field) => (
            <Detail
              key={field.key}
              label={field.label}
              value={order.delivery[field.key]}
            />
          ))}
        </dl>
        {extraNote ? (
          <p className="text-sm text-muted-foreground">{extraNote}</p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={onEdit}>
            Edit delivery details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words whitespace-pre-wrap">
        {value.trim() === "" ? (
          <span className="text-muted-foreground">Blank</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function EditDeliveryDialog({
  order,
  open,
  onOpenChange,
  onSave,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (delivery: DeliveryFields) => void;
}) {
  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditDeliveryForm
        key={`${order.orderNumber}-${String(open)}`}
        order={order}
        onOpenChange={onOpenChange}
        onSave={onSave}
      />
    </Dialog>
  );
}

function EditDeliveryForm({
  order,
  onOpenChange,
  onSave,
}: {
  order: Order;
  onOpenChange: (open: boolean) => void;
  onSave: (delivery: DeliveryFields) => void;
}) {
  const [draft, setDraft] = useState<DeliveryFields>({ ...order.delivery });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Edit delivery for {order.orderNumber}</DialogTitle>
        <DialogDescription>
          Duplicate groups are recalculated after you save. Original values
          stay on the shipping row unless you change them here.
        </DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft);
        }}
      >
          {FIELD_LABELS.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={`edit-${field.key}`}>{field.label}</Label>
              <Input
                id={`edit-${field.key}`}
                value={draft[field.key]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <DialogFooter className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save delivery details</Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}
