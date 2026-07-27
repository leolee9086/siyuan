/** 用途：完整应用外观；使用范围：管理器初始化后加载插件；解耦评估：经本领域网关直达抽象声明。 */
import type {AppFacade} from "./imports";
/** 用途：官方插件类型；使用范围：唯一运行状态 Map；解耦评估：经本领域网关复用上游基线。 */
import type {Plugin} from "./imports";
/** 用途：读取文档标题；使用范围：恢复已启用插件；解耦评估：经本领域网关直达网络实现。 */
import {fetchSyncPost} from "./imports";
/** 用途：加载插件；使用范围：启用流程；解耦评估：经本领域网关直达唯一实现。 */
import {加载笔记内插件} from "./imports";
/** 用途：卸载插件；使用范围：禁用与销毁流程；解耦评估：经本领域网关直达唯一实现。 */
import {卸载笔记内插件} from "./imports";
/** 用途：标记插件文档；使用范围：完整管理器菜单命令；解耦评估：经本领域网关直达唯一实现。 */
import {设置为插件文档} from "./imports";
/** 用途：插件配置；使用范围：启用流程；解耦评估：同领域数据类型。 */
import type {笔记内插件配置} from "./imports";
/** 用途：插件运行状态；使用范围：唯一 Map 与查询结果；解耦评估：同领域数据类型。 */
import type {笔记内插件运行状态} from "./imports";
/** 用途：完整管理器厂牌；使用范围：具体 class 公共身份；解耦评估：同领域声明直接引用，不经过外部依赖网关。 */
import {inNotePluginManagerBrand} from "./inNotePluginManager.types";
/** 用途：完整管理器领域根；使用范围：模块级恢复编排只依赖公开能力；解耦评估：同领域抽象直接引用。 */
import type {InNotePluginManagerDomain} from "./inNotePluginManager.types";

const STORAGE_KEY = "in-note-plugins";

/** 读取持久化启用列表，保持损坏数据时记录警告并返回空列表的既有语义。 */
const readEnabledPluginIds = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed: string[] = JSON.parse(saved);
            return parsed;
        }
    } catch (error) {
        console.warn("读取插件列表失败:", error);
    }
    return [];
};

/** 写入完整启用列表，保持存储失败可观察但不阻断插件运行的既有语义。 */
const saveEnabledPluginIds = (ids: string[]) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
        console.warn("保存插件列表失败:", error);
    }
};

/** 查询恢复插件所需的文档标题，保持请求失败警告与 null 语义。 */
const getPluginDocumentTitle = async (docId: string) => {
    try {
        const response = await fetchSyncPost("/api/block/getBlockInfo", {id: docId});
        if (response && response.code === 0 && response.data) {
            return response.data.rootTitle || response.data.name || docId;
        }
    } catch (error) {
        console.warn(`获取文档标题失败: ${docId}`, error);
    }
    return null;
};

/** 恢复持久化列表中的有效插件；单插件失败不阻断其余插件恢复。 */
const restoreEnabledPlugins = async (manager: InNotePluginManagerDomain<AppFacade>) => {
    for (const docId of readEnabledPluginIds()) {
        try {
            const title = await getPluginDocumentTitle(docId);
            if (!title) {
                console.warn(`笔记内插件文档不存在: ${docId}`);
                saveEnabledPluginIds(readEnabledPluginIds().filter((id) => id !== docId));
                continue;
            }
            await manager.启用插件(docId, title);
        } catch (error) {
            console.error(`加载笔记内插件 ${docId} 失败:`, error);
        }
    }
};

/* @允许类: InNotePluginManager 是笔记内插件子系统唯一的有状态领域根。应用启动时创建一个实例，
 * 该实例在整个宿主生命周期内持续持有唯一 AppFacade、初始化完成标志以及以文档 ID 为键的插件
 * 运行状态 Map；启用、禁用、重载、状态查询、文档标记和全部卸载必须观察并修改同一份状态。
 * 旧实现把这些状态放在模块级变量中，导致桌面、移动、独立宿主和测试共享隐式单例，实例销毁
 * 也不能回收状态。改为普通函数与闭包工厂会重新引入不可枚举的捕获状态，改为服务定位器会让
 * 依赖方向和初始化缺失再次隐藏，拆成多个小对象则会破坏启停事务和持久化列表之间的原子顺序。
 * class 在此只承担状态容器和公开领域命令；存储读写、标题查询与恢复编排已经提取为模块级函数，
 * 不保留无法独立测试的私有算法。完整公共表面由 InNotePluginManagerDomain 一次性描述，并由
 * PublicInstanceLooksLike 对具体实现与抽象执行双向校验；菜单、编辑器和 AppFacade 仅依赖该完整
 * 抽象，具体 class 只出现在 factory 与契约测试边界。Symbol 厂牌提供稳定运行时身份但不保存状态，
 * 每个 App 宿主拥有自己的实例，因而不会混淆桌面、移动或并行测试的数据。保留这一唯一 class
 * 是保证插件生命周期、状态所有权、对象身份和可销毁性的必要实现边界，不是为无状态工具增加包装。
 */
export class InNotePluginManager {
    public get [inNotePluginManagerBrand]() {
        return "InNotePluginManager" as const;
    }

    private app: AppFacade | null = null;
    private initialized = false;
    private readonly plugins = new Map<string, 笔记内插件运行状态<Plugin>>();

    /** 初始化唯一应用身份并恢复已启用插件。 */
    public async init(app: AppFacade) {
        if (this.initialized) {
            console.warn("笔记内插件管理器已经初始化");
            return;
        }
        this.app = app;
        this.initialized = true;
        await restoreEnabledPlugins(this);
        console.log("笔记内插件管理器初始化完成");
    }

    /** 创建配置、加载插件并在首次启用时持久化文档身份。 */
    public async 启用插件(docId: string, displayName: string) {
        if (!this.app) {
            console.error("管理器未初始化");
            return false;
        }
        // 同一文档已加载时保持既有幂等语义，不重复创建运行时实例。
        if (this.plugins.has(docId)) {
            console.warn(`插件已加载: ${displayName}`);
            return true;
        }
        const config: 笔记内插件配置 = {
            docId,
            name: `in-note-${docId}`,
            displayName,
            enabled: true,
            lastLoadAt: 0,
            lastError: null,
        };
        const state = await 加载笔记内插件(this.app, config);
        this.plugins.set(docId, state);
        const ids = readEnabledPluginIds();
        // 仅首次启用时追加身份，避免持久化列表产生重复项。
        if (!ids.includes(docId)) {
            saveEnabledPluginIds([...ids, docId]);
        }
        return state.status === "running";
    }

    /** 卸载指定插件并删除持久化启用身份。 */
    public async 禁用插件(docId: string) {
        const state = this.plugins.get(docId);
        if (!state) {
            return;
        }
        卸载笔记内插件(state);
        this.plugins.delete(docId);
        saveEnabledPluginIds(readEnabledPluginIds().filter((id) => id !== docId));
    }

    /** 以原显示名称同步完成禁用，再重新启用同一文档。 */
    public async 重载插件(docId: string) {
        const state = this.plugins.get(docId);
        if (!state) {
            return false;
        }
        const displayName = state.config.displayName;
        void this.禁用插件(docId);
        return this.启用插件(docId, displayName);
    }

    /** 返回当前全部插件状态的快照数组。 @同步豁免: UI构建 */
    public 获取所有插件() {
        return Array.from(this.plugins.values());
    }

    /** 返回指定文档的当前插件状态。 @同步豁免: UI构建 */
    public 获取插件状态(docId: string) {
        return this.plugins.get(docId);
    }

    /** 同步判断文档是否已启用，用于菜单标签构建。 @同步豁免: UI构建 */
    public 是否已启用(docId: string) {
        return this.plugins.has(docId);
    }

    /** 将文档标记为插件来源，保持编译器既有失败返回语义。 */
    public async 设置为插件文档(docId: string) {
        return 设置为插件文档(docId);
    }

    /** 卸载当前实例拥有的全部插件并清空唯一状态 Map。 */
    public async 卸载所有插件() {
        for (const state of this.plugins.values()) {
            try {
                卸载笔记内插件(state);
            } catch (error) {
                console.error("卸载插件失败:", error);
            }
        }
        this.plugins.clear();
    }

}
