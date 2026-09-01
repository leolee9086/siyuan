/** 用途：加载独立脚本。使用范围：Protyle bootstrap 静态资源阶段。解耦评估：经入口网关复用无状态资源能力。 */
import {loadStandaloneScript} from "./bootstrap.imports";
/** 用途：加载独立样式。使用范围：Protyle bootstrap 主题阶段。解耦评估：经入口网关复用无状态资源能力。 */
import {loadStandaloneStyle} from "./bootstrap.imports";
/** 用途：加载语言字典。使用范围：Protyle bootstrap 国际化阶段。解耦评估：经入口网关复用同源环境能力。 */
import {fetchStandaloneLanguage} from "./bootstrap.imports";
/** 用途：读取 Kernel 数据。使用范围：Protyle bootstrap 与日记创建。解耦评估：经入口网关复用同源环境能力。 */
import {postStandaloneKernel} from "./bootstrap.imports";
/** 用途：写入根元素主题属性。使用范围：Protyle bootstrap 首帧阶段。解耦评估：经入口网关复用纯主题能力。 */
import {applyStandaloneThemeAttributes} from "./bootstrap.imports";
/** 用途：解析当前主题选择。使用范围：Protyle bootstrap 首帧阶段。解耦评估：经入口网关复用纯主题能力。 */
import {resolveStandaloneTheme} from "./bootstrap.imports";
/** 用途：合并同一 Protyle 入口的并发启动。使用范围：Protyle bootstrap 公开函数。解耦评估：经入口网关复用通用 Promise 生命周期能力。 */
import {bootstrapStandaloneOnce} from "./bootstrap.imports";
/** 用途：约束配置响应和迁移期运行时；使用范围：bootstrap 内部；解耦评估：类型随运行时 Port 演进，不产生运行时依赖。 */
import type {IKernelConfigResponse} from "./standalone.types";
/** 用途：约束共享运行时结果；使用范围：bootstrap Promise；解耦评估：字段随各 Port 落地而缩减。 */
import type {IStandaloneSiyuanRuntime} from "./standalone.types";

const BOOTSTRAP_PROMISE_KEY = "__sForgeProtyleBootstrapPromise";

/** 选择默认日记所属的打开笔记本，优先遵循思源保存的日记笔记本偏好。 */
const selectDailyNoteNotebook = (notebooks: INotebook[], preferredNotebookId?: string) => {
    const openNotebooks = notebooks.filter(notebook => !notebook.closed);
    if (openNotebooks.length === 0) {
        throw new Error("No open notebook is available for the daily note");
    }
    return openNotebooks.find(notebook => notebook.id === preferredNotebookId) || openNotebooks[0];
};

/** 为全新工作空间补齐基础编辑路径会访问的存储默认值。 */
const normalizeStorage = (storage: IObject | undefined) => ({
    "local-fileposition": {},
    "local-codelang": "",
    "local-fontstyles": [],
    "local-images": {
        file: "1f4c4",
        folder: "1f4c1",
    },
    ...storage,
});

/** 根据独立入口配置加载默认主题和当前选中的主题覆盖层。 */
const loadStandaloneTheme = async (config: Config.IConf, language: string) => {
    const theme = resolveStandaloneTheme(config);
    applyStandaloneThemeAttributes(theme, language);

    await loadStandaloneStyle(`/appearance/themes/${theme.defaultTheme}/theme.css`, "themeDefaultStyle");
    // 仅在用户选择了非默认主题时加载覆盖层，资源缺失仍保留默认主题以避免独立入口白屏。
    if (theme.selectedTheme !== theme.defaultTheme) {
        await loadStandaloneStyle(`/appearance/themes/${theme.selectedTheme}/theme.css?v=${theme.themeVersion}`, "themeStyle")
            .catch(() => undefined);
    }
};

/** 按固定顺序获取配置并加载资源，确保创建 Protyle 前运行环境已经就绪。 */
const loadKernelRuntime = async () => {
    const confResponse = await postStandaloneKernel<IKernelConfigResponse>("/api/system/getConf");
    const config = confResponse.conf;
    const language = config.appearance?.lang || "en_US";
    const [languagesResponse, emojis, storage] = await Promise.all([
        fetchStandaloneLanguage(language),
        postStandaloneKernel<IEmoji[]>("/api/system/getEmojiConf"),
        postStandaloneKernel<IObject>("/api/storage/getLocalStorage"),
    ]);

    const runtime: IStandaloneSiyuanRuntime = {
        zIndex: 10,
        transactions: [],
        reqIds: {},
        backStack: [],
        layout: {},
        dialogs: [],
        blockPanels: [],
        closedTabs: [],
        ctrlIsPressed: false,
        altIsPressed: false,
        shiftIsPressed: false,
        config,
        languages: languagesResponse,
        emojis,
        storage: normalizeStorage(storage),
        isPublish: confResponse.isPublish === true,
        standaloneProtyle: true,
    };
    Reflect.set(window, "siyuan", runtime);

    // 主应用通过运行时 inline style 注入编辑器字号；独立入口没有该启动链路，
    // 这里直接建立 Protyle 基础 CSS 所需的同名变量，避免块标 SVG 回退为异常尺寸。
    const editorFontSize = config.editor?.fontSize || 16;
    document.documentElement.style.setProperty("--b3-font-size-editor", `${editorFontSize}px`);

    await Promise.all([
        loadStandaloneTheme(config, language),
        loadStandaloneScript("/appearance/icons/litheness/icon.js", "iconDefaultScript"),
        loadStandaloneScript("/stage/protyle/js/lute/lute.min.js", "protyleLuteScript"),
    ]);
    await loadStandaloneScript("/stage/protyle/js/protyle-html.js", "protyleWcHtmlScript");
    return runtime;
};

/** 独立准备 Protyle 所需内核配置和静态资源，并在同一页面复用启动结果。 */
export const bootstrapStandaloneProtyle = async () => {
    return await bootstrapStandaloneOnce(BOOTSTRAP_PROMISE_KEY, loadKernelRuntime);
};

/** 获取或创建当天日记，并返回可直接交给 Protyle 的文档块 ID。 */
export const getStandaloneDailyNoteId = async (runtime: IStandaloneSiyuanRuntime) => {
    const notebooksResponse = await postStandaloneKernel<{notebooks: INotebook[]}>("/api/notebook/lsNotebooks", {
        flashcard: false,
    });
    const storedNotebookId = runtime.storage["local-dailynoteid"];
    const preferredNotebookId = typeof storedNotebookId === "string" ? storedNotebookId : undefined;
    const notebook = selectDailyNoteNotebook(notebooksResponse.notebooks, preferredNotebookId);
    const dailyNoteResponse = await postStandaloneKernel<{id: string}>("/api/filetree/createDailyNote", {
        notebook: notebook.id,
        app: "protyle-standalone",
    });
    if (!dailyNoteResponse.id) {
        throw new Error("Kernel did not return a daily note block ID");
    }
    runtime.storage["local-dailynoteid"] = notebook.id;
    return dailyNoteResponse.id;
};
