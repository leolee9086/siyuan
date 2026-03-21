/**
 * 用途：第三方集市源返回的单个包元信息。
 * 使用场景：集市广场包列表展示、发布记录与安装操作。
 * 关联类型：被 IBazaarPublishedIndex 作为 packages 元素引用。
 * 问题/改进：当前字段与后端结构保持一致，后续如增加签名信息可继续扩展。
 */
/** 导出接口 IBazaarPublishedItem 供 bazaar-hub 模块复用 */
export interface IBazaarPublishedItem {
    packageType: string;
    packageName: string;
    version: string;
    artifactId: string;
    publishedAt: number;
    checksumSHA: string;
    displayName: string;
    description: string;
    author: string;
    officialName: boolean;
    downloadPath: string;
}

/**
 * 用途：第三方源包索引数据。
 * 使用场景：读取某个源后渲染包列表与更新时间。
 * 关联类型：packages 字段由 IBazaarPublishedItem 组成。
 * 问题/改进：若后续索引分页化，可补充分页游标字段。
 */
/** 导出接口 IBazaarPublishedIndex 供 bazaar-hub 模块复用 */
export interface IBazaarPublishedIndex {
    updatedAt: number;
    packages: IBazaarPublishedItem[];
}

/**
 * 用途：当前工作空间可发布包的本地安装信息。
 * 使用场景：发布设置页“当前工作空间可发布包”表格。
 * 关联类型：被 IBazaarPublishWorkspace.installed 的数组元素使用。
 * 问题/改进：当前以展示字段为主，后续如需安装来源可补充 sourceID。
 */
/** 导出接口 IBazaarInstalledPackage 供 bazaar-hub 模块复用 */
export interface IBazaarInstalledPackage {
    name: string;
    version: string;
    author: string;
    preferredName: string;
    preferredDesc: string;
}

/**
 * 用途：集市发布工作空间完整配置快照。
 * 使用场景：发布设置页初始化、保存配置后状态回填。
 * 关联类型：聚合 Config 下发布/安全/偏好配置及 IBazaarInstalledPackage。
 * 问题/改进：该结构与后端接口强绑定，字段变更需要前后端同步。
 */
/** 导出接口 IBazaarPublishWorkspace 供 bazaar-hub 模块复用 */
export interface IBazaarPublishWorkspace {
    sources: Config.IBazaarSource[];
    publish: Config.IBazaarPublish;
    security: Config.IBazaarSecurity;
    hub: Config.IBazaarHubPreference;
    installed: Record<string, IBazaarInstalledPackage[]>;
}

/**
 * 用途：集市页面初始化所需的聚合数据。
 * 使用场景：集市广场与发布设置初始化时一次性读取。
 * 关联类型：workspace 使用 IBazaarPublishWorkspace，published 使用 IBazaarPublishedIndex。
 * 问题/改进：当前一次性返回全部数据，后续可按场景拆分接口降低负载。
 */
/** 导出接口 IBazaarWorkspaceBundle 供 bazaar-hub 模块复用 */
export interface IBazaarWorkspaceBundle {
    workspace: IBazaarPublishWorkspace;
    published: IBazaarPublishedIndex;
}

/**
 * 用途：发布操作返回结果。
 * 使用场景：发布按钮执行后显示版本信息或警告提示。
 * 关联类型：record 与 Config.IBazaarPublishRecord 对齐。
 * 问题/改进：warning 目前是单字符串，后续可扩展为结构化告警列表。
 */
/** 导出接口 IBazaarPublishResult 供 bazaar-hub 模块复用 */
export interface IBazaarPublishResult {
    record: Config.IBazaarPublishRecord;
    warning: string;
}

/**
 * 用途：从第三方源安装包后的返回数据。
 * 使用场景：集市广场安装动作完成后确认包类型和名称。
 * 关联类型：与 installBazaarPackageFromSource API 返回值一一对应。
 * 问题/改进：如后续需要展示安装耗时，可补充 duration 字段。
 */
/** 导出接口 IBazaarInstallFromSourceResult 供 bazaar-hub 模块复用 */
export interface IBazaarInstallFromSourceResult {
    packageType: string;
    packageName: string;
}

/**
 * 用途：单个客户端的安全统计条目。
 * 使用场景：发布设置页安全防护统计表格。
 * 关联类型：由 IBazaarSecurityStats.clients 持有。
 * 问题/改进：当前仅统计通过/拒绝次数，后续可增加 userAgent。
 */
/** 导出接口 IBazaarSecurityClientStats 供 bazaar-hub 模块复用 */
export interface IBazaarSecurityClientStats {
    ip: string;
    accepted: number;
    rejected: number;
    lastSeen: number;
}

/**
 * 用途：发布安全限流统计汇总。
 * 使用场景：发布设置页展示总通过/拒绝与客户端明细。
 * 关联类型：clients 使用 IBazaarSecurityClientStats 数组。
 * 问题/改进：统计窗口目前由后端控制，前端仅负责展示。
 */
/** 导出接口 IBazaarSecurityStats 供 bazaar-hub 模块复用 */
export interface IBazaarSecurityStats {
    totalAccepted: number;
    totalRejected: number;
    clients: IBazaarSecurityClientStats[];
}
