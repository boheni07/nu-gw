"use client";

import type { HrRecord } from "@/types";
import HrRecordForm from "./form";

export default function HrRecordClient({ initial }: { initial: HrRecord }) {
  return (
    <HrRecordForm
      initial={initial}
      requireAgreement
      onSave={async (data) => {
        const res = await fetch("/api/hr-records/me", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        const json = await res.json();
        if (!res.ok) return { ok: false, error: json.error };
        return { ok: true, data: json as HrRecord };
      }}
    />
  );
}
