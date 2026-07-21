import {describe, expect, it} from "vitest";

const importNativeModule = async (url: string) => {
    const exportKey = `__agentPanelEntry${Date.now()}`;
    const loadedEvent = `${exportKey}:loaded`;
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `import * as entry from ${JSON.stringify(url)}; Reflect.set(window, ${JSON.stringify(exportKey)}, entry); window.dispatchEvent(new Event(${JSON.stringify(loadedEvent)}));`;
    await new Promise<void>((resolve, reject) => {
        window.addEventListener(loadedEvent, () => resolve(), {once: true});
        script.addEventListener("error", () => reject(new Error(`Failed to import native module: ${url}`)), {once: true});
        document.head.append(script);
    });
    const entry = Reflect.get(window, exportKey);
    Reflect.deleteProperty(window, exportKey);
    script.remove();
    return entry;
};

describe("standalone Agent Panel ESM entry", () => {
    it("exports the public mount factory", async () => {
        const entry = await importNativeModule("/agent-app/agent-panel.js");
        expect(entry).toHaveProperty("mountStandaloneAgentPanel");
        expect(Reflect.get(entry, "mountStandaloneAgentPanel")).toBeTypeOf("function");
    }, 10_000);
});
