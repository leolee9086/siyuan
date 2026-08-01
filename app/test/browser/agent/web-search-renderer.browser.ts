import {describe, expect, it} from "vitest";
import {
    protectUnverifiedWebLinks,
    renderWebSearchProgress,
    renderWebSearchResult,
    resolveMappedWebReferences,
} from "../../../src/layout/dock/agent/chat/interaction/tools/websearch/renderer";

describe("native Agent web search cards", () => {
    it("renders live engine progress and recent results in the DOM", () => {
        const host = document.createElement("div");
        host.innerHTML = renderWebSearchProgress("React 19", {
            phase: "result",
            done: 2,
            total: 5,
            current: "github",
            partialCount: 3,
            latestResults: [{
                title: "React release notes",
                url: "https://example.com/react",
                engine: "github",
            }],
        });

        expect(host.querySelector(".agent-chat__web-search-progress")).not.toBeNull();
        expect(host.textContent).toContain("github");
        expect(host.textContent).toContain("2/5");
        expect(host.textContent).toContain("React release notes");
        expect(host.querySelector("a[href=\"https://example.com/react\"]")).not.toBeNull();
    });

    it("renders structured completion results and rejects unsafe links", () => {
        const host = document.createElement("div");
        host.innerHTML = renderWebSearchResult("release notes", "[tool_output]\n" + JSON.stringify({
            query: "release notes",
            provider: "meta",
            usedEngines: ["github"],
            results: [{
                title: "Safe result",
                url: "https://example.com/safe",
                snippet: "A useful summary",
                engines: ["github"],
            }, {
                title: "Unsafe result",
                url: "javascript:alert(1)",
                snippet: "Must not become a link",
                engines: ["github"],
            }],
        }) + "\n[/tool_output]");

        expect(host.querySelector(".agent-chat__tool-card--web-search-complete")).not.toBeNull();
        expect(host.textContent).toContain("Safe result");
        expect(host.textContent).toContain("A useful summary");
        expect(host.querySelector("a[href=\"https://example.com/safe\"]")).not.toBeNull();
        expect(host.querySelector("a[href^=\"javascript:\"]")).toBeNull();
    });

    it("resolves search references and blocks model-invented external links", () => {
        const host = document.createElement("div");
        host.innerHTML = '<a href="https://example.com/verified">verified</a><a href="https://news.invalid/invented">invented</a>';
        const opened: string[] = [];
        protectUnverifiedWebLinks(host, new Set(["https://example.com/verified"]), (url) => opened.push(url));

        expect(host.querySelector("a[href=\"https://example.com/verified\"]")).not.toBeNull();
        const blocked = host.querySelector("a[data-unverified-href]");
        expect(blocked?.getAttribute("data-unverified-href")).toBe("https://news.invalid/invented");
        blocked?.dispatchEvent(new MouseEvent("click", {bubbles: true, cancelable: true}));
        expect(opened).toEqual(["https://news.invalid/invented"]);
        const normalizedHost = document.createElement("a");
        normalizedHost.href = "https://example.com/";
        normalizedHost.textContent = "normalized";
        host.appendChild(normalizedHost);
        protectUnverifiedWebLinks(host, new Set(["https://example.com"]), (url) => opened.push(url));
        expect(normalizedHost.getAttribute("href")).toBe("https://example.com/");
        expect(resolveMappedWebReferences("[source](ref:web-ab12)", {
            "ref:web-ab12": "https://example.com/verified",
        })).toBe("[source](https://example.com/verified)");
    });

});
