import { describe, it, expect } from "vitest";
import { escapeHtml, renderEmailTemplate } from "./email-template";

describe("escapeHtml", () => {
  it("escapes angle brackets so injected tags render as text, not markup", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapes ampersands, quotes, and apostrophes", () => {
    expect(escapeHtml(`Tom & "Jerry" 'Inc'`)).toBe("Tom &amp; &quot;Jerry&quot; &#39;Inc&#39;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeHtml("visitor@example.com")).toBe("visitor@example.com");
  });
});

describe("renderEmailTemplate", () => {
  it("includes the heading, every paragraph, and the preview text", () => {
    const html = renderEmailTemplate({
      previewText: "Preview line",
      heading: "Hello there",
      paragraphs: ["First paragraph", "Second paragraph"],
    });
    expect(html).toContain("Hello there");
    expect(html).toContain("First paragraph");
    expect(html).toContain("Second paragraph");
    expect(html).toContain("Preview line");
  });

  it("renders a CTA button with the given url and text only when cta is provided", () => {
    const withCta = renderEmailTemplate({
      previewText: "p",
      heading: "h",
      paragraphs: [],
      cta: { text: "Click me", url: "https://example.com/accept" },
    });
    expect(withCta).toContain("https://example.com/accept");
    expect(withCta).toContain("Click me");

    const withoutCta = renderEmailTemplate({ previewText: "p", heading: "h", paragraphs: [] });
    expect(withoutCta).not.toContain('href="https://example.com/accept"');
  });

  it("is valid enough HTML to at least open/close the outer document tags", () => {
    const html = renderEmailTemplate({ previewText: "p", heading: "h", paragraphs: [] });
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html.trim().endsWith("</html>")).toBe(true);
  });
});
