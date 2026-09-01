/**
 * Narrow, storage-side redaction — NOT a general PII scrubber. Only strips
 * patterns that are almost never legitimate for a bot to say out loud
 * (credit-card-like and SSN-like digit sequences), so it can't accidentally
 * eat an email or phone number a lead-capture bot is supposed to collect.
 * Applied to the assistant's own reply before it's persisted, when a bot
 * has `guardrails_pii_redaction_enabled` — see chat-runtime.ts.
 */

// 13-19 digits, optionally grouped by spaces/dashes — covers common
// card-number formats (Visa/MC/Amex/etc.). This is a best-effort net, not a
// compliance-grade PII/DLP system: a very long bare phone number could in
// theory also match, but ordinary phone formats (parens, short lengths)
// don't trip it, and the alternative — matching shorter digit runs — would
// eat legitimate order numbers and the like.
const CREDIT_CARD_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;
const SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

export function redactSensitiveNumbers(text: string): string {
  return text.replace(CREDIT_CARD_PATTERN, "[redacted]").replace(SSN_PATTERN, "[redacted]");
}
