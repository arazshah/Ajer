"use client";
import { Archive } from "lucide-react";
export function ConfirmArchive({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("این فایل بایگانی شود؟")) event.preventDefault();
      }}
    >
      <button className="btn p-2 text-red-600" aria-label="بایگانی">
        <Archive size={16} />
      </button>
    </form>
  );
}
