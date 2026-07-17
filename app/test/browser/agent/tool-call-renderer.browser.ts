import {describe, expect, it} from "vitest";
import {
    renderToolCallProgress,
    renderToolCallResult,
    renderToolCallStart,
} from "../../../src/layout/dock/agent/toolcall/renderer";

describe("native Agent tool-call cards", () => {
    it("shows arguments, progress, and the complete escaped result", () => {
        const host = document.createElement("div");
        host.innerHTML = renderToolCallStart("fixture_tool", {path: "src/main.go"});
        expect(host.textContent).toContain("Arguments");
        expect(host.textContent).toContain("Running");

        host.innerHTML = renderToolCallProgress("fixture_tool", {path: "src/main.go"}, {
            phase: "result",
            done: 1,
            total: 2,
            current: "fixture",
            partialCount: 1,
        });
        expect(host.textContent).toContain("1/2");
        expect(host.textContent).toContain("fixture");

        host.innerHTML = renderToolCallResult("fixture_tool", {path: "src/main.go"}, "<script>alert(1)</script>");
        expect(host.textContent).toContain("<script>alert(1)</script>");
        expect(host.querySelector("script")).toBeNull();
        expect(host.textContent).toContain("Complete");
    });
});
