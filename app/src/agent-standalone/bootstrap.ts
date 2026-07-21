/** 用途：加载独立入口脚本。使用范围：Agent bootstrap 静态资源阶段。解耦评估：经同目录网关复用无状态资源能力。 */
import {loadStandaloneScript} from "./imports";
/** 用途：加载独立入口样式。使用范围：Agent bootstrap 主题阶段。解耦评估：经同目录网关复用无状态资源能力。 */
import {loadStandaloneStyle} from "./imports";
/** 用途：加载语言字典。使用范围：Agent bootstrap 国际化阶段。解耦评估：经同目录网关复用同源环境能力。 */
import {fetchStandaloneLanguage} from "./imports";
/** 用途：读取 Kernel 配置和存储。使用范围：Agent bootstrap 运行时阶段。解耦评估：经同目录网关复用同源环境能力。 */
import {postStandaloneKernel} from "./imports";
/** 用途：写入根元素主题属性。使用范围：Agent bootstrap 首帧阶段。解耦评估：经同目录网关复用纯主题能力。 */
import {applyStandaloneThemeAttributes} from "./imports";
/** 用途：解析当前主题选择。使用范围：Agent bootstrap 首帧阶段。解耦评估：经同目录网关复用纯主题能力。 */
import {resolveStandaloneTheme} from "./imports";
/** 用途：合并同一 Agent 入口的并发启动。使用范围：Agent bootstrap 公开函数。解耦评估：经同目录网关复用通用 Promise 生命周期能力。 */
import {bootstrapStandaloneOnce} from "./imports";

const BOOTSTRAP_KEY = "__sForgeAgentPanelBootstrapPromise";

/** 准备 Agent Panel 所需的最小运行时、主题、图标和内容渲染资源。 */
const prepareRuntime = async () => {
    const existingValue = Reflect.get(window, "siyuan");
    const existing = existingValue && typeof existingValue === "object" ? existingValue : {};
    const confData = await postStandaloneKernel<{conf: Config.IConf}>("/api/system/getConf");
    const config = confData.conf;
    const language = config.appearance?.lang || "en_US";
    const existingLanguages = Reflect.get(existing, "languages");
    const languages = existingLanguages && Object.keys(existingLanguages).length > 0
        ? existingLanguages
        : await fetchStandaloneLanguage(language);
    const existingStorage = Reflect.get(existing, "storage");
    const storage = existingStorage ?? await postStandaloneKernel<Record<string, unknown>>("/api/storage/getLocalStorage")
        .catch(() => ({}));
    const runtime = {
        ...existing,
        zIndex: typeof Reflect.get(existing, "zIndex") === "number" ? Reflect.get(existing, "zIndex") : 10,
        dialogs: Array.isArray(Reflect.get(existing, "dialogs")) ? Reflect.get(existing, "dialogs") : [],
        menus: Reflect.get(existing, "menus") || {},
        config,
        languages,
        storage,
        mobile: Reflect.get(existing, "mobile") || {},
    };
    // 外部脚本初始化时会读取语言和菜单运行时，必须先发布完整的最小对象。
    Reflect.set(window, "siyuan", runtime);
    const theme = resolveStandaloneTheme(config);
    applyStandaloneThemeAttributes(theme, language);
    await Promise.all([
        loadStandaloneStyle(`/appearance/themes/${theme.defaultTheme}/theme.css`, "agentThemeDefaultStyle")
            .catch(() => undefined),
        loadStandaloneScript("/appearance/icons/litheness/icon.js", "iconDefaultScript"),
        typeof Lute === "undefined"
            ? loadStandaloneScript("/stage/protyle/js/lute/lute.min.js", "protyleLuteScript")
            : Promise.resolve(),
    ]);
    await loadStandaloneScript("/stage/protyle/js/protyle-html.js", "protyleWcHtmlScript");

    return runtime;
};

/** 初始化并缓存独立 Agent 运行时，MAGI 和 agent-app 多次挂载时共享资源准备。 */
export const bootstrapAgentPanelRuntime = async () => {
    return await bootstrapStandaloneOnce(BOOTSTRAP_KEY, prepareRuntime);
};
