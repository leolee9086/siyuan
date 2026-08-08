/**
 * S-Forge 的 Monaco 加载边界。
 *
 * 致谢：Microsoft Monaco Editor 0.48.0
 * https://github.com/microsoft/monaco-editor
 * 本模块只负责加载官方编辑器和 worker，不复制参考插件的文件桥接代码。
 */
import type * as Monaco from "monaco-editor";

type MonacoEnvironmentShape = {
    globalAPI?: boolean;
    getWorker?: (workerId: string, label: string) => Worker;
    [key: string]: unknown;
};

let workerConfigured = false;
let monacoPromise: Promise<typeof import("monaco-editor")> | undefined;

function configureMonacoWorker() {
    if (workerConfigured || typeof window === "undefined") {
        return;
    }
    const global = globalThis as typeof globalThis & {MonacoEnvironment?: MonacoEnvironmentShape};
    const previous = global.MonacoEnvironment;
    if (!previous?.getWorker) {
        global.MonacoEnvironment = {
            ...previous,
            getWorker: (_workerId, label) => new Worker(
                new URL("monaco-editor/esm/vs/editor/editor.worker.js", import.meta.url),
                {type: "module", name: `sforge-monaco-${label}`},
            ),
        };
    }
    workerConfigured = true;
}

/** 延迟加载编辑器，避免文件浏览 Dock 初始化时同步增加首屏开销。 */
export function loadFileBrowserMonaco(): Promise<typeof import("monaco-editor")> {
    configureMonacoWorker();
    monacoPromise ??= import("monaco-editor");
    return monacoPromise;
}

/** 供编辑器组件使用的 Monaco 类型别名，保持运行时依赖只在加载函数中出现。 */
export type FileBrowserMonaco = typeof Monaco;
