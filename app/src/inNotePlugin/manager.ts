/**
 * 笔记内插件管理器
 * 管理所有笔记内插件的生命周期
 */
import type { App } from "../index";
import { fetchSyncPost } from "../util/fetch";
import { 加载笔记内插件, 卸载笔记内插件 } from "./loader";
import type { 笔记内插件配置, 笔记内插件运行状态 } from "./types";

/** localStorage 存储键 */
const STORAGE_KEY = "in-note-plugins";

/**
 * 笔记内插件管理器
 * 单例模式，管理所有笔记内插件的生命周期
 */
class 笔记内插件管理器类 {
    /** 应用实例 */
    private app: App | null = null;

    /** 已加载的插件状态映射 */
    private plugins = new Map<string, 笔记内插件运行状态>();

    /** 是否已初始化 */
    private initialized = false;

    /**
     * 初始化管理器
     * @param app 应用实例
     */
    async init(app: App): Promise<void> {
        if (this.initialized) {
            console.warn("笔记内插件管理器已经初始化");
            return;
        }

        this.app = app;
        this.initialized = true;

        // 加载所有已启用的插件
        await this.加载已启用插件();

        console.log("笔记内插件管理器初始化完成");
    }

    /**
     * 获取已启用的插件ID列表
     */
    获取已启用插件ID列表(): string[] {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved) as string[];
            }
        } catch (e) {
            console.warn("读取插件列表失败:", e);
        }
        return [];
    }

    /**
     * 保存已启用的插件ID列表
     */
    private 保存已启用插件ID列表(ids: string[]): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
        } catch (e) {
            console.warn("保存插件列表失败:", e);
        }
    }

    /**
     * 加载所有已启用的插件
     */
    private async 加载已启用插件(): Promise<void> {
        const ids = this.获取已启用插件ID列表();

        for (const docId of ids) {
            try {
                const title = await this.获取文档标题(docId);
                if (title) {
                    await this.启用插件(docId, title);
                } else {
                    console.warn(`笔记内插件文档不存在: ${docId}`);
                    // 从列表中移除不存在的文档
                    this.从列表移除(docId);
                }
            } catch (e) {
                console.error(`加载笔记内插件 ${docId} 失败:`, e);
            }
        }
    }

    /**
     * 启用插件
     * @param docId 文档ID
     * @param displayName 显示名称
     */
    async 启用插件(docId: string, displayName: string): Promise<boolean> {
        if (!this.app) {
            console.error("管理器未初始化");
            return false;
        }

        // 检查是否已加载
        if (this.plugins.has(docId)) {
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
            lastError: null
        };

        // 加载插件
        const state = await 加载笔记内插件(this.app, config);
        this.plugins.set(docId, state);

        // 更新存储
        const ids = this.获取已启用插件ID列表();
        if (!ids.includes(docId)) {
            this.保存已启用插件ID列表([...ids, docId]);
        }

        return state.status === "running";
    }

    /**
     * 禁用插件
     * @param docId 文档ID
     */
    禁用插件(docId: string): void {
        const state = this.plugins.get(docId);
        if (!state) {
            return;
        }

        // 卸载插件
        卸载笔记内插件(state);
        this.plugins.delete(docId);

        // 更新存储
        this.从列表移除(docId);
    }

    /**
     * 从启用列表中移除
     */
    private 从列表移除(docId: string): void {
        const ids = this.获取已启用插件ID列表().filter(id => id !== docId);
        this.保存已启用插件ID列表(ids);
    }

    /**
     * 重载插件
     * @param docId 文档ID
     */
    async 重载插件(docId: string): Promise<boolean> {
        const state = this.plugins.get(docId);
        if (!state) {
            return false;
        }

        const displayName = state.config.displayName;

        // 先禁用
        this.禁用插件(docId);

        // 重新启用
        return this.启用插件(docId, displayName);
    }

    /**
     * 获取所有插件状态
     */
    获取所有插件(): 笔记内插件运行状态[] {
        return Array.from(this.plugins.values());
    }

    /**
     * 获取插件状态
     * @param docId 文档ID
     */
    获取插件状态(docId: string): 笔记内插件运行状态 | undefined {
        return this.plugins.get(docId);
    }

    /**
     * 检查插件是否已启用
     * @param docId 文档ID
     */
    是否已启用(docId: string): boolean {
        return this.plugins.has(docId);
    }

    /**
     * 获取文档标题
     * @param docId 文档ID
     */
    private async 获取文档标题(docId: string): Promise<string | null> {
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

    /**
     * 卸载所有插件（用于应用关闭时）
     */
    卸载所有插件(): void {
        for (const [docId, state] of this.plugins) {
            try {
                卸载笔记内插件(state);
            } catch (e) {
                console.error(`卸载插件 ${docId} 失败:`, e);
            }
        }
        this.plugins.clear();
    }
}

/** 全局笔记内插件管理器实例 */
export const inNotePluginManager = new 笔记内插件管理器类();
