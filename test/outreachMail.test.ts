import { describe, expect, it } from "vitest";
import {
  mergeOutreachTemplate,
  parseOutreachCsv,
  parseOutreachFromAddress,
  renderOutreachHtml,
  resolveOutreachFromHeader,
  wrapBrandedLetterHtml,
} from "../shared/outreachMail.js";
import { getOutreachPreset } from "../shared/outreachPresets.js";

describe("parseOutreachCsv", () => {
  it("maps name, email, company, extra and skips bad rows", () => {
    const csv = `name,email,company,extra
Joshua,joshua@the-leadlab.com,The Leadlab,Geneva
,not-an-email,SkipCo,x
Ali,ALI@The-Leadlab.com,Leadlab,dup should skip
Kara,kara@the-leadlab.com,The Leadlab,
`;
    const { recipients, skipped } = parseOutreachCsv(csv);
    expect(recipients.map((r) => r.email)).toEqual([
      "joshua@the-leadlab.com",
      "ali@the-leadlab.com",
      "kara@the-leadlab.com",
    ]);
    expect(recipients[0].name).toBe("Joshua");
    expect(recipients[0].company).toBe("The Leadlab");
    expect(recipients[0].extra).toBe("Geneva");
    expect(skipped.length).toBe(1);
  });

  it("accepts alternate headers and quoted commas", () => {
    const csv = `First name,E-mail,Company name,notes
"Attia, Ali",ali@x.com,"The Leadlab, Geneva","hello, world"
`;
    const { recipients } = parseOutreachCsv(csv);
    expect(recipients).toHaveLength(1);
    expect(recipients[0].name).toBe("Attia, Ali");
    expect(recipients[0].company).toBe("The Leadlab, Geneva");
    expect(recipients[0].extra).toBe("hello, world");
  });
});

describe("mergeOutreachTemplate", () => {
  it("fills mustache and bracket placeholders", () => {
    const rec = {
      name: "Joshua",
      email: "joshua@the-leadlab.com",
      company: "The Leadlab",
      extra: "Geneva",
      fields: {},
    };
    const out = mergeOutreachTemplate(
      "Hi {{name}} at {{company}} ({{email}}) [First name] / [Your name]",
      rec,
      { sender: "Ali" }
    );
    expect(out).toBe("Hi Joshua at The Leadlab (joshua@the-leadlab.com) Joshua / Ali");
  });
});

describe("renderOutreachHtml", () => {
  it("wraps plain text in the branded letter", () => {
    const rec = {
      name: "Joshua",
      email: "joshua@x.com",
      company: "Leadlab",
      extra: "",
      fields: {},
    };
    const { html, text } = renderOutreachHtml({
      mode: "text",
      body: "Hi {{name}},\n\nWelcome to {{company}}.",
      recipient: rec,
      title: "Hello",
    });
    expect(text).toContain("Hi Joshua");
    expect(html).toContain("lucas@paystack.ch");
    expect(html).toContain("Source Serif 4");
    expect(html).toContain("Sora");
    expect(html).toContain("fonts.googleapis.com");
    expect(html).toContain("#E8423F");
    expect(html).toContain("Hi Joshua");
    expect(html).toContain("Welcome to Leadlab");
  });

  it("keeps a full HTML document after merge", () => {
    const rec = {
      name: "Kara",
      email: "kara@x.com",
      company: "Co",
      extra: "",
      fields: {},
    };
    const { html } = renderOutreachHtml({
      mode: "html",
      body: "<!DOCTYPE html><html><body>Hi {{name}}</body></html>",
      recipient: rec,
    });
    expect(html).toBe("<!DOCTYPE html><html><body>Hi Kara</body></html>");
  });
});

describe("outreach from address", () => {
  it("parses bare and display-name addresses on paystack.ch", () => {
    expect(parseOutreachFromAddress("lucas@paystack.ch")).toEqual({
      email: "lucas@paystack.ch",
      name: "",
    });
    expect(parseOutreachFromAddress("Paystack <JOSHUA@paystack.ch>")).toEqual({
      email: "joshua@paystack.ch",
      name: "Paystack",
    });
    expect(parseOutreachFromAddress("ali@the-leadlab.com")).toBeNull();
    expect(parseOutreachFromAddress("not-an-email")).toBeNull();
  });

  it("resolves a From header and rejects off-domain mailboxes", () => {
    expect(resolveOutreachFromHeader(undefined)).toBe("Paystack <lucas@paystack.ch>");
    expect(resolveOutreachFromHeader("joshua@paystack.ch")).toBe("Paystack <joshua@paystack.ch>");
    expect(resolveOutreachFromHeader("Ali <ali@paystack.ch>")).toBe("Ali <ali@paystack.ch>");
    expect(() => resolveOutreachFromHeader("ali@gmail.com")).toThrow(/paystack\.ch/);
  });
});

describe("presets", () => {
  it("builds the beta invite as a full branded document", () => {
    const preset = getOutreachPreset("beta-invite");
    expect(preset.mode).toBe("html");
    expect(preset.body).toContain("<!DOCTYPE html>");
    expect(preset.body).toContain("{{name}}");
    expect(preset.body).toContain("upload-demo-v2.gif");
    expect(preset.body).toContain("calendar.app.google");
    expect(preset.body).toContain("Une bêta privée pour les PME à Genève");
    // French greeting appears before English greeting in FR-first layout
    const frIdx = preset.body.indexOf("Bonjour {{name}}");
    const enIdx = preset.body.indexOf("Hi {{name}}");
    expect(frIdx).toBeGreaterThan(-1);
    expect(enIdx).toBeGreaterThan(frIdx);
    expect(wrapBrandedLetterHtml({ title: "T", innerHtml: "<p>x</p>" })).toContain("Paystack.ch");
  });
});
