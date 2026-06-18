/** 用途：forgeI18n 国际化加载函数。使用范围：MAGI 独立入口的 i18n 初始化。解耦评估：环境工具函数，通过 imports.ts 转发可降低路径耦合。 */
import { loadForgeI18n } from "../../../util/siyuanEnvironments/forgeI18n.getI18n.environment";
/** 用途：MagiBuildTarget 构建目标类型。使用范围：MAGI 入口配置参数类型。解耦评估：类型导入，不涉及运行时耦合。 */
import type { MagiBuildTarget } from "./magiEntry.types";

/**
 * 读取浏览器默认语言并映射为项目语言编码
 *
 * 作用：为未初始化的 `window.siyuan.config.appearance.lang` 提供默认值。
 * 意图：保证 MAGI 独立入口在无宿主上下文时也能正确加载 i18n。
 * 调用时机：`bootstrapMagiSiyuan` 初始化运行时对象时调用。
 */
function resolveDefaultLang() {
    const languageTag = (navigator.language || "zh-CN").replace("-", "_");
    if (languageTag.startsWith("zh")) {
        return "zh_CN";
    }
    if (languageTag.startsWith("ja")) {
        return "ja_JP";
    }
    return "en_US";
}

/**
 * 读取运行时 `window.siyuan`
 *
 * 作用：通过反射方式获取全局对象，避免业务入口直接 `window` 访问耦合。
 * 意图：满足项目对全局访问封装约束，并在缺省时返回空对象。
 * 调用时机：`bootstrapMagiSiyuan` 每次初始化时调用。
 */
function getSiyuanRuntime() {
    const value = Reflect.get(window, "siyuan")||{};
    // 运行时对象不存在或不是对象时，发出警告但不阻止后续流程
    if (!value || typeof value !== "object") {
        console.warn("[magi-entry] window.siyuan is not defined or not an object");
    }
    return value ;
}

/**
 * 从后端获取运行时配置
 *
 * 作用：调用 `/api/system/getConf` 获取真实配置对象。
 * 意图：避免 MAGI 独立入口仅依赖本地占位配置导致 AI 连接失败。
 * 调用时机：`bootstrapMagiSiyuan` 初始化 `window.siyuan.config` 前调用。
 */
async function fetchBackendConf(){
    try {
        const response = await fetch("/api/system/getConf", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
        });
        if (!response.ok) {
            return null;
        }
        const payload: unknown = await response.json();
        if (!payload || typeof payload !== "object") {
            return null;
        }
        const data = Reflect.get(payload, "data");
        if (!data || typeof data !== "object") {
            return null;
        }
        const conf = Reflect.get(data, "conf");
        if (!conf || typeof conf !== "object") {
            return null;
        }
        return conf;
    } catch {
        return null;
    }
}

/**
 * 初始化 MAGI 独立入口的 `window.siyuan`
 *
 * 作用：补齐 config/languages/magi 关键字段并触发 Forge i18n 加载。
 * 意图：让 MAGI 在独立构建产物下保持可运行，不依赖主笔记页面上下文。
 * 调用时机：`index.ts` 与 `mobile.ts` 启动时调用一次。
 */
export async function bootstrapMagiSiyuan(target: MagiBuildTarget) {
    const existing = getSiyuanRuntime();
    const backendConfig = await fetchBackendConf();
    const fallbackConfig = existing.config ?? { appearance: { lang: resolveDefaultLang() } };
    const config = backendConfig ?? fallbackConfig;

    Reflect.set(window, "siyuan", {
        ...existing,
        config,
        languages: existing.languages ?? {},
        magi: {
            standalone: true,
            target,
            isMobile: target === "magi-mobile",
        },
    });

    try {
        await loadForgeI18n();
    } catch (error) {
        console.warn("[magi-entry] loadForgeI18n failed:", error);
    }
}

/**
 * 根据当前 URL 路径识别桌面入口目标
 *
 * 作用：区分 `magi-app` 与 `magi-desktop` 共用入口文件时的目标类型。
 * 意图：确保 Electron/Web 构建在运行时都写入正确 target 标记。
 * 调用时机：`index.ts` 启动阶段调用一次。
 */
export async function resolveMagiDesktopTargetFromPathname(pathname: string) {
    if (pathname.startsWith("/stage/build/magi-app/")) {
        return "magi-app";
    }
    return "magi-desktop";
}
