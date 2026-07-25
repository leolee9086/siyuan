/**
 * 用途：集中管理 bazaar-hub 目录对外部模块的依赖入口。
 * 使用范围：api/open/initHub/initPublish/initSource/register 等业务文件统一从此导入。
 * 解耦评估：通过网关层收敛跨目录路径依赖，后续替换实现时仅需改动此文件，减少业务层耦合面。
 */

/**
 * 用途：发送后端同步 POST 请求。
 * 使用范围：bazaar-hub API 客户端统一使用该请求入口。
 * 解耦评估：网络请求能力属于基础设施依赖，业务层需通过网关隔离具体路径。
 */
import { fetchSyncPost } from "../util/network/fetch";
/** 导出 fetchSyncPost 供 bazaar-hub 目录复用 */
export { fetchSyncPost };

/**
 * 用途：校验节点是否为 HTMLElement。
 * 使用范围：各 Tab 初始化函数在操作 DOM 前进行类型安全检查。
 * 解耦评估：DOM 类型守卫是底层工具能力，业务层通过网关依赖可避免散落路径耦合。
 */
import { isHTMLElement } from "../util/DOM/element.guard";
/** 导出 isHTMLElement 供 bazaar-hub 目录复用 */
export { isHTMLElement };

/**
 * 用途：自定义 Tab 的类型定义。
 * 使用范围：各 Tab 初始化函数参数约束。
 */
import type {CustomDomain} from "../layout/dock/custom/custom.types";
/** 导出完整 CustomDomain 供 bazaar-hub 目录复用。 */
export type {CustomDomain};

/**
 * 用途：弹出全局消息提示。
 * 使用范围：源测试、安装、发布等操作结果反馈。
 * 解耦评估：消息系统是 UI 基础能力，业务层通过网关依赖可降低直接路径耦合。
 */
import { showMessage } from "../dialog/message";
/** 导出 showMessage 供 bazaar-hub 目录复用 */
export { showMessage };

/**
 * 用途：打开系统设置面板。
 * 使用范围：集市广场中跳转到官方集市设置。
 * 解耦评估：设置入口属于应用级能力，业务层通过网关导入可减少直接耦合。
 */
import { openSetting } from "../config";
/** 导出 openSetting 供 bazaar-hub 目录复用 */
export { openSetting };

/**
 * 用途：获取当前前端运行标识。
 * 使用范围：安装包时上报 frontend 参数。
 * 解耦评估：平台识别能力为公共工具，业务层不应直接依赖具体工具文件路径。
 */
import { getFrontend } from "../util/platform/functions";
/** 导出 getFrontend 供 bazaar-hub 目录复用 */
export { getFrontend };

/**
 * 用途：打开自定义 Tab。
 * 使用范围：打开集市广场、发布设置和源站页面。
 * 解耦评估：Tab 打开能力属于编辑器能力层，业务层通过网关调用可减少路径耦合。
 */
import { openFile } from "../editor/util";
/** 导出 openFile 供 bazaar-hub 目录复用 */
export { openFile };

/**
 * 用途：读取当前所有模型实例。
 * 使用范围：打开 Tab 前检查是否已有同类型实例。
 * 解耦评估：模型检索能力是布局层通用接口，业务通过网关依赖可降低直接耦合。
 */
import { getAllModels } from "../layout/getAll";
/** 导出 getAllModels 供 bazaar-hub 目录复用 */
export { getAllModels };

/**
 * 用途：读取国际化文案对象。
 * 使用范围：构建 Tab 标题和按钮文案。
 * 解耦评估：i18n 环境能力应统一入口，业务层通过网关调用可隔离实现细节。
 */
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 bazaar-hub 目录复用 */
export { siyuanI18n };

/**
 * 用途：应用实例类型定义。
 * 使用范围：open.ts 中 app 参数和解析逻辑。
 */
import type {AppFacade} from "../app/AppFacade.types";
/** 导出类型 AppFacade 供 bazaar-hub 目录复用 */
export type {AppFacade};

/**
 * 用途：安全读取全局配置。
 * 使用范围：读取 serverAddrs、appearance.mode 等运行参数。
 * 解耦评估：全局配置读取由环境层封装，业务层通过网关调用可减少直接全局耦合。
 */
import { getSafeSiyuanConfig } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSafeSiyuanConfig 供 bazaar-hub 目录复用 */
export { getSafeSiyuanConfig };

/**
 * 用途：读取当前 WebSocket 容器。
 * 使用范围：open.ts 在未显式传入 app 时尝试恢复应用上下文。
 * 解耦评估：全局 ws 访问属于环境层能力，业务层通过网关调用可降低硬耦合。
 */
import { getSiyuanWebSocket } from "../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanWebSocket 供 bazaar-hub 目录复用 */
export { getSiyuanWebSocket };

/**
 * 用途：读取当前页面 origin。
 * 使用范围：拼接本地集市源 URL。
 * 解耦评估：浏览器 location 访问由环境层封装，业务层避免直接访问 window。
 */
import { getLocationOrigin } from "../util/siyuanEnvironments/windowStandard.environment";
/** 导出 getLocationOrigin 供 bazaar-hub 目录复用 */
export { getLocationOrigin };

/**
 * 用途：弹出确认对话框。
 * 使用范围：移除第三方源前二次确认。
 * 解耦评估：确认对话能力由公共组件层提供，业务层通过网关调用可减少耦合。
 */
import { confirmDialog } from "../dialog/confirmDialog";
/** 导出 confirmDialog 供 bazaar-hub 目录复用 */
export { confirmDialog };

/**
 * 用途：转义 HTML 属性值。
 * 使用范围：发布设置页面拼接字符串模板时防止属性注入。
 * 解耦评估：安全转义工具属于通用基础能力，业务层应通过网关复用。
 */
import { escapeAttr } from "../util/DOM/escape";
/** 导出 escapeAttr 供 bazaar-hub 目录复用 */
export { escapeAttr };

/**
 * 用途：转义 HTML 文本节点。
 * 使用范围：发布设置页面拼接字符串模板时防止文本注入。
 * 解耦评估：安全转义工具属于通用基础能力，业务层应通过网关复用。
 */
import { escapeHtml } from "../util/DOM/escape";
/** 导出 escapeHtml 供 bazaar-hub 目录复用 */
export { escapeHtml };

/**
 * 用途：注册自定义 Tab 到统一注册表。
 * 使用范围：register.ts 在启动时注册 bazaar 相关页面。
 * 解耦评估：注册中心是框架基础能力，业务层通过网关接入可收敛依赖边界。
 */
import { tabRegistry } from "../registry";
/** 导出 tabRegistry 供 bazaar-hub 目录复用 */
export { tabRegistry };
