/** 用途：约束主题属性映射输入。使用范围：独立入口主题初始化。解耦评估：纯数据类型，不引入宿主实现。 */
import type {IStandaloneThemeSelection} from "./theme.types";

/** 从未知配置中读取对象属性。 */
const readRecord = (value: unknown, key: string) => {
    if (!value || typeof value !== "object") {
        return undefined;
    }
    const candidate = Reflect.get(value, key);
    return candidate && typeof candidate === "object" ? candidate : undefined;
};

/** 读取符合静态资源路径约束的主题名称。 */
const readThemeName = (appearance: object | undefined, key: string, fallback: string) => {
    const value = appearance ? Reflect.get(appearance, key) : undefined;
    return typeof value === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(value) ? value : fallback;
};

/** @同步豁免: UI构建 - 启动流程必须在请求资源前同步得到确定的主题 URL，函数只读取配置与媒体查询且不持有状态。 */
export const resolveStandaloneTheme = (config: unknown) => {
    const appearance = readRecord(config, "appearance");
    const prefersDark = typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = (appearance ? Reflect.get(appearance, "modeOS") : undefined) === true
        ? prefersDark
        : (appearance ? Reflect.get(appearance, "mode") : undefined) === 1;
    const defaultTheme: "midnight" | "daylight" = dark ? "midnight" : "daylight";
    const lightTheme = readThemeName(appearance, "themeLight", "daylight");
    const darkTheme = readThemeName(appearance, "themeDark", "midnight");
    const version = appearance ? Reflect.get(appearance, "themeVer") : undefined;
    return {
        dark,
        defaultTheme,
        selectedTheme: dark ? darkTheme : lightTheme,
        themeVersion: typeof version === "string" && version.length > 0 ? version : "standalone",
        lightTheme,
        darkTheme,
    };
};

/** @同步豁免: UI构建 - 资源加载前必须同步设置根元素主题属性，避免首帧使用错误配色。 */
export const applyStandaloneThemeAttributes = (selection: IStandaloneThemeSelection, language?: string) => {
    if (language) {
        document.documentElement.lang = language.replace("_", "-");
    }
    document.documentElement.dataset.themeMode = selection.dark ? "dark" : "light";
    document.documentElement.dataset.lightTheme = selection.lightTheme;
    document.documentElement.dataset.darkTheme = selection.darkTheme;
};
