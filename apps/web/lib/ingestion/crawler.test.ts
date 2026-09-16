import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { crawlWebsite } from "@/lib/ingestion/crawler";

const PAGE_HTML = `<html><head><title>Example page</title></head><body>
  <main>
    <h1>Welcome to Example</h1>
    <p>This is a real paragraph of body copy that is long enough to clear the crawler's fifty character minimum length threshold easily.</p>
  </main>
</body></html>`;

function mockFetch(routes: Record<string, { status?: number; contentType?: string; body: string }>) {
  return vi.fn(async (input: string | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const key = Object.keys(routes).find((r) => url === r || url.startsWith(r));
    if (!key) return new Response("", { status: 404 });
    const route = routes[key]!;
    return new Response(route.body, {
      status: route.status ?? 200,
      headers: { "content-type": route.contentType ?? "text/html" },
    });
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 404 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("crawlWebsite", () => {
  it("crawls a sitemap page even when the sitemap declares the bare domain but the visitor submitted the www form", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://www.example.com/robots.txt": { body: "" },
        "https://www.example.com/sitemap.xml": {
          contentType: "application/xml",
          body: `<urlset><url><loc>https://example.com/page</loc></url></urlset>`,
        },
        "https://example.com/page": { body: PAGE_HTML },
      })
    );

    const pages = await crawlWebsite("https://www.example.com");
    expect(pages).toHaveLength(1);
    expect(pages[0]!.text).toContain("Welcome to Example");
  });

  it("crawls a sitemap page even when the sitemap declares www but the visitor submitted the bare domain", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://example.com/robots.txt": { body: "" },
        "https://example.com/sitemap.xml": {
          contentType: "application/xml",
          body: `<urlset><url><loc>https://www.example.com/page</loc></url></urlset>`,
        },
        "https://www.example.com/page": { body: PAGE_HTML },
      })
    );

    const pages = await crawlWebsite("https://example.com");
    expect(pages).toHaveLength(1);
    expect(pages[0]!.text).toContain("Welcome to Example");
  });

  it("still excludes a genuinely different domain referenced in the sitemap", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "https://example.com/robots.txt": { body: "" },
        "https://example.com/sitemap.xml": {
          contentType: "application/xml",
          body: `<urlset><url><loc>https://not-the-same-site.com/page</loc></url></urlset>`,
        },
        "https://not-the-same-site.com/page": { body: PAGE_HTML },
      })
    );

    const pages = await crawlWebsite("https://example.com");
    expect(pages).toHaveLength(0);
  });
});
