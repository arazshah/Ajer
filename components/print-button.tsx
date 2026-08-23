"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn" type="button">
      <Printer size={17} /> چاپ
    </button>
  );
}
