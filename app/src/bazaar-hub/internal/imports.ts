/** 用途：集中转发 bazaar-hub/internal 目录对外依赖。使用范围：hub/publish 控制器与视图模块。解耦评估：通过内部网关隔离上层目录路径变更，减少业务文件耦合面。 */

/** 用途：DOM 类型守卫。使用范围：internal 子模块的 DOM/事件目标校验。解耦评估：直接指向守卫真实实现。 */
import {isHTMLElement} from "../../util/DOM/element.guard";
/** 导出 isHTMLElement 供 internal 子模块复用 */
export { isHTMLElement };

/** 用途：全局消息提示。使用范围：hub/publish 操作成功与失败反馈。解耦评估：直接指向消息系统真实实现。 */
import {showMessage} from "../../dialog/message";
/** 导出 showMessage 供 internal 子模块复用 */
export { showMessage };

/** 用途：读取前端平台标识。使用范围：hub 安装包动作参数。解耦评估：直接指向平台工具真实实现。 */
import {getFrontend} from "../../util/platform/functions";
/** 导出 getFrontend 供 internal 子模块复用 */
export { getFrontend };

/** 用途：读取安全配置快照。使用范围：hub 安装动作读取 appearance.mode。解耦评估：直接指向环境访问器。 */
import {getSafeSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSafeSiyuanConfig 供 internal 子模块复用 */
export { getSafeSiyuanConfig };

/** 用途：确认对话框能力。使用范围：publish 删除源确认。解耦评估：直接指向 Dialog 真实实现。 */
import {confirmDialog} from "../../dialog/confirmDialog";
/** 导出 confirmDialog 供 internal 子模块复用 */
export { confirmDialog };

/** 用途：HTML 属性转义。使用范围：publish 字符串模板属性值输出。解耦评估：直接指向安全转义真实实现。 */
import {escapeAttr} from "../../util/DOM/escape";
/** 导出 escapeAttr 供 internal 子模块复用 */
export { escapeAttr };

/** 用途：HTML 文本转义。使用范围：publish 字符串模板文本输出。解耦评估：直接指向安全转义真实实现。 */
import {escapeHtml} from "../../util/DOM/escape";
/** 导出 escapeHtml 供 internal 子模块复用 */
export { escapeHtml };

/** 用途：Custom Tab 类型定义。使用范围：hub/publish 控制器初始化入口。 */
import type {CustomDomain} from "../../layout/dock/custom/custom.types";
/** 导出完整 CustomDomain 供 internal 子模块复用。 */
export type {CustomDomain};

/** 用途：读取源包索引接口。使用范围：hub 切换源与刷新时加载包列表。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { getBazaarSourcePackages } from "../api";
/** 导出 getBazaarSourcePackages 供 internal 子模块复用 */
export { getBazaarSourcePackages };

/** 用途：读取工作空间聚合接口。使用范围：hub/publish 初始化与刷新。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { getBazaarWorkspaceBundle } from "../api";
/** 导出 getBazaarWorkspaceBundle 供 internal 子模块复用 */
export { getBazaarWorkspaceBundle };

/** 用途：安装第三方包接口。使用范围：hub 包卡片安装动作。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { installBazaarPackageFromSource } from "../api";
/** 导出 installBazaarPackageFromSource 供 internal 子模块复用 */
export { installBazaarPackageFromSource };

/** 用途：读取安全统计接口。使用范围：publish 页面加载安全统计。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { getBazaarSecurityStats } from "../api";
/** 导出 getBazaarSecurityStats 供 internal 子模块复用 */
export { getBazaarSecurityStats };

/** 用途：发布包接口。使用范围：publish 可发布包列表动作。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { publishBazaarPackage } from "../api";
/** 导出 publishBazaarPackage 供 internal 子模块复用 */
export { publishBazaarPackage };

/** 用途：移除源接口。使用范围：publish 源管理删除动作。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { removeBazaarSource } from "../api";
/** 导出 removeBazaarSource 供 internal 子模块复用 */
export { removeBazaarSource };

/** 用途：保存发布配置接口。使用范围：publish 保存配置与发布前同步。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { setBazaarPublishConfig } from "../api";
/** 导出 setBazaarPublishConfig 供 internal 子模块复用 */
export { setBazaarPublishConfig };

/** 用途：测试源接口。使用范围：publish 源管理测试动作。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { testBazaarSource } from "../api";
/** 导出 testBazaarSource 供 internal 子模块复用 */
export { testBazaarSource };

/** 用途：新增或更新源接口。使用范围：publish 源表单保存动作。解耦评估：同目录 API 依赖，网关转发保持边界清晰。 */
import { upsertBazaarSource } from "../api";
/** 导出 upsertBazaarSource 供 internal 子模块复用 */
export { upsertBazaarSource };

/** 用途：Hub 切换源事件名。使用范围：hub 内部监听外部切源事件。解耦评估：常量同目录维护，网关转发降低路径耦合。 */
import { BAZAAR_HUB_SET_SOURCE_EVENT } from "../constants";
/** 导出 BAZAAR_HUB_SET_SOURCE_EVENT 供 internal 子模块复用 */
export { BAZAAR_HUB_SET_SOURCE_EVENT };

/** 用途：打开发布设置 Tab。使用范围：hub 工具栏动作。解耦评估：同目录业务能力复用，网关转发保持边界清晰。 */
import { openBazaarPublishTab } from "../open";
/** 导出 openBazaarPublishTab 供 internal 子模块复用 */
export { openBazaarPublishTab };

/** 用途：打开源 Tab。使用范围：hub/publish 的“打开 Tab”动作。解耦评估：同目录业务能力复用，网关转发保持边界清晰。 */
import { openBazaarSourceTab } from "../open";
/** 导出 openBazaarSourceTab 供 internal 子模块复用 */
export { openBazaarSourceTab };

/** 用途：打开本地源 Tab。使用范围：hub/publish 顶部动作。解耦评估：同目录业务能力复用，网关转发保持边界清晰。 */
import { openLocalBazaarSourceTab } from "../open";
/** 导出 openLocalBazaarSourceTab 供 internal 子模块复用 */
export { openLocalBazaarSourceTab };

/** 用途：打开 Hub Tab。使用范围：publish 的“浏览包”动作。解耦评估：同目录业务能力复用，网关转发保持边界清晰。 */
import { openBazaarHubTab } from "../open";
/** 导出 openBazaarHubTab 供 internal 子模块复用 */
export { openBazaarHubTab };

/** 用途：第三方源包索引类型。使用范围：hub 状态和渲染函数。 */
import type { IBazaarPublishedIndex } from "../types";
/** 导出类型 IBazaarPublishedIndex 供 internal 子模块复用 */
export type { IBazaarPublishedIndex };

/** 用途：第三方源包项类型。使用范围：hub 列表过滤和卡片渲染。 */
import type { IBazaarPublishedItem } from "../types";
/** 导出类型 IBazaarPublishedItem 供 internal 子模块复用 */
export type { IBazaarPublishedItem };

/** 用途：工作空间聚合类型。使用范围：hub/publish 页面状态。 */
import type { IBazaarWorkspaceBundle } from "../types";
/** 导出类型 IBazaarWorkspaceBundle 供 internal 子模块复用 */
export type { IBazaarWorkspaceBundle };

/** 用途：安全统计类型。使用范围：publish 页面状态与渲染。 */
import type { IBazaarSecurityStats } from "../types";
/** 导出类型 IBazaarSecurityStats 供 internal 子模块复用 */
export type { IBazaarSecurityStats };
