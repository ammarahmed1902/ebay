import templateMetadata from "@/lib/template-metadata.json" with { type: "json" };

export type ShippingSettings = {
  serviceType: string;
  shipmentType: string;
  senderContactName: string;
  senderCompany: string;
  senderContactNumber: string;
  senderLine1: string;
  senderPostcode: string;
  senderCity: string;
  senderState: string;
  senderCountry: string;
  senderEmail: string;
  numberOfPackages: string;
  packageWeight: string;
  weightUnits: string;
  length: string;
  width: string;
  height: string;
  etdEnabled: string;
  packageType: string;
  currencyType: string;
  commodityType: string;
  itemDescription: string;
  manufacturingCountry: string;
  commodityQuantity: string;
  commodityMeasureUnit: string;
  commodityWeight: string;
  customsValue: string;
  purposeOfShipment: string;
  generateInvoice: string;
};

const defaults = templateMetadata.defaultRowValues as Record<
  string,
  string | number | null
>;

function asString(value: string | number | null | undefined): string {
  if (value == null) return "";
  return String(value);
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  serviceType: asString(defaults.serviceType),
  shipmentType: asString(defaults.shipmentType),
  senderContactName: asString(defaults.senderContactName),
  senderCompany: asString(defaults.senderCompany),
  senderContactNumber: asString(defaults.senderContactNumber),
  senderLine1: asString(defaults.senderLine1),
  senderPostcode: asString(defaults.senderPostcode),
  senderCity: asString(defaults.senderCity),
  senderState: asString(defaults.senderState),
  senderCountry: asString(defaults.senderCountry),
  senderEmail: asString(defaults.senderEmail),
  numberOfPackages: asString(defaults.numberOfPackages),
  packageWeight: asString(defaults.packageWeight),
  weightUnits: asString(defaults.weightUnits),
  length: asString(defaults.length),
  width: asString(defaults.width),
  height: asString(defaults.height),
  etdEnabled: asString(defaults.etdEnabled),
  packageType: asString(defaults.packageType),
  currencyType: asString(defaults.currencyType),
  commodityType: asString(defaults.commodityType),
  itemDescription: asString(defaults.itemDescription),
  manufacturingCountry: asString(defaults.manufacturingCountry),
  commodityQuantity: asString(defaults.commodityQuantity),
  commodityMeasureUnit: asString(defaults.commodityMeasureUnit),
  commodityWeight: asString(defaults.commodityWeight),
  customsValue: asString(defaults.customsValue),
  purposeOfShipment: asString(defaults.purposeOfShipment),
  generateInvoice: asString(defaults.generateInvoice),
};

export const SHIPPING_SETTINGS_STORAGE_KEY = "shipping-desk-settings-v1";

export function loadShippingSettings(): ShippingSettings {
  if (typeof window === "undefined") return DEFAULT_SHIPPING_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SHIPPING_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SHIPPING_SETTINGS;
    return { ...DEFAULT_SHIPPING_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SHIPPING_SETTINGS;
  }
}

export function saveShippingSettings(settings: ShippingSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SHIPPING_SETTINGS_STORAGE_KEY,
    JSON.stringify(settings),
  );
}
