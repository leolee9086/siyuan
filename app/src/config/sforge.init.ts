/**
 * sforge.init.ts - S-Forge 初始化入口
 * 
 * 负责初始化所有 S-Forge 扩展功能。
 * 应在应用核心依赖加载完成后、UI 渲染前调用。
 * 
 * 初始化顺序：
 * 1. 注册表初始化（Tab、Trigger 等）
 * 2. 触发器注册（样式刷子等，仅桌面端）
 * 3. 其他 S-Forge 功能
 * 
 * @module config/sforge.init
 */

// ============ 初始化状态 ============

let 已初始化 = false;

// ============ 功能注册 ============

/**
 * 注册桌面端专有触发器
 * 
 * 作用：将桌面端专用的触发器注册到 TriggerRegistry
 * 意图：刷子模式需要精确的光标跟随，不适合移动端触摸交互
 * 调用时机：桌面端 S-Forge 初始化时
 */
async function 注册桌面端触发器(): Promise<void> {
    console.log("[S-Forge] 开始注册桌面端触发器...");

    // 动态导入，避免移动端加载不必要的代码
    const { 注册样式刷子 } = await import("../protyle/gutter/styleBrush");

    // 样式刷子（格式刷）
    注册样式刷子();

    // 未来可以在这里添加更多桌面端触发器：
    // 注册颜色刷子();
    // 注册属性刷子();

    console.log("[S-Forge] 桌面端触发器注册完成");
}

/**
 * 注册通用功能
 * 
 * 作用：注册桌面端和移动端共用的功能
 * 调用时机：所有平台 S-Forge 初始化时
 */
function 注册通用功能(): void {
    // 目前没有通用触发器，预留扩展点
    // 未来可以添加如：智能提示、AI 辅助等
}

// ============ 主初始化函数 ============

/**
 * S-Forge 初始化选项
 */
interface ISForgeInitOptions {
    /** 是否为移动端平台 */
    isMobile?: boolean;
}

/**
 * 初始化 S-Forge
 * 
 * 作用：启动所有 S-Forge 扩展功能
 * 意图：提供统一的初始化入口，确保功能正确加载
 * 调用时机：应用启动时，在核心依赖加载后调用
 * 
 * 该函数是幂等的，多次调用只会执行一次初始化
 * 
 * @param options 初始化选项
 */
export async function initSForge(options?: ISForgeInitOptions): Promise<void> {
    if (已初始化) {
        console.debug("[S-Forge] 已经初始化过，跳过");
        return;
    }

    const isMobile = options?.isMobile ?? false;
    console.log(`[S-Forge] 开始初始化... (平台: ${isMobile ? "移动端" : "桌面端"})`);
    const startTime = Date.now();

    try {
        // 1. 注册通用功能
        注册通用功能();

        // 2. 仅桌面端注册刷子等功能
        if (!isMobile) {
            await 注册桌面端触发器();
        }

        // 3. 未来可以添加其他初始化逻辑
        // initSmartToolbox();
        // initAssetManager();

        已初始化 = true;
        console.log(`[S-Forge] 初始化完成，耗时 ${Date.now() - startTime}ms`);

    } catch (error) {
        console.error("[S-Forge] 初始化失败:", error);
        throw error;
    }
}

/**
 * 检查 S-Forge 是否已初始化
 */
export function isSForgeInitialized(): boolean {
    return 已初始化;
}

// 中文别名
export const 初始化SForge = initSForge;
export const SForge是否已初始化 = isSForgeInitialized;
