import { describe, it, expect } from "vitest";
import { resolveHeadingNumberEnabled } from "./headingNumberCore";

describe("headingNumber breadcrumb integration", () => {
    it("resolves per-document override correctly", () => {
        expect(resolveHeadingNumberEnabled("true", false)).toBe(true);
        expect(resolveHeadingNumberEnabled("false", true)).toBe(false);
        expect(resolveHeadingNumberEnabled(null, true)).toBe(true);
        expect(resolveHeadingNumberEnabled(undefined, false)).toBe(false);
        expect(resolveHeadingNumberEnabled("", true)).toBe(true);
    });
});
