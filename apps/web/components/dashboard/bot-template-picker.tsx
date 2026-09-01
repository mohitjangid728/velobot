import { PenLine } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BOT_TEMPLATES, type BotTemplate } from "@/lib/bot-templates";

export function BotTemplatePicker({ onSelect }: { onSelect: (template: BotTemplate | null) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Start from a template</h2>
        <p className="text-sm text-muted-foreground">Prefills the welcome message and behavior — everything stays editable.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BOT_TEMPLATES.map((template) => (
          <button key={template.id} type="button" onClick={() => onSelect(template)} className="text-left">
            <Card className="flex h-full flex-col gap-2 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <template.icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{template.label}</span>
              <span className="text-xs text-muted-foreground">{template.blurb}</span>
            </Card>
          </button>
        ))}
        <button type="button" onClick={() => onSelect(null)} className="text-left">
          <Card className="flex h-full flex-col gap-2 border-dashed p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <PenLine className="h-5 w-5" />
            </div>
            <span className="font-medium">Start from scratch</span>
            <span className="text-xs text-muted-foreground">Blank form, no presets.</span>
          </Card>
        </button>
      </div>
    </div>
  );
}
