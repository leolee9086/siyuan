/** 用途：读取 README HTML；使用范围：README 渲染生命周期；解耦评估：网络能力由基础设施唯一实现提供，业务侧不复制请求封装。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 README HTML 查询。 */
export {fetchPost};
/** 用途：执行 README 内容高亮；使用范围：README 渲染生命周期；解耦评估：复用 Protyle 唯一高亮实现，不复制 Markdown 处理。 */
import {highlightRender} from "../../../protyle/render/highlightRender";
/** 导出 README 内容高亮。 */
export {highlightRender};
/** 用途：读取 Bazaar API；使用范围：README URI 查询；解耦评估：网络能力保持唯一实现，不复制请求封装。 */
import {fetchSyncPost} from "../../../util/network/fetch";
/** 导出同步 Bazaar 查询。 */
export {fetchSyncPost};
/** 用途：读取前端平台标识；使用范围：README 查询参数；解耦评估：平台识别保持统一实现。 */
import {getFrontend} from "../../../util/platform/functions";
/** 导出前端标识读取。 */
export {getFrontend};
/** 用途：判断移动宿主；使用范围：README URI 桌面入口；解耦评估：平台分派由统一平台模块负责。 */
import {isMobile} from "../../../platform";
/** 导出移动平台判断。 */
export {isMobile};
/** 用途：显示资源缺失通知；使用范围：README 查询结果反馈；解耦评估：通知行为由公共消息所有者提供。 */
import {showMessage} from "../../../dialog/message";
/** 导出消息通知。 */
export {showMessage};
/** 用途：转义资源名称；使用范围：README 缺失消息；解耦评估：安全转义保持公共 DOM 工具唯一实现。 */
import {escapeHtml} from "../../../util/DOM/escape";
/** 导出 HTML 转义。 */
export {escapeHtml};
/** 用途：完整 AppFacade 类型；使用范围：README 设置导航参数；解耦评估：仅类型依赖，不加载 App 实现。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 导出 AppFacade 类型。 */
export type {AppFacade};
/** 用途：复用 Bazaar 资金信息模板；使用范围：README 侧栏；解耦评估：同域网关只直达唯一 HTML 生成器，不复制呈现逻辑。 */
import {genFundingHTML} from "../bazaarHtml";
/** 导出资金信息模板。 */
export {genFundingHTML};
/** 用途：读取 README 文案；使用范围：README 侧栏模板；解耦评估：统一 i18n 环境是现有唯一文案来源，不能在模板内复制。 */
import {siyuanI18n} from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 README 文案环境。 */
export {siyuanI18n};
