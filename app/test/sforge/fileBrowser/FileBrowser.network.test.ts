import {describe, expect, it, vi} from "vitest";
import {type NetworkFetch, readFileBrowserNetworkFile} from "../../../src/sforge/fileBrowser/FileBrowser.network";

function response(
    text: string,
    headers: Record<string, string> = {},
    status = 200,
    statusText = "OK",
) {
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText,
        headers: new Headers(headers),
        text: vi.fn(async () => text),
    } as unknown as Response;
}

function fetchReturning(value: Response) {
    return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => value) as unknown as NetworkFetch & ReturnType<typeof vi.fn>;
}

describe("readFileBrowserNetworkFile", () => {
    it("uses GET, keeps a path extension ahead of Content-Type, and returns a read-only model", async () => {
        const fetchImpl = fetchReturning(response("const answer = 42;", {"content-type": "text/plain"}));
        const signal = new AbortController().signal;
        const document = await readFileBrowserNetworkFile({
            uri: "https://example.test/scripts/main.js?raw=1",
            signal,
            fetchImpl,
        });

        expect(fetchImpl).toHaveBeenCalledWith("https://example.test/scripts/main.js?raw=1", {
            method: "GET", signal,
        });
        expect(document).toMatchObject({
            uri: "https://example.test/scripts/main.js?raw=1",
            name: "main.js",
            language: "javascript",
            contentType: "text/plain",
            readOnly: true,
        });
        expect(document.text).toBe("const answer = 42;");
    });

    it("uses Content-Type language detection when the URL has no extension", async () => {
        const fetchImpl = fetchReturning(response("# remote", {"content-type": "text/markdown; charset=utf-8"}));
        const document = await readFileBrowserNetworkFile({uri: "https://example.test/raw/42", fetchImpl});
        expect(document.language).toBe("markdown");
        expect(document.name).toBe("42");
    });

    it("reports HTTP failures with status instead of returning an empty document", async () => {
        const fetchImpl = fetchReturning(response("not found", {}, 404, "Not Found"));
        await expect(readFileBrowserNetworkFile({uri: "https://example.test/missing.txt", fetchImpl}))
            .rejects.toMatchObject({code: "http", status: 404});
    });

    it("rejects a response that exceeds the configured byte limit", async () => {
        const fetchImpl = fetchReturning(response("ignored", {"content-length": "20"}));
        await expect(readFileBrowserNetworkFile({
            uri: "https://example.test/large.txt", maxBytes: 16, fetchImpl,
        })).rejects.toMatchObject({code: "too-large"});
    });

    it("reports cancellation and malformed URI at the network boundary", async () => {
        const abortFetch = vi.fn(async () => {
            throw new DOMException("The operation was aborted", "AbortError");
        }) as unknown as NetworkFetch;
        await expect(readFileBrowserNetworkFile({
            uri: "https://example.test/cancel.txt", fetchImpl: abortFetch,
        })).rejects.toMatchObject({code: "aborted"});
        await expect(readFileBrowserNetworkFile({
            uri: "file:///C:/secret.txt", fetchImpl: abortFetch,
        })).rejects.toMatchObject({code: "invalid-uri"});
    });
});
