export function classificationLabel(
  classification: "matching" | "address2-differs",
): string {
  return classification === "address2-differs"
    ? "Address line 2 differs"
    : "Matching delivery details";
}

export function reviewLabel(
  status: "unreviewed" | "reviewed-keep-separate",
): string {
  return status === "reviewed-keep-separate"
    ? "Reviewed — keep separate"
    : "Needs review";
}

export function displayValue(value: string, empty = "Blank"): string {
  return value.trim() === "" ? empty : value;
}
