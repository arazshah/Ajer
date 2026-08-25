"use client";
import { Archive, Trash2 } from "lucide-react";
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

export function ConfirmMediaDelete({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("این تصویر یا رسانه برای همیشه حذف شود؟"))
          event.preventDefault();
      }}
    >
      <button className="btn p-2 text-red-600" aria-label="حذف رسانه">
        <Trash2 size={15} />
      </button>
    </form>
  );
}
