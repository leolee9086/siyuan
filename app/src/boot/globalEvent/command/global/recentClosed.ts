/** 用途：引入全局常量集合。使用范围：仅供最近关闭标签恢复读取存储键。解耦评估：常量集中管理，避免硬编码存储 key。 */
import { Constants } from "./imports";
/** 用途：引入文件打开入口。使用范围：供搜索、资产、自定义和编辑器页签恢复使用。解耦评估：恢复逻辑复用既有打开入口，不重建页签创建细节。 */
import { openFile } from "./imports";
/** 用途：引入反链页签打开入口。使用范围：供 Backlink 最近关闭页签恢复使用。解耦评估：命令层只传递恢复数据，具体 UI 创建仍由布局 Dock 层负责。 */
import { openBacklink } from "./imports";
/** 用途：引入关系图页签打开入口。使用范围：供 Graph 最近关闭页签恢复使用。解耦评估：复用布局 Dock 层公开入口。 */
import { openGraph } from "./imports";
/** 用途：引入大纲页签打开入口。使用范围：供 Outline 最近关闭页签恢复使用。解耦评估：复用布局 Dock 层公开入口。 */
import { openOutline } from "./imports";
/** 用途：引入网络请求工具。使用范围：供资产状态和块信息检查使用。解耦评估：保持原回调式请求语义，不改变时序。 */
import { fetchPost } from "./imports";
/** 用途：引入本地存储兼容写入工具。使用范围：弹出最近关闭标签后回写剩余列表。解耦评估：存储写入仍走既有兼容入口。 */
import { setStorageVal } from "./imports";
/** 用途：引入存储访问器。使用范围：读取最近关闭标签列表。解耦评估：通过环境访问器替代新增直接 window 访问。 */
import { getSiyuanStorage } from "./imports";
/** 用途：引入 CaliburRouter 构建 instance 路由。使用范围：仅用于本文件恢复处理器选择。解耦评估：路由只返回处理函数，副作用留在执行器。 */
import { calibur } from "./imports";
/** 用途：引入 arktype 类型声明器。使用范围：仅与 recentClosedRestoreRouter 的 split 条件配套使用。解耦评估：属于路由 schema 基础设施。 */
import { type } from "./imports";
/** 用途：引入最近关闭子布局守卫。使用范围：恢复页签前校验 closeData.children。解耦评估：类型收窄集中在 guard 文件，业务文件不使用断言。 */
import { isRecentClosedChildLayout } from "./recentClosed.guard";
/** 用途：引入全局命令上下文类型。使用范围：构造最近关闭恢复上下文。解耦评估：复用同目录命令边界类型。 */
import type { GlobalCommandContext } from "./types";
/** 用途：引入最近关闭恢复上下文类型。使用范围：标注恢复处理器入参。解耦评估：类型定义集中在 types.ts。 */
import type { RecentClosedRestoreContext } from "./types";

/** 恢复搜索页签。 */
const restoreSearchRecentClosedTab = ({ app, childData }: RecentClosedRestoreContext) => {
    openFile({
        app,
        searchData: childData.config,
    });
    return true;
};

/** 处理资产状态检查响应，资产仍可打开时恢复资产页签。 */
const handleAssetStatResponse = ({ app, childData }: RecentClosedRestoreContext) => (response: { code: number }) => {
    // code 为 1 表示资产不可按原路径恢复，保留原逻辑仅在其它状态下重新打开。
    if (response.code !== 1) {
        openFile({
            app,
            assetPath: childData.path,
            page: childData.page,
        });
    }
};

/** 恢复资产页签。 */
const restoreAssetRecentClosedTab = (context: RecentClosedRestoreContext) => {
    fetchPost("/api/asset/statAsset", { path: context.childData.path }, handleAssetStatResponse(context));
    return true;
};

/** 判断自定义页签的模型是否仍然可用。 */
const hasCustomModel = ({ app, childData }: RecentClosedRestoreContext) => {
    if (childData.customModelType === "siyuan-card") {
        return true;
    }
    return !!app.plugins.find((plugin) => plugin.models[childData.customModelType]);
};

/** 恢复自定义页签。 */
const restoreCustomRecentClosedTab = (context: RecentClosedRestoreContext) => {
    const { app, childData, closeData } = context;
    // 插件自定义页签只有在内置卡片模型或插件模型仍存在时才能安全恢复。
    if (hasCustomModel(context)) {
        openFile({
            app,
            custom: {
                icon: closeData.icon,
                title: closeData.title,
                data: childData.customModelData,
                id: childData.customModelType,
            },
        });
    }
    return true;
};

/** 恢复编辑器页签。 */
const restoreEditorRecentClosedTab = ({ app, childData, closeData }: RecentClosedRestoreContext) => {
    openFile({
        app,
        fileName: closeData.title,
        id: childData.blockId,
        rootID: childData.rootId,
        mode: childData.mode,
        rootIcon: closeData.docIcon,
        action: [childData.action],
    });
    return true;
};

/** 恢复反链页签。 */
const restoreBacklinkRecentClosedTab = ({ app, childData, closeData }: RecentClosedRestoreContext) => {
    openBacklink({
        app,
        blockId: childData.blockId,
        rootId: childData.rootId,
        title: closeData.title,
    });
    return true;
};

/** 恢复关系图页签。 */
const restoreGraphRecentClosedTab = ({ app, childData, closeData }: RecentClosedRestoreContext) => {
    openGraph({
        app,
        blockId: childData.blockId,
        rootId: childData.rootId,
        title: closeData.title,
    });
    return true;
};

/** 恢复大纲页签。 */
const restoreOutlineRecentClosedTab = ({ app, childData, closeData }: RecentClosedRestoreContext) => {
    openOutline({
        app,
        rootId: childData.blockId,
        title: closeData.title,
        isPreview: childData.isPreview,
    });
    return true;
};

/** 默认恢复处理器，用于原逻辑中不属于可恢复类型的页签。 */
const ignoreUnsupportedRecentClosedTab = () => true;

/** 最近关闭页签的实例路由，将布局实例类型映射为具体恢复处理器。 */
const recentClosedRestoreRouter = calibur
    .universe(type({ instance: "string" }))
    .split(type({ instance: "'Search'" }), () => restoreSearchRecentClosedTab)
    .split(type({ instance: "'Asset'" }), () => restoreAssetRecentClosedTab)
    .split(type({ instance: "'Custom'" }), () => restoreCustomRecentClosedTab)
    .split(type({ instance: "'Editor'" }), () => restoreEditorRecentClosedTab)
    .split(type({ instance: "'Backlink'" }), () => restoreBacklinkRecentClosedTab)
    .split(type({ instance: "'Graph'" }), () => restoreGraphRecentClosedTab)
    .split(type({ instance: "'Outline'" }), () => restoreOutlineRecentClosedTab)
    .remain(() => ignoreUnsupportedRecentClosedTab)
    .build();

/** 处理块信息响应，确认根块仍匹配后恢复对应块相关页签。 */
const handleBlockInfoResponse = (context: RecentClosedRestoreContext, blockId: string) => (infoResponse: { data: { rootID: string } }) => {
    // 只有根块 ID 仍与关闭前一致时才恢复，避免块已删除或迁移后打开错误页签。
    if (infoResponse.data.rootID === blockId) {
        const executor = recentClosedRestoreRouter({ instance: context.childData.instance });
        executor(context);
    }
};

/** 需要先检查块信息的页签恢复流程。 */
const restoreBlockBoundRecentClosedTab = (context: RecentClosedRestoreContext) => {
    const { childData } = context;
    const blockId = childData.rootId || childData.blockId;
    fetchPost("/api/block/getBlockInfo", { id: blockId }, handleBlockInfoResponse(context, blockId));
    return true;
};

/** 恢复最近关闭页签，不改变原有的存储弹出和请求回调语义。 */
const restoreRecentClosedTab = (context: GlobalCommandContext, closeData: ILayoutTab) => {
    const childData = closeData.children;
    // 最近关闭数据来自本地存储，恢复前先确认 children 仍具备布局实例字段。
    if (!isRecentClosedChildLayout(childData)) {
        return true;
    }
    const restoreContext: RecentClosedRestoreContext = {
        ...context,
        closeData,
        childData,
    };
    // 这三类页签不依赖块根信息，保持原逻辑直接恢复，避免多余接口请求。
    if (childData.instance === "Search" || childData.instance === "Asset" || childData.instance === "Custom") {
        const executor = recentClosedRestoreRouter({ instance: childData.instance });
        return executor(restoreContext);
    }
    return restoreBlockBoundRecentClosedTab(restoreContext);
};

/**
 * 执行最近关闭标签恢复命令。
 * @同步豁免: UI构建 - globalCommand 是同步入口；本函数同步弹出存储项并发起原有回调式恢复流程。
 */
export const executeRecentClosedGlobalCommand = (context: GlobalCommandContext) => {
    const closedTabs = getSiyuanStorage()[Constants.LOCAL_CLOSED_TABS];
    // 最近关闭列表为空时原命令仍视为已处理，只是不执行恢复动作。
    if (closedTabs.length > 0) {
        const closeData = closedTabs.pop();
        setStorageVal(Constants.LOCAL_CLOSED_TABS, closedTabs);
        return restoreRecentClosedTab(context, closeData);
    }
    return true;
};
