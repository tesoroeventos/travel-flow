"use client";

import { Button } from "./Button";

export function PrintButton() {
  return (
    <Button className="no-print" onClick={() => window.print()}>
      Imprimir o guardar PDF
    </Button>
  );
}
