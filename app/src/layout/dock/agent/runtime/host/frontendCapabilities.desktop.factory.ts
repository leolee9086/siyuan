/** 用途：读取桌面 capability factory 的组合依赖。使用范围：桌面 native handler 执行设置、聚焦、文档和搜索动作。解耦评估：factory 不直接加载应用根，由 App 根传入具体 owner。 */
import type {TDesktopNativeCapabilityEffects} from "./frontendCapabilities.native.types";
/** 用途：读取 capability handler 的应用契约。使用范围：向所有桌面 owner 转发当前 App。解耦评估：纯类型不加载应用根。 */
import type {TNativeCapabilityApp} from "./frontendCapabilities.native.types";

/** 桌面 Agent capability handler 的 HMR 稳定全局键。 */
const desktopNativeCapabilityHandlerKey = Symbol.for("sforge.agent.frontendCapabilities.desktopHandler");

/**
 * 作用：从协议参数读取字符串字段。
 * 意图：在 capability factory 边界验证不可信输入，避免运行时类型断言。
 * 调用时机：桌面 native capability 执行 `id` 或 `query` 前。
 * @同步豁免: 参数检查必须在当前 capability 调用栈内完成。
 */
const getStringArgument = (args: Record<string, unknown>, key: string) => {
    const value = args[key];
    if (typeof value !== "string") {
        return;
    }
    return value;
};

/**
 * 作用：将未知异常转换为可返回给 Agent 的文本。
 * 意图：保留 Error 详情并安全处理非 Error 抛出值。
 * 调用时机：桌面 open_document 的失败分支。
 * @同步豁免: 错误转换不应等待额外任务。
 */
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * 作用：打开桌面设置面板并可选填充查询词。
 * 意图：复用既有 Dialog，避免 openSetting 先销毁正在使用的对话框。
 * 调用时机：Agent 调用 `native/frontend/open_setting` 时。
 */
const openDesktopSettings = (effects: TDesktopNativeCapabilityEffects, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const query = getStringArgument(args, "query")?.trim();
    const existingDialog = window.siyuan.dialogs.find(dialog => dialog.element.querySelector(".config__tab-container"));
    let dialog = existingDialog;
    if (!dialog) {
        dialog = effects.openSetting(app);
    }
    if (!dialog) {
        return {error: "Unable to open the settings panel."};
    }
    const inputCandidate = query ? dialog.element.querySelector(".config__side .b3-text-field") : null;
    // 对话框结构可能由插件或旧版设置页替换，只有真实输入框才能安全注入查询并触发原有过滤事件。
    if (inputCandidate instanceof HTMLInputElement && query) {
        inputCandidate.value = query;
        inputCandidate.dispatchEvent(new Event("input", {bubbles: true}));
    }
    if (query) {
        return {result: `Opened the settings panel and filtered by "${query}".`};
    }
    return {result: "Opened the settings panel."};
};

/**
 * 作用：在已打开的桌面编辑器中定位并高亮块。
 * 意图：保持原能力只聚焦已加载 DOM，避免隐式打开文档。
 * 调用时机：Agent 调用 `native/frontend/focus_block` 时。
 */
const focusDesktopBlock = (effects: TDesktopNativeCapabilityEffects, args: Record<string, unknown>) => {
    const id = getStringArgument(args, "id");
    if (!id) {
        return {error: "missing required argument: id"};
    }
    let blockElement: HTMLElement | null = null;
    for (const editor of effects.getAllEditor()) {
        const candidate = editor.protyle.wysiwyg.element.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
        if (candidate) {
            blockElement = candidate;
            break;
        }
    }
    if (!blockElement) {
        return {error: `Block ${id} is not loaded in any open editor. Use open_document to open it first.`};
    }
    blockElement.scrollIntoView({behavior: "smooth", block: "center"});
    blockElement.classList.add("protyle-wysiwyg--hl");
    // 高亮是面向用户的固定两秒提示，不存在能表达“提示期结束”的 DOM 事件，因此保留明确的感知时长。
    setTimeout(() => blockElement?.classList.remove("protyle-wysiwyg--hl"), 2000);
    return {result: `Focused block ${id} in the active editor.`};
};

/**
 * 作用：按块 ID 在桌面应用中打开文档。
 * 意图：保留既有 focus action 和错误反馈。
 * 调用时机：Agent 调用 `native/frontend/open_document` 时。
 */
const openDesktopDocument = async (effects: TDesktopNativeCapabilityEffects, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const id = getStringArgument(args, "id");
    if (!id) {
        return {error: "missing required argument: id"};
    }
    try {
        await effects.openFileById({app, id, action: [effects.constants.CB_GET_FOCUS]});
        return {result: `Opened document ${id}.`};
    } catch (error) {
        return {error: `Failed to open document ${id}: ${getErrorMessage(error)}`};
    }
};

/**
 * 作用：打开桌面搜索并可选预填查询词。
 * 意图：复用搜索 owner 的全局快捷键与 Dialog 行为。
 * 调用时机：Agent 调用 `native/frontend/open_search` 时。
 */
const openDesktopSearch = async (effects: TDesktopNativeCapabilityEffects, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const query = getStringArgument(args, "query")?.trim();
    await effects.openSearch({
        app,
        hotkey: effects.constants.DIALOG_GLOBALSEARCH,
        ...(query ? {key: query} : {}),
    });
    if (query) {
        return {result: `Opened search dialog with query "${query}".`};
    }
    return {result: "Opened search dialog."};
};

/**
 * 作用：执行一个桌面 native capability。
 * 意图：将 Agent registry 与桌面 UI owner 保持单向隔离。
 * 调用时机：frontendCapabilities 的已注册 handler 通过全局槽调度时。
 * @参数豁免: 第三方接口适配
 * 全局 handler 契约固定为 effects、capabilityID、args、app 四项，拆分会隐藏跨层依赖。
 */
const executeDesktopNativeCapability = async (effects: TDesktopNativeCapabilityEffects, capabilityID: string, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const action = Reflect.get({
        "native/frontend/open_setting": openDesktopSettings,
        "native/frontend/focus_block": focusDesktopBlock,
        "native/frontend/open_document": openDesktopDocument,
        "native/frontend/open_search": openDesktopSearch,
    }, capabilityID);
    if (typeof action !== "function") {
        return {error: `Unsupported desktop capability: ${capabilityID}`};
    }
    return action(effects, args, app);
};

/**
 * 作用：向全局槽注册桌面 native capability handler。
 * 意图：由 App 组合根拥有 UI 依赖，Agent registry 只读取平台 handler。
 * 调用时机：桌面 App 模块初始化。
 * @同步豁免: 生命周期
 * capability 在用户触发前必须同步固定到 HMR 稳定槽。
 */
export const registerDesktopNativeCapabilityEffects = (effects: TDesktopNativeCapabilityEffects) => {
    const handler = executeDesktopNativeCapability.bind(undefined, effects);
    const didRegister = Reflect.set(globalThis, desktopNativeCapabilityHandlerKey, handler);
    if (!didRegister) {
        throw new Error("Unable to register desktop native capability effects");
    }
};
