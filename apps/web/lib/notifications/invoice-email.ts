import "server-only";
import { sendEmail } from "@/lib/notifications/email";
import { renderEmailTemplate, escapeHtml } from "@/lib/notifications/email-template";
import type { Currency } from "@velobot/shared";

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: "$", INR: "₹" };

/**
 * Sent right after a successful Razorpay payment — see the `order.paid`
 * handling in app/api/razorpay/verify/route.ts and webhook/route.ts,
 * which both call applyPlanActivation/applyAddonSeatActivation/
 * applyAddonMessagesCredit for the exact same purchase but are mutually
 * exclusive per order (the shared idempotency guard means only one of the
 * two ever actually runs), so calling this alongside whichever one wins
 * naturally sends exactly one invoice per purchase.
 */
export async function sendInvoiceEmail(
  to: string,
  opts: {
    orgName: string;
    lineItem: string;
    amount: number;
    currency: Currency;
    orderId: string;
    date: Date;
  }
): Promise<void> {
  const orgName = escapeHtml(opts.orgName);
  const lineItem = escapeHtml(opts.lineItem);
  const amountLabel = `${CURRENCY_SYMBOL[opts.currency]}${opts.amount.toLocaleString()}`;
  const dateLabel = opts.date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const receiptTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #E5E7EB;border-radius:12px;overflow:hidden;border-collapse:separate;">
      <tr>
        <td style="padding:16px 20px;border-bottom:1px solid #E5E7EB;background:#F6F7F9;font:600 13px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F1424;">
          Receipt
        </td>
      </tr>
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6B7280;">Workspace</td>
              <td align="right" style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F1424;">${orgName}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6B7280;">Item</td>
              <td align="right" style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F1424;">${lineItem}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6B7280;">Date</td>
              <td align="right" style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F1424;">${dateLabel}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;font:14px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6B7280;">Reference</td>
              <td align="right" style="padding:4px 0;font:13px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#6B7280;">${escapeHtml(opts.orderId)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding-top:12px;border-top:1px solid #E5E7EB;"></td>
            </tr>
            <tr>
              <td style="padding:8px 0 0;font:700 15px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0F1424;">Total paid</td>
              <td align="right" style="padding:8px 0 0;font:700 17px -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#4F46E5;">${amountLabel}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const html = renderEmailTemplate({
    previewText: `Your VeloBot receipt for ${lineItem} — ${amountLabel}.`,
    heading: "Payment received — thank you!",
    paragraphs: [`This confirms your payment for <strong>${orgName}</strong> on VeloBot.`],
    bodyHtml: receiptTable,
    footnote: "Keep this email for your records. Questions about a charge? Just reply to this email.",
  });
  await sendEmail(to, `Your VeloBot receipt — ${opts.lineItem}`, html);
}
