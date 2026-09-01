import { Globe, Mail, MapPin, Clock, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import type { Conversation, ConversationSentiment } from "@velobot/shared";

function Field({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words">{value}</p>
      </div>
    </div>
  );
}

const SENTIMENT_VARIANT: Record<ConversationSentiment, "success" | "secondary" | "serious"> = {
  positive: "success",
  neutral: "secondary",
  negative: "serious",
};

const ENTITY_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  order_id: "Order",
  product: "Product",
};

export function CustomerPanel({ conversation }: { conversation: Conversation }) {
  const hasExtractedData =
    conversation.extracted_intent || conversation.extracted_sentiment || conversation.extracted_entities;

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-sm font-semibold">Visitor details</h2>
      <Field icon={Mail} label="Email" value={conversation.visitor_email ?? "Not provided"} />
      <Field icon={Globe} label="Page" value={conversation.visitor_url ?? "Unknown"} />
      <Field icon={MapPin} label="Location" value={conversation.visitor_location ?? `IP: ${conversation.visitor_ip ?? "Unknown"}`} />
      <Field icon={Clock} label="Started" value={format(new Date(conversation.created_at), "PPp")} />

      {hasExtractedData && (
        <div className="flex flex-col gap-2.5 border-t pt-4">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> AI-detected
          </h2>
          <p className="-mt-1.5 text-xs text-muted-foreground">A hint from the conversation, not verified — always confirm with the visitor.</p>

          {(conversation.extracted_intent || conversation.extracted_sentiment) && (
            <div className="flex flex-wrap items-center gap-1.5">
              {conversation.extracted_intent && <Badge variant="outline">{conversation.extracted_intent}</Badge>}
              {conversation.extracted_sentiment && (
                <Badge variant={SENTIMENT_VARIANT[conversation.extracted_sentiment]} className="capitalize">
                  {conversation.extracted_sentiment}
                </Badge>
              )}
            </div>
          )}

          {conversation.extracted_entities && Object.keys(conversation.extracted_entities).length > 0 && (
            <div className="flex flex-col gap-2">
              {Object.entries(conversation.extracted_entities).map(([key, value]) => (
                <Field key={key} icon={Sparkles} label={ENTITY_LABEL[key] ?? key} value={value} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
