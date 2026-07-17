import {describe, expect, it} from "vitest";
import {
    protectMagiUnverifiedWebLinks,
    resolveMagiWebReferences,
} from "../../../src/magi/utils/webReferences";

describe("MAGI web source references", () => {
    it("restores only mapped references and quarantines invented links", () => {
        expect(resolveMagiWebReferences("[source](ref:web-abcd) ref:web-unknown", {
            webSearchLinks: {"ref:web-abcd": "https://example.com/source"},
        })).toBe("[source](https://example.com/source) ref:web-unknown");

        const host = document.createElement("div");
        host.innerHTML = '<a href="https://example.com/source">trusted</a><a href="https://news.invalid/invented">invented</a><a href="ref:web-unknown">unknown</a>';
        protectMagiUnverifiedWebLinks(host, {
            webSearchLinks: {"ref:web-abcd": "https://example.com/source"},
        });

        expect(host.querySelector("a[href=\"https://example.com/source\"]")).not.toBeNull();
        expect(host.querySelectorAll("a[data-unverified-href]")).toHaveLength(2);
        expect(host.querySelector("a[data-unverified-href=\"https://news.invalid/invented\"]")).not.toBeNull();
        expect(host.querySelector("a[data-unverified-href=\"ref:web-unknown\"]")).not.toBeNull();
    });

    it("keeps large historical maps exact", () => {
        const links: Record<string, string> = {};
        for (let i = 0; i < 10000; i++) {
            links[`ref:web-${i.toString(16)}`] = `https://example.com/history/${i}`;
        }
        const resolved = resolveMagiWebReferences("ref:web-270f ref:web-missing", {webSearchLinks: links});
        expect(resolved).toContain("https://example.com/history/9999");
        expect(resolved).toContain("ref:web-missing");
    });
});
