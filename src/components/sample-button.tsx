"use client";

import { Button } from "@/components/ui/button";

export function SampleButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="outline" onClick={onClick}>
      Load sample orders
    </Button>
  );
}
