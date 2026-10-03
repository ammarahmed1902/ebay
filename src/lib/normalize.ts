import type { DeliveryFields } from "@/lib/types";

const COUNTRY_ALIASES: Record<string, string> = {
  "united kingdom": "GB",
  "united kingdom of great britain and northern ireland": "GB",
  uk: "GB",
  "great britain": "GB",
  gb: "GB",
  gbr: "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  "isle of man": "IM",
  im: "IM",
  jersey: "JE",
  je: "JE",
  guernsey: "GG",
  gg: "GG",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
  america: "US",
  ireland: "IE",
  "republic of ireland": "IE",
  eire: "IE",
  ie: "IE",
  france: "FR",
  fr: "FR",
  germany: "DE",
  de: "DE",
  deutschland: "DE",
  spain: "ES",
  es: "ES",
  italy: "IT",
  it: "IT",
  netherlands: "NL",
  holland: "NL",
  nl: "NL",
  belgium: "BE",
  be: "BE",
  australia: "AU",
  au: "AU",
  canada: "CA",
  ca: "CA",
  "new zealand": "NZ",
  nz: "NZ",
  poland: "PL",
  pl: "PL",
  portugal: "PT",
  pt: "PT",
  sweden: "SE",
  se: "SE",
  switzerland: "CH",
  ch: "CH",
  austria: "AT",
  at: "AT",
  denmark: "DK",
  dk: "DK",
  norway: "NO",
  no: "NO",
  finland: "FI",
  fi: "FI",
};

const UK_POSTCODE_COUNTRIES = new Set(["GB", "IM", "JE", "GG"]);

const REQUIRED_DELIVERY_FIELDS: (keyof DeliveryFields)[] = [
  "postToName",
  "postToPhone",
  "postToAddress1",
  "postToCity",
  "postToCounty",
  "postToPostcode",
  "postToCountry",
];

export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeCountry(value: string): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  if (COUNTRY_ALIASES[normalized]) return COUNTRY_ALIASES[normalized];
  if (/^[a-z]{2}$/.test(normalized)) return normalized.toUpperCase();
  return normalized;
}

export function normalizeUkPostcode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function normalizePostcode(value: string, countryCode: string): string {
  if (UK_POSTCODE_COUNTRIES.has(countryCode)) {
    return normalizeUkPostcode(value);
  }
  return normalizeText(value);
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/[^\d+]/g, "");
}

export function hasRequiredDeliveryFields(delivery: DeliveryFields): boolean {
  return REQUIRED_DELIVERY_FIELDS.every((field) => delivery[field].trim() !== "");
}

export function address2Key(value: string): string {
  return normalizeText(value);
}

export function deliveryMatchKey(delivery: DeliveryFields): string | null {
  if (!hasRequiredDeliveryFields(delivery)) return null;

  const country = normalizeCountry(delivery.postToCountry);
  return [
    normalizeText(delivery.postToName),
    normalizePhone(delivery.postToPhone),
    normalizeText(delivery.postToAddress1),
    normalizeText(delivery.postToCity),
    normalizeText(delivery.postToCounty),
    normalizePostcode(delivery.postToPostcode, country),
    country,
  ].join("\u001f");
}
