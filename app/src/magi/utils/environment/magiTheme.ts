/**
 * 为 MAGI 独立入口加载与主窗口相同的主题资源。
 *
 * 主题 CSS 仍由后端的 appearance/themes 静态资源提供；这里仅负责把
 * 当前配置映射为一个 stylesheet，不引入主窗口的主题运行时或 DOM 模型。
 * @显式返回类型原因 异步资源加载函数对外固定为 Promise<void>，调用方依赖 await 完成主题 stylesheet 的加载或失败收敛。
 */
export async function loadMagiTheme(config: unknown): Promise<void> {
    const appearance = config && typeof config === "object" ? Reflect.get(config, "appearance") : undefined;
    const mode = appearance && typeof appearance === "object" ? Reflect.get(appearance, "mode") : 0;
    const modeOS = appearance && typeof appearance === "object" ? Reflect.get(appearance, "modeOS") === true : false;
    const prefersDark = typeof window !== "undefined" && typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = modeOS ? prefersDark : mode === 1;
    const themeNameValue = appearance && typeof appearance === "object"
        ? Reflect.get(appearance, isDark ? "themeDark" : "themeLight")
        : undefined;
    const themeName = typeof themeNameValue === "string" && /^[a-z0-9][a-z0-9-]*$/i.test(themeNameValue)
        ? themeNameValue
        : (isDark ? "midnight" : "daylight");
    const themeVersionValue = appearance && typeof appearance === "object" ? Reflect.get(appearance, "themeVer") : undefined;
    const themeVersion = typeof themeVersionValue === "string" && themeVersionValue.length > 0 ? themeVersionValue : "standalone";

    const root = document.documentElement;
    root.dataset.themeMode = isDark ? "dark" : "light";
    root.dataset.lightTheme = typeof (appearance && typeof appearance === "object" ? Reflect.get(appearance, "themeLight") : undefined) === "string"
        ? Reflect.get(appearance, "themeLight")
        : "daylight";
    root.dataset.darkTheme = typeof (appearance && typeof appearance === "object" ? Reflect.get(appearance, "themeDark") : undefined) === "string"
        ? Reflect.get(appearance, "themeDark")
        : "midnight";

    const href = `/appearance/themes/${themeName}/theme.css?v=${encodeURIComponent(themeVersion)}`;
    const existingElement = document.getElementById("magiThemeStyle");
    const existing = existingElement instanceof HTMLLinkElement ? existingElement : null;
    if (existing?.getAttribute("href") === href) {
        return;
    }

    const link = document.createElement("link");
    link.id = "magiThemeStyle";
    link.rel = "stylesheet";
    link.href = href;
    await new Promise<void>((resolve) => {
        link.addEventListener("load", () => resolve(), { once: true });
        link.addEventListener("error", () => {
            console.warn(`[magi-entry] theme stylesheet unavailable: ${href}`);
            resolve();
        }, { once: true });
        document.head.appendChild(link);
    });
    existing?.remove();
}
