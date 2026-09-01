import { describe, it, expect } from "vitest";
import { redactSensitiveNumbers } from "./pii-redaction";

describe("redactSensitiveNumbers", () => {
  it("redacts a credit-card-like number", () => {
    expect(redactSensitiveNumbers("My card is 4111 1111 1111 1111, please charge it")).toBe(
      "My card is [redacted], please charge it"
    );
  });

  it("redacts an SSN-like number", () => {
    expect(redactSensitiveNumbers("SSN: 123-45-6789")).toBe("SSN: [redacted]");
  });

  it("leaves email addresses untouched", () => {
    const text = "Reach me at jane@example.com anytime";
    expect(redactSensitiveNumbers(text)).toBe(text);
  });

  it("leaves phone numbers untouched", () => {
    const text = "Call me at 555-123-4567";
    expect(redactSensitiveNumbers(text)).toBe(text);
  });

  it("leaves ordinary short numbers untouched", () => {
    const text = "Order #4521 shipped yesterday";
    expect(redactSensitiveNumbers(text)).toBe(text);
  });
});
