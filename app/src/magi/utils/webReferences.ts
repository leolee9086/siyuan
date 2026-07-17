import {renderMarkdown} from "./lute";
import {ScalableBloomFilter} from "@leolee9086/bloom-filter";

const referenceTokenPattern = /ref:web-[0-9a-f]+/g;

function isRecord(value: unknown): boolean {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeMagiWebURL(value: string): string {
    try {
        const parsed = new URL(value);
        return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : "";
    } catch {
        return "";
    }
}

function readMagiWebSearchLinks(meta?: Record<string, unknown>): Record<string, string> {
    const raw = meta?.webSearchLinks;
    if (!isRecord(raw)) {
        return {};
    }
    const links: Record<string, string> = {};
    for (const [token, target] of Object.entries(raw as Record<string, unknown>)) {
        const safeURL = typeof target === "string" ? safeMagiWebURL(target) : "";
        if (/^ref:web-[0-9a-f]+$/.test(token) && safeURL) {
            links[token] = safeURL;
        }
    }
    return links;
}

function buildReferenceFilter(values: string[]): ScalableBloomFilter {
    const filter = new ScalableBloomFilter({initialCapacity: Math.max(64, values.length)});
    for (const value of values) {
        filter.add(value);
    }
    return filter;
}

/** Restore only backend-issued references before MAGI Markdown rendering. */
export function resolveMagiWebReferences(content: string, meta?: Record<string, unknown>): string {
    const links = readMagiWebSearchLinks(meta);
    const tokenFilter = buildReferenceFilter(Object.keys(links));
    return content.replace(referenceTokenPattern, token => {
        if (!tokenFilter.mayContain(token)) {
            return token;
        }
        const target = links[token];
        return target ? encodeURI(target) : token;
    });
}

/** Render MAGI content after resolving the private reference map. */
export function renderMagiWebMarkdown(content: string, meta?: Record<string, unknown>): string {
    return renderMarkdown(resolveMagiWebReferences(content, meta));
}

/** Quarantine links that were not returned by a MAGI search tool. */
export function protectMagiUnverifiedWebLinks(container: HTMLElement, meta?: Record<string, unknown>): void {
    const links = readMagiWebSearchLinks(meta);
    const verifiedURLs = new Set(Object.values(links));
    const urlFilter = buildReferenceFilter([...verifiedURLs]);
    for (const anchor of container.querySelectorAll<HTMLAnchorElement>("a")) {
        const href = anchor.getAttribute("href") || "";
        const safeURL = safeMagiWebURL(href);
        if (safeURL && !urlFilter.mayContain(safeURL)) {
            anchor.removeAttribute("href");
            anchor.setAttribute("data-unverified-href", href);
            anchor.title = "This link was not returned by MAGI web search";
            continue;
        }
        if (safeURL && verifiedURLs.has(safeURL)) {
            continue;
        }
        if (!safeURL && !href.startsWith("ref:")) {
            continue;
        }
        anchor.removeAttribute("href");
        anchor.setAttribute("data-unverified-href", href);
        anchor.title = "This link was not returned by MAGI web search";
    }
}
