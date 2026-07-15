/** 用途：转换入口边界的未知网络和 DOM 值；使用范围：bootstrap 加载流程；解耦评估：集中守卫可在 KernelPort 落地后直接替换。 */
import {asKernelResponse} from "./bootstrap.guard";
/** 用途：转换语言 JSON；使用范围：bootstrap 语言加载；解耦评估：后续由 I18nPort 替换。 */
import {asLanguageDictionary} from "./bootstrap.guard";
/** 用途：校验样式元素类型；使用范围：bootstrap 资源去重；解耦评估：资源加载器稳定后内聚到 AssetPort。 */
import {asLinkElement} from "./bootstrap.guard";
/** 用途：校验脚本元素类型；使用范围：bootstrap 资源去重；解耦评估：资源加载器稳定后内聚到 AssetPort。 */
import {asScriptElement} from "./bootstrap.guard";
/** 用途：识别共享启动 Promise；使用范围：多实例并发 bootstrap；解耦评估：运行时工厂落地后由实例缓存替换。 */
import {isStandaloneRuntimePromise} from "./bootstrap.guard";
/** 用途：约束配置响应和迁移期运行时；使用范围：bootstrap 内部；解耦评估：类型随运行时 Port 演进，不产生运行时依赖。 */
import type {IKernelConfigResponse} from "./standalone.types";
/** 用途：约束共享运行时结果；使用范围：bootstrap Promise；解耦评估：字段随各 Port 落地而缩减。 */
import type {IStandaloneSiyuanRuntime} from "./standalone.types";

const BOOTSTRAP_PROMISE_KEY = "__sForgeProtyleBootstrapPromise";

/** 向同源思源核心发送无参数请求，供入口启动阶段读取运行数据。 */
const postKernel = async <T>(path: string, body: IObject = {}) => {
    const response = await fetch(path, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });
    if (!response.ok) {
        throw new Error(`Kernel request failed: ${path} (${response.status})`);
    }
    const payload = asKernelResponse<T>(await response.json());
    if (payload.code !== 0) {
        throw new Error(payload.msg || `Kernel request failed: ${path}`);
    }
    return payload.data;
};

/** 选择默认日记所属的打开笔记本，优先遵循思源保存的日记笔记本偏好。 */
const selectDailyNoteNotebook = (notebooks: INotebook[], preferredNotebookId?: string) => {
    const openNotebooks = notebooks.filter(notebook => !notebook.closed);
    if (openNotebooks.length === 0) {
        throw new Error("No open notebook is available for the daily note");
    }
    return openNotebooks.find(notebook => notebook.id === preferredNotebookId) || openNotebooks[0];
};

/** 加载一次内核提供的脚本资源，并在重复调用时复用现有元素。 */
const loadScript = (src: string, id: string) => new Promise<void>((resolve, reject) => {
    const existing = asScriptElement(document.getElementById(id));
    // 已由本加载器成功加载的脚本可以立即复用，避免重复注册全局能力。
    if (existing?.dataset.loaded === "true") {
        resolve();
        return;
    }
    if (existing) {
        existing.addEventListener("load", () => resolve(), {once: true});
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {once: true});
        return;
    }
    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
    }, {once: true});
    script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), {once: true});
    document.head.appendChild(script);
});

/** 加载独立入口所需的默认主题样式。 */
const loadStyle = (href: string, id: string) => new Promise<void>((resolve, reject) => {
    const existing = asLinkElement(document.getElementById(id));
    if (existing) {
        resolve();
        return;
    }
    const style = document.createElement("link");
    style.id = id;
    style.rel = "stylesheet";
    style.href = href;
    style.addEventListener("load", () => resolve(), {once: true});
    style.addEventListener("error", () => reject(new Error(`Failed to load ${href}`)), {once: true});
    document.head.appendChild(style);
});

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

/** 按固定顺序获取配置并加载资源，确保创建 Protyle 前运行环境已经就绪。 */
const loadKernelRuntime = async () => {
    const confResponse = await postKernel<IKernelConfigResponse>("/api/system/getConf");
    const config = confResponse.conf;
    const language = config.appearance?.lang || "en_US";
    const [languagesResponse, emojis, storage] = await Promise.all([
        fetch(`/appearance/langs/${language}.json`).then(response => {
            if (!response.ok) {
                throw new Error(`Failed to load language: ${language}`);
            }
            return response.json().then(asLanguageDictionary);
        }),
        postKernel<IEmoji[]>("/api/system/getEmojiConf"),
        postKernel<IObject>("/api/storage/getLocalStorage"),
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

    const darkMode = config.appearance?.mode === 1;
    const defaultTheme = darkMode ? "midnight" : "daylight";
    document.documentElement.lang = language.replace("_", "-");
    document.documentElement.dataset.themeMode = darkMode ? "dark" : "light";
    document.documentElement.dataset.lightTheme = config.appearance?.themeLight || "daylight";
    document.documentElement.dataset.darkTheme = config.appearance?.themeDark || "midnight";

    await Promise.all([
        loadStyle(`/appearance/themes/${defaultTheme}/theme.css`, "themeDefaultStyle"),
        loadScript("/appearance/icons/litheness/icon.js", "iconDefaultScript"),
        loadScript("/stage/protyle/js/lute/lute.min.js", "protyleLuteScript"),
    ]);
    await loadScript("/stage/protyle/js/protyle-html.js", "protyleWcHtmlScript");
    return runtime;
};

/** 独立准备 Protyle 所需内核配置和静态资源，并在同一页面复用启动结果。 */
export const bootstrapStandaloneProtyle = async () => {
    const cached = Reflect.get(window, BOOTSTRAP_PROMISE_KEY);
    if (isStandaloneRuntimePromise(cached)) {
        return cached;
    }
    const bootstrapPromise = loadKernelRuntime();
    Reflect.set(window, BOOTSTRAP_PROMISE_KEY, bootstrapPromise);
    return bootstrapPromise;
};

/** 获取或创建当天日记，并返回可直接交给 Protyle 的文档块 ID。 */
export const getStandaloneDailyNoteId = async (runtime: IStandaloneSiyuanRuntime) => {
    const notebooksResponse = await postKernel<{notebooks: INotebook[]}>("/api/notebook/lsNotebooks", {
        flashcard: false,
    });
    const storedNotebookId = runtime.storage["local-dailynoteid"];
    const preferredNotebookId = typeof storedNotebookId === "string" ? storedNotebookId : undefined;
    const notebook = selectDailyNoteNotebook(notebooksResponse.notebooks, preferredNotebookId);
    const dailyNoteResponse = await postKernel<{id: string}>("/api/filetree/createDailyNote", {
        notebook: notebook.id,
        app: "protyle-standalone",
    });
    if (!dailyNoteResponse.id) {
        throw new Error("Kernel did not return a daily note block ID");
    }
    runtime.storage["local-dailynoteid"] = notebook.id;
    return dailyNoteResponse.id;
};
