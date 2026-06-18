/**
 * 用途：复用统一网络请求入口访问 bazaar 后端接口。
 * 使用范围：本文件全部 API 函数都会通过该依赖发起请求。
 * 解耦评估：网络层抽象属于基础依赖，当前无法通过参数注入替代，使用网关导入可降低路径耦合。
 */
import { fetchSyncPost } from "./imports";

/**
 * 用途：发布工作空间聚合返回值类型。
 * 使用范围：getBazaarWorkspaceBundle 返回值。
 */
import type { IBazaarWorkspaceBundle } from "./types";

/**
 * 用途：发布配置保存后的工作空间类型。
 * 使用范围：setBazaarPublishConfig 返回值。
 */
import type { IBazaarPublishWorkspace } from "./types";

/**
 * 用途：第三方源索引结果类型。
 * 使用范围：getBazaarSourcePackages 返回值。
 */
import type { IBazaarPublishedIndex } from "./types";

/**
 * 用途：包发布结果类型。
 * 使用范围：publishBazaarPackage 返回值。
 */
import type { IBazaarPublishResult } from "./types";

/**
 * 用途：从第三方源安装返回值类型。
 * 使用范围：installBazaarPackageFromSource 返回值。
 */
import type { IBazaarInstallFromSourceResult } from "./types";

/**
 * 用途：安全统计返回值类型。
 * 使用范围：getBazaarSecurityStats 返回值。
 */
import type { IBazaarSecurityStats } from "./types";

/**
 * 用途：统一校验后端响应 code 并返回 data。
 * 意图：避免每个 API 函数重复处理成功/失败分支。
 * 调用时机：每次 fetchSyncPost 返回后立即调用。
 * 问题/改进：当前错误信息依赖后端 msg，后续可补充错误码映射。
 */
/** @显式返回类型原因: 泛型函数需要显式返回类型以约束类型推导 */
const ensureOK = <T>(response: IWebSocketData, fallbackMsg: string): T => {
    if (!response || typeof response.code !== "number") {
        throw new Error(fallbackMsg);
    }
    if (response.code !== 0) {
        throw new Error(response.msg || fallbackMsg);
    }
    const data: T = response.data;
    return data;
};

/**
 * 用途：读取 bazaar 发布工作空间和已发布索引。
 * 调用时机：集市广场与发布设置页面初始化时调用。
 */
/** 导出 getBazaarWorkspaceBundle 供 bazaar-hub 页面初始化流程使用 */
export const getBazaarWorkspaceBundle = async () => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/getPublishWorkspace", {});
    return ensureOK<IBazaarWorkspaceBundle>(response, "load bazaar publish workspace failed");
};

/**
 * 用途：保存发布、安全、广场偏好配置。
 * 调用时机：发布设置页点击“保存发布配置”时调用。
 */
/** 导出 setBazaarPublishConfig 供发布设置页面保存配置使用 */
export const setBazaarPublishConfig = async (payload: {
    publish?: Config.IBazaarPublish;
    security?: Config.IBazaarSecurity;
    hub?: Config.IBazaarHubPreference;
}) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/setPublishConfig", payload);
    return ensureOK<IBazaarPublishWorkspace>(response, "save bazaar publish config failed");
};

/**
 * 用途：新增或更新第三方源。
 * 调用时机：发布设置页保存源表单时调用。
 */
/** 导出 upsertBazaarSource 供第三方源管理流程使用 */
export const upsertBazaarSource = async (source: Partial<Config.IBazaarSource>) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/upsertSource", source);
    const data = ensureOK<{ source: Config.IBazaarSource }>(response, "save bazaar source failed");
    return data.source;
};

/**
 * 用途：移除指定第三方源。
 * 调用时机：发布设置页点击“移除”并确认后调用。
 */
/** 导出 removeBazaarSource 供第三方源移除流程使用 */
export const removeBazaarSource = async (sourceID: string) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/removeSource", { sourceID });
    ensureOK(response, "remove bazaar source failed");
};

/**
 * 用途：测试第三方源可访问的包数量。
 * 调用时机：发布设置页点击“测试”时调用。
 */
/** 导出 testBazaarSource 供第三方源连通性测试使用 */
export const testBazaarSource = async (payload: { sourceID?: string; url?: string; token?: string }) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/testSource", payload);
    const data = ensureOK<{ packageCount: number }>(response, "test bazaar source failed");
    return data.packageCount || 0;
};

/**
 * 用途：读取指定源的包索引。
 * 调用时机：集市广场切换源或刷新时调用。
 */
/** 导出 getBazaarSourcePackages 供集市广场列表加载流程使用 */
export const getBazaarSourcePackages = async (sourceID: string) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/getSourcePackages", { sourceID });
    return ensureOK<IBazaarPublishedIndex>(response, "load source packages failed");
};

/**
 * 用途：发布指定类型与名称的包。
 * 调用时机：发布设置页点击“发布”按钮时调用。
 */
/** 导出 publishBazaarPackage 供发布操作流程使用 */
export const publishBazaarPackage = async (packageType: string, packageName: string) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/publishPackage", {
        packageType,
        packageName,
    });
    return ensureOK<IBazaarPublishResult>(response, "publish package failed");
};

/**
 * 用途：从指定第三方源安装包。
 * 调用时机：集市广场点击“安装”按钮时调用。
 */
/** 导出 installBazaarPackageFromSource 供集市广场安装流程使用 */
export const installBazaarPackageFromSource = async (payload: {
    sourceID: string;
    packageType: string;
    packageName: string;
    version: string;
    mode: number;
    frontend?: string;
    keyword?: string;
}) => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/installPackageFromSource", payload);
    return ensureOK<IBazaarInstallFromSourceResult>(response, "install package from source failed");
};

/**
 * 用途：读取发布安全统计信息。
 * 调用时机：发布设置页初始化和刷新时调用。
 */
/** 导出 getBazaarSecurityStats 供发布安全统计面板使用 */
export const getBazaarSecurityStats = async () => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/securityStats", {});
    return ensureOK<IBazaarSecurityStats>(response, "load bazaar security stats failed");
};
