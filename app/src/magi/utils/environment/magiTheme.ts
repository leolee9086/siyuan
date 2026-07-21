/** 用途：读取共享主题属性映射。使用范围：MAGI 独立入口主题初始化。解耦评估：经环境网关复用纯主题能力。 */
import {applyStandaloneThemeAttributes} from "./imports";
/** 用途：读取共享主题选择。使用范围：MAGI 独立入口主题初始化。解耦评估：经环境网关复用纯主题能力。 */
import {resolveStandaloneTheme} from "./imports";

/**
 * 为 MAGI 独立入口加载与主窗口相同的主题资源。
 *
 * 主题 CSS 仍由后端的 appearance/themes 静态资源提供；这里仅负责把
 * 当前配置映射为一个 stylesheet，不引入主窗口的主题运行时或 DOM 模型。
 * @显式返回类型原因 异步资源加载函数对外固定为 Promise<void>，调用方依赖 await 完成主题 stylesheet 的加载或失败收敛。
 */
export async function loadMagiTheme(config: unknown): Promise<void> {
    const theme = resolveStandaloneTheme(config);
    applyStandaloneThemeAttributes(theme);
    const href = `/appearance/themes/${theme.selectedTheme}/theme.css?v=${encodeURIComponent(theme.themeVersion)}`;
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
