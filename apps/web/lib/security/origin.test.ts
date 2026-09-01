import { describe, it, expect } from "vitest";
import { isOriginAllowed } from "./origin";

function requestWithOrigin(origin: string | null): Request {
  const headers = new Headers();
  if (origin) headers.set("origin", origin);
  return new Request("https://api.velobot.example/api/chat/stream", { headers });
}

describe("isOriginAllowed", () => {
  it("blocks a bot with an empty allowlist even for a plausible-looking origin", () => {
    expect(isOriginAllowed({ allowed_domains: [] }, requestWithOrigin("https://acme.com"))).toBe(false);
  });

  it("allows an exact domain match", () => {
    expect(isOriginAllowed({ allowed_domains: ["acme.com"] }, requestWithOrigin("https://acme.com"))).toBe(true);
  });

  it("allows a subdomain of an allowed domain", () => {
    expect(isOriginAllowed({ allowed_domains: ["acme.com"] }, requestWithOrigin("https://app.acme.com"))).toBe(true);
  });

  it("rejects an unrelated domain", () => {
    expect(isOriginAllowed({ allowed_domains: ["acme.com"] }, requestWithOrigin("https://evil.com"))).toBe(false);
  });

  it("rejects a lookalike domain that merely ends with the allowed string", () => {
    // "notacme.com" ends with "acme.com" as a raw substring but is not
    // "acme.com" or a real subdomain of it — the `.${cleaned}` suffix check
    // must reject this, not just do a naive .endsWith(cleaned).
    expect(isOriginAllowed({ allowed_domains: ["acme.com"] }, requestWithOrigin("https://notacme.com"))).toBe(false);
  });

  it("rejects a request with no Origin or Referer header", () => {
    expect(isOriginAllowed({ allowed_domains: ["acme.com"] }, requestWithOrigin(null))).toBe(false);
  });
});
