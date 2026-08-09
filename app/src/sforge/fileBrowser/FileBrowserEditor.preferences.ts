/**
 * 文件编辑器的运行期偏好。
 *
 * 参考：Zuoqiu-Yingyi/siyuan-plugin-monaco-editor 的 editor options、Alt+Z
 * 换行动作和设置持久化；实现只保存 S-Forge 自己的 UI 偏好，不复制参考插件
 * 的桥接或文件处理代码。
 */

export type FileBrowserEditorWordWrap = "off" | "on" | "wordWrapColumn" | "bounded";

export interface FileBrowserEditorPreferences {
    wordWrap: FileBrowserEditorWordWrap;
    tabSize: number;
    autoSave: boolean;
    autoSaveDelay: number;
    minimap: boolean;
    fontSize: number;
}

export const FILE_BROWSER_EDITOR_PREFERENCES_KEY = "sforge.file-browser.editor.preferences";

export const DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES: Readonly<FileBrowserEditorPreferences> = {
    wordWrap: "on",
    tabSize: 4,
    autoSave: false,
    autoSaveDelay: 1000,
    minimap: false,
    fontSize: 13,
};

const WORD_WRAP_VALUES: readonly FileBrowserEditorWordWrap[] = ["off", "on", "wordWrapColumn", "bounded"];

function finiteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function normalizeTabSize(value: unknown) {
    return finiteNumber(value) ? Math.min(8, Math.max(1, Math.round(value))) : DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES.tabSize;
}

function normalizeDelay(value: unknown) {
    return finiteNumber(value) ? Math.min(10000, Math.max(200, Math.round(value))) : DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES.autoSaveDelay;
}

function normalizeFontSize(value: unknown) {
    return finiteNumber(value) ? Math.min(28, Math.max(10, Math.round(value))) : DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES.fontSize;
}

export function normalizeFileBrowserEditorPreferences(value: unknown): FileBrowserEditorPreferences {
    const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return {
        wordWrap: WORD_WRAP_VALUES.includes(source.wordWrap as FileBrowserEditorWordWrap)
            ? source.wordWrap as FileBrowserEditorWordWrap
            : DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES.wordWrap,
        tabSize: normalizeTabSize(source.tabSize),
        autoSave: source.autoSave === true,
        autoSaveDelay: normalizeDelay(source.autoSaveDelay),
        minimap: source.minimap === true,
        fontSize: normalizeFontSize(source.fontSize),
    };
}

export function loadFileBrowserEditorPreferences(storage: Pick<Storage, "getItem"> | undefined =
    typeof localStorage === "undefined" ? undefined : localStorage) {
    if (!storage) {
        return {...DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES};
    }
    try {
        const raw = storage.getItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY);
        return normalizeFileBrowserEditorPreferences(raw ? JSON.parse(raw) : undefined);
    } catch {
        return {...DEFAULT_FILE_BROWSER_EDITOR_PREFERENCES};
    }
}

export function saveFileBrowserEditorPreferences(
    preferences: FileBrowserEditorPreferences,
    storage: Pick<Storage, "setItem"> | undefined = typeof localStorage === "undefined" ? undefined : localStorage,
) {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(FILE_BROWSER_EDITOR_PREFERENCES_KEY, JSON.stringify(normalizeFileBrowserEditorPreferences(preferences)));
    } catch {
        // Storage quota and privacy-mode failures must not prevent editing.
    }
}
