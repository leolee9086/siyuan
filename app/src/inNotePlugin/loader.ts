/**
 * 笔记内插件加载器
 * 使用 SecureModuleCreator 安全加载和执行插件代码
 */
/** 用途：插件基类类型。使用范围：loader 模块创建器。解耦评估：通过 imports.ts 转发。 */
import { Plugin } from "./imports";
/** 用途：应用实例类型。使用范围：loader 函数签名。解耦评估：通过 imports.ts 转发。 */
import type { AppFacade } from "./imports";
/** 用途：安全模块创建器。使用范围：loader 执行插件代码。解耦评估：通过 imports.ts 转发。 */
import { SecureModuleCreator } from "./imports";
/** 用途：思源 API URL 工具。使用范围：loader 插件运行时。解耦评估：同目录模块，直接同层导入。 */
import { getSiyuanApiUrl } from "./siyuanApi";
/** 用途：文档编译器。使用范围：loader 编译插件文档。解耦评估：同目录模块。 */
import { 编译文档 } from "./compiler";
/** 用途：笔记内插件配置类型。使用范围：loader 加载函数。解耦评估：同目录类型文件。 */
import type { 笔记内插件配置 } from "./types";
/** 用途：笔记内插件运行状态类型。使用范围：loader 函数签名。解耦评估：同目录类型文件。 */
import type { 笔记内插件运行状态 } from "./types";
/** 用途：权限管理器。使用范围：loader 检查加载权限。解耦评估：同目录模块。 */
import { persistentPermissionManager } from "./permissionManager";

/**
 * 创建笔记内插件专用的模块创建器
 * 配置白名单和CDN重定向
 */
function 创建插件模块创建器() {
    const siyuanApiUrl = getSiyuanApiUrl();

    // 获取已允许的包列表
    const allowedPackages = [
        "siyuan",  // 始终允许
        ...persistentPermissionManager.获取所有允许的包()
    ];

    return new SecureModuleCreator({
        allowedPackages,
        packagePatterns: [],
        autoAllowScoped: false,
        defaultOptions: {
            onUnauthorizedImport: "throw",
            customMocks: {}
        },
        moduleRedirectConfig: {
            // 外部包通过 esm.sh 加载
            defaultServer: "https://esm.sh",
            packageRedirects: {
                // siyuan 重定向到动态生成的 Blob URL
                "siyuan": siyuanApiUrl
            },
            enabled: true,
            bareModulesOnly: true
        }
    });
}

/**
 * 加载笔记内插件
 * @param app 应用实例
 * @param config 插件配置
 * @returns 插件运行状态
 */
export async function 加载笔记内插件(
    app: AppFacade,
    config: 笔记内插件配置
) {
    const state: 笔记内插件运行状态<Plugin> = {
        config,
        instance: null,
        status: "loading"
    };

    try {
        // 1. 编译文档
        const compileResult = await 编译文档(config.docId, config.displayName);

        if (compileResult.hasError) {
            throw new Error(compileResult.error || "编译失败");
        }

        // 2. 使用 SecureModuleCreator 创建安全模块
        const creator = 创建插件模块创建器();
        const tempModule = await creator.createSecureModule(compileResult.code);

        if (tempModule.hasError) {
            throw new Error(tempModule.error || "模块创建失败");
        }

        // 3. 获取插件类（ESM default export）
        const pluginClass = tempModule.moduleExport?.default;

        if (typeof pluginClass !== "function") {
            throw new Error("插件必须使用 export default 导出一个类");
        }

        if (!(pluginClass.prototype instanceof Plugin)) {
            throw new Error("插件类必须继承 Plugin");
        }

        // 4. 实例化插件
        const plugin: Plugin = new pluginClass({
            app,
            name: config.name,
            displayName: config.displayName,
            i18n: {}
        });

        // 5. 调用生命周期方法
        await plugin.onload();
        plugin.onLayoutReady();

        // 更新状态
        state.instance = plugin;
        state.status = "running";
        state.cleanup = tempModule.cleanup;
        config.lastLoadAt = Date.now();
        config.lastError = null;

        console.log(`笔记内插件 [${config.displayName}] 加载成功`);

    } catch (e) {
        state.status = "error";
        config.lastError = e instanceof Error ? e.message : String(e);
        console.error(`笔记内插件 [${config.displayName}] 加载失败:`, e);
    }

    return state;
}

/**
 * 卸载笔记内插件
 * @param state 插件运行状态
 * @同步豁免: 生命周期 — 在插件卸载流程中同步执行清理
 */
export function 卸载笔记内插件(state: 笔记内插件运行状态<Plugin>) {
    if (state.instance) {
        try {
            state.instance.onunload();
            console.log(`笔记内插件 [${state.config.displayName}] 已卸载`);
        } catch (e) {
            console.error(`笔记内插件 [${state.config.displayName}] 卸载失败:`, e);
        }
        state.instance = null;
    }

    // 清理临时模块
    if (state.cleanup) {
        state.cleanup();
        state.cleanup = undefined;
    }

    state.status = "idle";
}
