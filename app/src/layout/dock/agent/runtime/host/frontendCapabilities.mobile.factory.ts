/** 用途：读取移动 capability factory 的组合依赖。使用范围：移动 native handler 执行设置、聚焦、文档和搜索动作。解耦评估：factory 不直接加载移动应用根，由移动 App 根传入具体 owner。 */
import type {TMobileNativeCapabilityEffects} from "./frontendCapabilities.native.types";
/** 用途：读取 capability handler 的应用契约。使用范围：向所有移动 owner 转发当前 App。解耦评估：纯类型不加载应用根。 */
import type {TNativeCapabilityApp} from "./frontendCapabilities.native.types";

/** 移动 Agent capability handler 的 HMR 稳定全局键。 */
const mobileNativeCapabilityHandlerKey = Symbol.for("sforge.agent.frontendCapabilities.mobileHandler");

/**
 * 作用：从协议参数读取字符串字段。
 * 意图：在 capability factory 边界验证不可信输入，避免运行时类型断言。
 * 调用时机：移动 native capability 执行 `id` 或 `query` 前。
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
 * 调用时机：移动 open_document 的失败分支。
 * @同步豁免: 错误转换不应等待额外任务。
 */
const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

/**
 * 作用：隐藏移动 Agent 后打开设置菜单。
 * 意图：保留返回后重新展示 Agent 的原有生命周期。
 * 调用时机：Agent 调用 `native/frontend/open_setting` 时。
 */
const openMobileSettings = (effects: TMobileNativeCapabilityEffects, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const query = getStringArgument(args, "query")?.trim();
    effects.hideMobileAgent();
    effects.openMobileSetting(app, undefined, effects.reopenMobileAgent);
    if (query) {
        return {result: `Opened mobile settings for "${query}".`};
    }
    return {result: "Opened mobile settings."};
};

/**
 * 作用：在当前移动编辑器中定位并高亮块。
 * 意图：保持原能力只聚焦当前已加载的编辑器 DOM。
 * 调用时机：Agent 调用 `native/frontend/focus_block` 时。
 */
const focusMobileBlock = (effects: TMobileNativeCapabilityEffects, args: Record<string, unknown>) => {
    const id = getStringArgument(args, "id");
    if (!id) {
        return {error: "missing required argument: id"};
    }
    const editor = effects.getCurrentEditor();
    const blockElement = editor?.protyle.wysiwyg.element.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
    if (!blockElement) {
        return {error: `Block ${id} is not loaded in the current editor. Use open_document to open it first.`};
    }
    effects.hideMobileAgent();
    blockElement.scrollIntoView({behavior: "smooth", block: "center"});
    blockElement.classList.add("protyle-wysiwyg--hl");
    // 高亮是面向用户的固定两秒提示，不存在能表达“提示期结束”的 DOM 事件，因此保留明确的感知时长。
    setTimeout(() => blockElement.classList.remove("protyle-wysiwyg--hl"), 2000);
    return {result: `Focused block ${id} in the active editor.`};
};

/**
 * 作用：按块 ID 在移动应用中打开文档。
 * 意图：保留切换页面前隐藏 Agent 和获取焦点 action 的行为。
 * 调用时机：Agent 调用 `native/frontend/open_document` 时。
 */
const openMobileDocument = async (effects: TMobileNativeCapabilityEffects, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const id = getStringArgument(args, "id");
    if (!id) {
        return {error: "missing required argument: id"};
    }
    try {
        effects.hideMobileAgent();
        effects.openMobileFileById(app, id, [effects.constants.CB_GET_FOCUS]);
        return {result: `Opened document ${id}.`};
    } catch (error) {
        return {error: `Failed to open document ${id}: ${getErrorMessage(error)}`};
    }
};

/**
 * 作用：隐藏移动 Agent 后打开搜索，并可选预填查询词。
 * 意图：保留移动搜索的既有工具栏输入事件。
 * 调用时机：Agent 调用 `native/frontend/open_search` 时。
 */
const openMobileSearch = (effects: TMobileNativeCapabilityEffects, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const query = getStringArgument(args, "query")?.trim();
    effects.hideMobileAgent();
    effects.popSearch(app);
    const inputCandidate = query ? document.getElementById("toolbarSearch") : null;
    // 搜索壳可能尚未完成挂载，只有真实输入元素可接收值和标准 InputEvent。
    if (inputCandidate instanceof HTMLInputElement && query) {
        inputCandidate.value = query;
        inputCandidate.dispatchEvent(new InputEvent("input", {bubbles: true}));
    }
    if (query) {
        return {result: `Opened mobile search with query "${query}".`};
    }
    return {result: "Opened mobile search."};
};

/**
 * 作用：执行一个移动 native capability。
 * 意图：将 Agent registry 与移动 UI owner 保持单向隔离。
 * 调用时机：frontendCapabilities 的已注册 handler 通过全局槽调度时。
 * @参数豁免: 第三方接口适配
 * 全局 handler 契约固定为 effects、capabilityID、args、app 四项，拆分会隐藏跨层依赖。
 */
const executeMobileNativeCapability = async (effects: TMobileNativeCapabilityEffects, capabilityID: string, args: Record<string, unknown>, app: TNativeCapabilityApp) => {
    const action = Reflect.get({
        "native/frontend/open_setting": openMobileSettings,
        "native/frontend/focus_block": focusMobileBlock,
        "native/frontend/open_document": openMobileDocument,
        "native/frontend/open_search": openMobileSearch,
    }, capabilityID);
    if (typeof action !== "function") {
        return {error: `Unsupported mobile capability: ${capabilityID}`};
    }
    return action(effects, args, app);
};

/**
 * 作用：向全局槽注册移动 native capability handler。
 * 意图：由移动 App 组合根拥有 UI 依赖，Agent registry 只读取平台 handler。
 * 调用时机：移动 App 模块初始化。
 * @同步豁免: 生命周期
 * capability 在用户触发前必须同步固定到 HMR 稳定槽。
 */
export const registerMobileNativeCapabilityEffects = (effects: TMobileNativeCapabilityEffects) => {
    const handler = executeMobileNativeCapability.bind(undefined, effects);
    const didRegister = Reflect.set(globalThis, mobileNativeCapabilityHandlerKey, handler);
    if (!didRegister) {
        throw new Error("Unable to register mobile native capability effects");
    }
};
