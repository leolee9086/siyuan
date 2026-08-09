import {describe, expect, it} from "vitest";
import {
    DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES,
    FILE_BROWSER_EDITOR_PREFERENCES_KEY,
    loadFileBrowserEditorPreferences,
    normalizeFileBrowserEditorPreferences,
    saveFileBrowserEditorPreferences,
} from "../../../src/sforge/fileBrowser/FileBrowserEditor.preferences";

function memoryStorage(initial?: string) {
    let value = initial;
    return {
        getItem: () => value ?? null,
        setItem: (_key: string, next: string) => { value = next; },
        read: () => value,
    };
}

describe("FileBrowserEditor preferences", () => {
    it("normalizes malformed persisted values to bounded editor settings", () => {
        expect(normalizeFileBrowserEditorPreferences({
            wordWrap: "invalid", tabSize: 100, autoSave: "yes", autoSaveDelay: 1,
            minimap: 1, fontSize: 100,
        })).toEqual({
            ...DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES,
            tabSize: 8,
            autoSaveDelay: 200,
            fontSize: 28,
        });
    });

    it("round-trips preferences through the namespaced storage key", () => {
        const storage = memoryStorage();
        const preferences = {
            wordWrap: "bounded" as const,
            tabSize: 2,
            autoSave: true,
            autoSaveDelay: 5000,
            minimap: true,
            fontSize: 18,
        };
        saveFileBrowserEditorPreferences(preferences, storage);
        expect(storage.read()).toContain(`"wordWrap":"bounded"`);
        expect(loadFileBrowserEditorPreferences(storage)).toEqual(preferences);
        expect(FILE_BROWSER_EDITOR_PREFERENCES_KEY).toBe("sforge.file-browser.editor.preferences");
    });

    it("does not let storage failures escape the editing path", () => {
        const broken = {
            getItem: () => { throw new Error("private mode"); },
            setItem: () => { throw new Error("quota"); },
        };
        expect(loadFileBrowserEditorPreferences(broken)).toEqual(DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES);
        expect(() => saveFileBrowserEditorPreferences(DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES, broken)).not.toThrow();
    });
});
