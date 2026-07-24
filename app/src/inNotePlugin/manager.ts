/**
 * 笔记内插件管理器
 * 管理所有笔记内插件的生命周期
 */
/** 用途：应用实例类型。使用范围：manager 插件管理。解耦评估：通过 imports.ts 转发。 */
import type { App } from "./imports";
/** 用途：绑定笔记内插件状态的运行时实例类型；使用范围：manager 状态集合；解耦评估：具体 class 仅在管理实现中绑定，不进入状态契约。 */
import type {Plugin} from "./imports";
/** 用途：同步 POST 请求函数。使用范围：manager 获取文档数据。解耦评估：通过 imports.ts 转发。 */
import { fetchSyncPost } from "./imports";
/** 用途：插件加载/卸载函数。使用范围：manager 生命周期管理。解耦评估：同目录模块。 */
import { 加载笔记内插件 } from "./loader";
/** 用途：插件卸载函数。使用范围：manager 生命周期管理。解耦评估：同目录模块。 */
import { 卸载笔记内插件 } from "./loader";
/** 用途：插件配置类型。使用范围：manager 函数签名。解耦评估：同目录类型文件。 */
import type { 笔记内插件配置 } from "./types";
/** 用途：插件运行状态类型。使用范围：manager 状态管理。解耦评估：同目录类型文件。 */
import type { 笔记内插件运行状态 } from "./types";

/** localStorage 存储键 */
const STORAGE_KEY = "in-note-plugins";

// ============ 模块级状态（替代类字段） ============

let app: App | null = null;
let initialized = false;
const plugins = new Map<string, 笔记内插件运行状态<Plugin>>();

// ============ 内部辅助函数（替代私有方法） ============

/**
 * 获取已启用的插件ID列表
 */
function 获取已启用插件ID列表() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed: string[] = JSON.parse(saved);
            return parsed;
        }
    } catch (e) {
        console.warn("读取插件列表失败:", e);
    }
    return [];
}

/**
 * 保存已启用的插件ID列表
 */
function 保存已启用插件ID列表(ids: string[]) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (e) {
        console.warn("保存插件列表失败:", e);
    }
}

/**
 * 加载所有已启用的插件
 */
async function 加载已启用插件() {
    const ids = 获取已启用插件ID列表();

    for (const docId of ids) {
        try {
            const title = await 获取文档标题(docId);
            // 文档不存在时从启用列表中移除并跳过
            if (!title) {
                console.warn(`笔记内插件文档不存在: ${docId}`);
                从列表移除(docId);
                continue;
            }
            await 启用插件(docId, title);
        } catch (e) {
            console.error(`加载笔记内插件 ${docId} 失败:`, e);
        }
    }
}

/**
 * 从启用列表中移除
 */
function 从列表移除(docId: string) {
    const ids = 获取已启用插件ID列表().filter(id => id !== docId);
    保存已启用插件ID列表(ids);
}

/**
 * 获取文档标题
 */
async function 获取文档标题(docId: string) {
    try {
        const response = await fetchSyncPost("/api/block/getBlockInfo", { id: docId });
        if (response && response.code === 0 && response.data) {
            return response.data.rootTitle || response.data.name || docId;
        }
    } catch (e) {
        console.warn(`获取文档标题失败: ${docId}`, e);
    }
    return null;
}

// ============ 公开 API ============

/**
 * 初始化管理器
 */
export async function init(appInstance: App) {
    if (initialized) {
        console.warn("笔记内插件管理器已经初始化");
        return;
    }

    app = appInstance;
    initialized = true;

    // 加载所有已启用的插件
    await 加载已启用插件();

    console.log("笔记内插件管理器初始化完成");
}

/**
 * 启用插件
 */
export async function 启用插件(docId: string, displayName: string) {
    if (!app) {
        console.error("管理器未初始化");
        return false;
    }

    // 检查是否已加载
    if (plugins.has(docId)) {
        console.warn(`插件已加载: ${displayName}`);
        return true;
    }

    // 创建配置
    const config: 笔记内插件配置 = {
        docId,
        name: `in-note-${docId}`,
        displayName,
        enabled: true,
        lastLoadAt: 0,
        lastError: null,
    };

    // 加载插件
    const state = await 加载笔记内插件(app, config);
    plugins.set(docId, state);

    const ids = 获取已启用插件ID列表();
    // 仅新插件 ID 才写入存储，避免重复添加
    if (!ids.includes(docId)) {
        保存已启用插件ID列表([...ids, docId]);
    }

    return state.status === "running";
}

/**
 * 禁用插件
 */
export async function 禁用插件(docId: string) {
    const state = plugins.get(docId);
    if (!state) {
        return;
    }

    卸载笔记内插件(state);
    plugins.delete(docId);
    从列表移除(docId);
}

/**
 * 重载插件
 */
export async function 重载插件(docId: string) {
    const state = plugins.get(docId);
    if (!state) {
        return false;
    }

    const displayName = state.config.displayName;
    禁用插件(docId);
    return 启用插件(docId, displayName);
}

/**
 * 卸载所有插件（用于应用关闭时）
 */
export async function 卸载所有插件() {
    for (const [, state] of plugins) {
        try {
            卸载笔记内插件(state);
        } catch (e) {
            console.error("卸载插件失败:", e);
        }
    }
    plugins.clear();
}

/**
 * 笔记内插件管理器（兼容旧 API）
 * 提供与原来 `inNotePluginManager.method()` 一致的调用方式
 */
export const inNotePluginManager = {
    init,
    启用插件,
    禁用插件,
    重载插件,
    /** 获取所有插件状态 */
    获取所有插件() {
        return Array.from(plugins.values());
    },
    /** 获取插件状态 */
    获取插件状态(docId: string) {
        return plugins.get(docId);
    },
    /** 检查插件是否已启用 */
    是否已启用(docId: string) {
        return plugins.has(docId);
    },
    卸载所有插件,
};
