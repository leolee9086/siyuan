import {describe, expect, it, vi} from "vitest";
import {getStandaloneDailyNoteId} from "../../../src/protyle-standalone/bootstrap";
import type {IStandaloneSiyuanRuntime} from "../../../src/protyle-standalone/standalone.types";

const importNativeModule = async (url: string) => {
    const exportKey = `__protyleEntry${Date.now()}`;
    const loadedEvent = `${exportKey}:loaded`;
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `import * as entry from ${JSON.stringify(url)}; Reflect.set(window, ${JSON.stringify(exportKey)}, entry); window.dispatchEvent(new Event(${JSON.stringify(loadedEvent)}));`;

    await new Promise<void>((resolve, reject) => {
        window.addEventListener(loadedEvent, () => resolve(), {once: true});
        script.addEventListener("error", () => reject(new Error(`Failed to import native module: ${url}`)), {once: true});
        document.head.append(script);
    });

    const entry = Reflect.get(window, exportKey) as Record<string, unknown>;
    Reflect.deleteProperty(window, exportKey);
    script.remove();
    return entry;
};

describe("standalone Protyle ESM entry", () => {
    it("exposes the mount factory through a native module import", async () => {
        const entry = await importNativeModule("/protyle-app/protyle.js");

        expect(entry).toHaveProperty("mountStandaloneProtyle");
        expect(entry.mountStandaloneProtyle).toBeTypeOf("function");
    }, 10_000);

    it("resolves an omitted block ID through the daily note kernel contract", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
            const path = String(input);
            const data = path.includes("lsNotebooks")
                ? {notebooks: [
                    {id: "closed", closed: true},
                    {id: "preferred", closed: false},
                    {id: "fallback", closed: false},
                ]}
                : {id: "daily-note-id"};
            return new Response(JSON.stringify({code: 0, msg: "", data}), {
                status: 200,
                headers: {"Content-Type": "application/json"},
            });
        });
        const runtime = {
            storage: {"local-dailynoteid": "preferred"},
        } as unknown as IStandaloneSiyuanRuntime;

        await expect(getStandaloneDailyNoteId(runtime)).resolves.toBe("daily-note-id");
        expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({flashcard: false});
        expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toEqual({
            notebook: "preferred",
            app: "protyle-standalone",
        });
        expect(runtime.storage["local-dailynoteid"]).toBe("preferred");
        fetchMock.mockRestore();
    });
});
