"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface KeyValueRow {
  key: string;
  value: string;
}

/** Repeating key/value row editor — used by the Connections header editor. */
export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "Header name",
  valuePlaceholder = "Value",
  addLabel = "Add header",
}: {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}) {
  function update(index: number, field: "key" | "value", value: string) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  function remove(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input placeholder={keyPlaceholder} value={row.key} onChange={(e) => update(i, "key", e.target.value)} />
          <Input placeholder={valuePlaceholder} value={row.value} onChange={(e) => update(i, "value", e.target.value)} />
          <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => onChange([...rows, { key: "", value: "" }])}>
        <Plus className="h-3.5 w-3.5" /> {addLabel}
      </Button>
    </div>
  );
}
