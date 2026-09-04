import "server-only";

/**
 * Table-based layout with every style inline — the only HTML/CSS subset
 * that renders consistently across Gmail, Outlook (desktop's Word engine
 * strips <style> blocks and ignores flexbox/grid entirely), and mobile
 * mail clients. Every email VeloBot sends should go through this so they
 * share one look rather than each call site hand-rolling its own markup.
 */

/** Escapes untrusted values (e.g. a chat visitor's self-reported email, never validated as a real email format upstream) before they're interpolated into an email template's HTML — the same category of risk as rendering user input into a web page. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const INDIGO = "#4F46E5";
const INK = "#0F1424";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const SURFACE = "#F6F7F9";

/** The bot-in-square mark, reproduced as a tiny inline table since email clients don't reliably load external SVGs/fonts and this needs to render identically everywhere. Mirrors the favicon/OG banner mark. */
function logoMarkHtml(): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="36" height="36" style="background:${INDIGO};border-radius:9px;">
      <tr>
        <td align="center" valign="middle" style="width:36px;height:36px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td align="center" style="font-size:0;line-height:0;">
              <div style="width:20px;height:16px;background:#ffffff;border-radius:5px;margin:0 auto;"></div>
            </td></tr>
          </table>
        </td>
      </tr>
    </table>`;
}

/** A "bulletproof" button — a table cell carries the background/border-radius rather than the <a> itself, which Outlook's Word rendering engine otherwise ignores. */
function ctaButtonHtml(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0;">
      <tr>
        <td align="center" style="border-radius:8px;background:${INDIGO};">
          <a href="${url}" target="_blank" style="display:inline-block;padding:13px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

export function renderEmailTemplate(opts: {
  /** Shown by the email client's inbox preview line, hidden in the rendered body — summarize the email in one line. */
  previewText: string;
  heading: string;
  /** Pre-escaped paragraph HTML — each string becomes its own <p>. Keep copy plain; this isn't a general-purpose rich-text renderer. */
  paragraphs: string[];
  /** Raw block-level HTML (e.g. a receipt table) rendered as-is between the paragraphs and the CTA — never wrapped in a <p>, unlike paragraphs above. */
  bodyHtml?: string;
  cta?: { text: string; url: string };
  /** Small print under the button — e.g. "This link expires in 7 days." */
  footnote?: string;
}): string {
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background:${SURFACE};">
    <div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${SURFACE};">${opts.previewText}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${SURFACE};padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="max-width:560px;width:100%;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="padding:32px 40px 0 40px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="padding-right:10px;">${logoMarkHtml()}</td>
                    <td style="font-family:${font};font-size:18px;font-weight:700;color:${INK};">VeloBot</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 40px 8px 40px;">
                <h1 style="margin:0;font-family:${font};font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.01em;">${opts.heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 40px 0 40px;font-family:${font};font-size:15px;line-height:1.6;color:${MUTED};">
                ${opts.paragraphs.map((p) => `<p style="margin:12px 0;">${p}</p>`).join("")}
              </td>
            </tr>
            ${opts.bodyHtml ? `<tr><td style="padding:0 40px;">${opts.bodyHtml}</td></tr>` : ""}
            ${
              opts.cta
                ? `<tr><td style="padding:4px 40px 0 40px;">${ctaButtonHtml(opts.cta.text, opts.cta.url)}</td></tr>`
                : ""
            }
            ${
              opts.footnote
                ? `<tr><td style="padding:0 40px 32px 40px;font-family:${font};font-size:13px;color:${MUTED};">${opts.footnote}</td></tr>`
                : `<tr><td style="padding-bottom:32px;"></td></tr>`
            }
            <tr>
              <td style="padding:20px 40px;border-top:1px solid ${BORDER};font-family:${font};font-size:12px;color:${MUTED};">
                Sent by VeloBot &middot; AI support platform
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
