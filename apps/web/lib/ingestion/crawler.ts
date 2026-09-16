import "server-only";
import * as cheerio from "cheerio";
import { CRAWLER_MAX_DEPTH, CRAWLER_MAX_PAGES } from "@velobot/shared";

export interface CrawledPage {
  url: string;
  title: string;
  text: string;
}

const BOILERPLATE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "header",
  "footer",
  "nav",
  "aside",
  "form",
  "svg",
  "iframe",
  "[role=navigation]",
  "[role=banner]",
  "[role=contentinfo]",
  ".cookie-banner",
  ".cookie-consent",
];

/** Strips nav/header/footer/script boilerplate and returns clean visible body text. */
export function extractCleanText(html: string): { title: string; text: string } {
  const $ = cheerio.load(html);
  BOILERPLATE_SELECTORS.forEach((sel) => $(sel).remove());

  const title = $("title").first().text().trim() || $("h1").first().text().trim();

  const main = $("main").length ? $("main") : $("body");
  const text = main
    .find("h1, h2, h3, h4, h5, h6, p, li, td, th, blockquote, pre, dt, dd")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();

  return { title, text };
}

async function fetchRobotsDisallowRules(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const body = await res.text();
    const rules: string[] = [];
    let applies = false;
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim();
      if (/^user-agent:\s*\*/i.test(line)) applies = true;
      else if (/^user-agent:/i.test(line)) applies = false;
      else if (applies && /^disallow:/i.test(line)) {
        const path = line.split(":")[1]?.trim();
        if (path) rules.push(path);
      }
    }
    return rules;
  } catch {
    return [];
  }
}

function isDisallowed(path: string, rules: string[]) {
  return rules.some((rule) => rule !== "" && path.startsWith(rule));
}

/**
 * `www.example.com` and `example.com` are different origins per the URL
 * spec, but the same site — and a sitemap frequently declares one host
 * while the visitor submitted the other (or a link on the page points at
 * the other form). Treating them as different origins silently drops every
 * seed/link from a same-site page, so this loosens the check to protocol +
 * port + www-normalized hostname instead of strict origin equality.
 */
function isSameSite(a: URL, b: URL): boolean {
  const normalize = (hostname: string) => hostname.replace(/^www\./, "");
  return a.protocol === b.protocol && a.port === b.port && normalize(a.hostname) === normalize(b.hostname);
}

async function discoverSitemapUrls(origin: string): Promise<string[]> {
  try {
    const res = await fetch(`${origin}/sitemap.xml`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    return $("url > loc")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
  } catch {
    return [];
  }
}

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  onProgress?: (pagesCrawled: number) => void;
}

/**
 * BFS crawl starting from a sitemap (if present) or the root URL alone.
 * Same-origin only, robots.txt-respecting, capped by page count and link
 * depth from the seed URLs so a misconfigured site can't run away.
 */
export async function crawlWebsite(rootUrl: string, opts: CrawlOptions = {}): Promise<CrawledPage[]> {
  const maxPages = Math.min(opts.maxPages ?? CRAWLER_MAX_PAGES, CRAWLER_MAX_PAGES);
  const maxDepth = opts.maxDepth ?? CRAWLER_MAX_DEPTH;

  const rootUrlParsed = new URL(rootUrl);
  const origin = rootUrlParsed.origin;
  const disallowRules = await fetchRobotsDisallowRules(origin);
  const sitemapUrls = await discoverSitemapUrls(origin);

  const seeds = sitemapUrls.length > 0 ? sitemapUrls.slice(0, maxPages) : [rootUrl];
  const queue: { url: string; depth: number }[] = seeds.map((url) => ({ url, depth: 0 }));
  const visited = new Set<string>();
  const pages: CrawledPage[] = [];

  while (queue.length > 0 && pages.length < maxPages) {
    const next = queue.shift()!;
    // split() always returns at least one element.
    const normalized = next.url.split("#")[0]!;
    if (visited.has(normalized)) continue;
    visited.add(normalized);

    let url: URL;
    try {
      url = new URL(normalized);
    } catch {
      continue;
    }
    if (!isSameSite(url, rootUrlParsed)) continue;
    if (isDisallowed(url.pathname, disallowRules)) continue;

    try {
      const res = await fetch(normalized, {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "VeloBotCrawler/1.0 (+https://velobot.example)" },
      });
      const contentType = res.headers.get("content-type") ?? "";
      if (!res.ok || !contentType.includes("text/html")) continue;

      const html = await res.text();
      const { title, text } = extractCleanText(html);
      if (text.length > 50) {
        pages.push({ url: normalized, title, text });
        opts.onProgress?.(pages.length);
      }

      if (next.depth < maxDepth && sitemapUrls.length === 0) {
        const $ = cheerio.load(html);
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (!href) return;
          try {
            const abs = new URL(href, normalized);
            abs.hash = "";
            if (isSameSite(abs, rootUrlParsed) && !visited.has(abs.href)) {
              queue.push({ url: abs.href, depth: next.depth + 1 });
            }
          } catch {
            // ignore malformed hrefs (mailto:, javascript:, etc.)
          }
        });
      }
    } catch {
      continue;
    }
  }

  return pages;
}
