"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_SHIPPING_SETTINGS,
  saveShippingSettings,
  type ShippingSettings,
} from "@/lib/shipping-settings";

const SENDER_FIELDS: Array<{ key: keyof ShippingSettings; label: string }> = [
  { key: "serviceType", label: "serviceType" },
  { key: "shipmentType", label: "shipmentType" },
  { key: "senderContactName", label: "senderContactName" },
  { key: "senderCompany", label: "senderCompany" },
  { key: "senderContactNumber", label: "senderContactNumber" },
  { key: "senderLine1", label: "senderLine1" },
  { key: "senderPostcode", label: "senderPostcode" },
  { key: "senderCity", label: "senderCity" },
  { key: "senderState", label: "senderState" },
  { key: "senderCountry", label: "senderCountry" },
  { key: "senderEmail", label: "senderEmail" },
];

const PACKAGE_FIELDS: Array<{ key: keyof ShippingSettings; label: string }> = [
  { key: "numberOfPackages", label: "numberOfPackages" },
  { key: "packageWeight", label: "packageWeight" },
  { key: "weightUnits", label: "weightUnits" },
  { key: "length", label: "length" },
  { key: "width", label: "width" },
  { key: "height", label: "height" },
  { key: "packageType", label: "packageType" },
  { key: "currencyType", label: "currencyType" },
  { key: "itemDescription", label: "itemDescription" },
];

export function ShippingSettingsPanel({
  settings,
  onChange,
}: {
  settings: ShippingSettings;
  onChange: (settings: ShippingSettings) => void;
}) {
  function updateField(key: keyof ShippingSettings, value: string) {
    const next = { ...settings, [key]: value };
    onChange(next);
    saveShippingSettings(next);
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Sender and package settings</CardTitle>
        <p className="text-sm text-muted-foreground">
          These values fill the template columns on every exported row. Recipient
          details come from each eBay order.
        </p>
      </CardHeader>
      <CardContent className="grid gap-6 pt-6 lg:grid-cols-2">
        <div className="grid gap-3 sm:grid-cols-2">
          {SENDER_FIELDS.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                value={settings[field.key]}
                onChange={(event) =>
                  updateField(field.key, event.target.value)
                }
              />
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {PACKAGE_FIELDS.map((field) => (
            <div key={field.key} className="grid gap-1.5">
              <Label htmlFor={field.key}>{field.label}</Label>
              <Input
                id={field.key}
                value={settings[field.key]}
                onChange={(event) =>
                  updateField(field.key, event.target.value)
                }
              />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onChange(DEFAULT_SHIPPING_SETTINGS);
                saveShippingSettings(DEFAULT_SHIPPING_SETTINGS);
              }}
            >
              Reset to template defaults
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
