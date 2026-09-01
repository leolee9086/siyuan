/** AI 编辑器生命周期能力的契约。 */
import type {TAIEditorDestroy} from "./editorLifecycle.types";

/** AI 编辑器生命周期能力的 Symbol 注册键，跨 HMR 保持同一槽位。 */
const aiEditorDestroyKey = Symbol.for("sforge.ai.editor.destroy");

/** 未装配 AI 编辑器时的明确回退行为。 */
const ignoreAIEditorDestroy: TAIEditorDestroy = (_protyle: IProtyle) => undefined;

/** 检查未知注册值是否符合 AI 编辑器销毁契约。 */
const isAIEditorDestroy = (value: unknown): value is TAIEditorDestroy => {
    return typeof value === "function";
};

/** 读取当前页面注册的 AI 编辑器销毁能力。 */
export const getAIEditorDestroy = () => {
    const registered = Reflect.get(globalThis, aiEditorDestroyKey);
    if (isAIEditorDestroy(registered)) {
        return registered;
    }
    return ignoreAIEditorDestroy;
};

/** 注册完整 AI 编辑器实现提供的销毁能力。 */
export const setAIEditorDestroy = (destroy: TAIEditorDestroy) => {
    if (!Reflect.set(globalThis, aiEditorDestroyKey, destroy)) {
        throw new Error("Unable to register AI editor lifecycle capability");
    }
};
