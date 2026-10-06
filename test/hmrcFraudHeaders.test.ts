import { describe, expect, it } from "vitest";
import {
  buildHmrcFraudHeaders,
  resolveClientIp,
} from "../lib/hmrcFraudHeaders.js";

describe("resolveClientIp", () => {
  it("prefers the first X-Forwarded-For hop", () => {
    expect(resolveClientIp("203.0.113.10, 10.0.0.1", "127.0.0.1")).toBe("203.0.113.10");
  });

  it("falls back when X-Forwarded-For is missing", () => {
    expect(resolveClientIp(undefined, "192.0.2.1")).toBe("192.0.2.1");
  });
});

describe("buildHmrcFraudHeaders", () => {
  it("builds Gov-Client and Gov-Vendor headers from client + server info", () => {
    const headers = buildHmrcFraudHeaders(
      {
        deviceId: "device-uuid-1",
        userAgent: "Mozilla/5.0 Test",
        timezone: -60,
        screens: "width=1920&height=1080&scaling-factor=1&colour-depth=24",
        windowSize: "width=1200&height=800",
        plugins: ["PDF Viewer", "Chrome PDF Viewer"],
        localIps: ["192.168.1.5"],
        multiFactor: "type=OTHER&timestamp=2020-01-01T00:00:00.000Z&unique-reference=abc",
      },
      {
        clientIp: "203.0.113.50",
        vendorProductName: "Paystack",
        vendorVersion: "paystack=1.0.0",
        vendorPublicIp: "198.51.100.1",
        vendorLicenseIds: "hmrc=sandbox",
      }
    );

    expect(headers["Gov-Client-Public-IP"]).toBe("203.0.113.50");
    expect(headers["Gov-Client-Device-ID"]).toBe("device-uuid-1");
    expect(headers["Gov-Client-User-Agent"]).toBe("Mozilla/5.0 Test");
    expect(headers["Gov-Client-Timezone"]).toBe("UTC+60");
    expect(headers["Gov-Client-Screens"]).toContain("1920");
    expect(headers["Gov-Client-Window-Size"]).toContain("1200");
    expect(headers["Gov-Client-Browser-Plugins"]).toBe("PDF Viewer,Chrome PDF Viewer");
    expect(headers["Gov-Client-Local-IPs"]).toBe("192.168.1.5");
    expect(headers["Gov-Client-Multi-Factor"]).toContain("OTHER");
    expect(headers["Gov-Client-Connection-Method"]).toBe("WEB_APP_VIA_SERVER");
    expect(headers["Gov-Vendor-Product-Name"]).toBe("Paystack");
    expect(headers["Gov-Vendor-Version"]).toBe("paystack=1.0.0");
    expect(headers["Gov-Vendor-Public-IP"]).toBe("198.51.100.1");
    expect(headers["Gov-Vendor-License-IDs"]).toBe("hmrc=sandbox");
  });

  it("omits empty optional fields", () => {
    const headers = buildHmrcFraudHeaders({}, { clientIp: "203.0.113.1" });
    expect(headers["Gov-Client-Public-IP"]).toBe("203.0.113.1");
    expect(headers["Gov-Client-Connection-Method"]).toBe("WEB_APP_VIA_SERVER");
    expect(headers["Gov-Vendor-Product-Name"]).toBe("Paystack");
    expect(headers["Gov-Client-Device-ID"]).toBeUndefined();
    expect(headers["Gov-Vendor-Version"]).toBeUndefined();
  });

  it("lets client publicIp override server clientIp", () => {
    const headers = buildHmrcFraudHeaders(
      { publicIp: "198.51.100.9" },
      { clientIp: "203.0.113.1" }
    );
    expect(headers["Gov-Client-Public-IP"]).toBe("198.51.100.9");
  });
});
