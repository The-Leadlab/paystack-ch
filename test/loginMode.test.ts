import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOGIN_MODE,
  isMultiLoginMode,
  loginModeLabel,
  parseLoginMode,
} from "../shared/loginMode";

describe("loginMode universal shared policy", () => {
  it("defaults to shared", () => {
    expect(DEFAULT_LOGIN_MODE).toBe("shared");
  });

  it("ignores exclusive legacy values", () => {
    expect(parseLoginMode("exclusive")).toBe("shared");
    expect(parseLoginMode("shared")).toBe("shared");
    expect(parseLoginMode(undefined)).toBe("shared");
    expect(parseLoginMode(null)).toBe("shared");
  });

  it("always reports multi-login", () => {
    expect(isMultiLoginMode("exclusive")).toBe(true);
    expect(isMultiLoginMode("shared")).toBe(true);
    expect(loginModeLabel("exclusive")).toBe("shared");
  });
});
