/**
 * Popover 模块外部依赖转发
 * 集中管理父级目录导入，便于依赖追踪和解耦
 */

// 用途：块面板类，用于创建和管理浮窗面板；使用范围：target.ts 中进行类型检查和面板清理操作；解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
import { BlockPanel } from "../panel/Panel";
// 用途：判断元素是否在块级元素内；使用范围：refDefs.ts 中获取虚拟块引用时需要找到最近的块元素；解耦评估：工具函数，通过参数传递元素即可使用，已充分解耦
import { hasClosestBlock } from "../../protyle/util/hasClosest";
// 用途：判断元素是否包含指定属性的祖先元素；使用范围：target.ts 中查找块引用和链接元素；解耦评估：DOM查询工具函数，通过参数传递即可使用，已充分解耦
import { hasClosestByAttribute } from "../../protyle/util/hasClosest";
// 用途：判断祖先是否有指定类名；使用范围：tooltip.ts 查找特定类名父元素；解耦评估：DOM查询工具，通过参数传递即可使用
import { hasClosestByClassName } from "../../protyle/util/hasClosest";
// 用途：发送同步 POST 请求；使用范围：refDefs.ts 从后端获取引用定义；解耦评估：网络基础设施，可通过依赖注入解耦，但直接导入更合理
import { fetchSyncPost } from "../../util/network/fetch";
// 用途：发送异步 POST 请求到后端 API；使用范围：tooltip.ts 中获取资源信息和笔记本信息；解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { fetchPost } from "../../util/network/fetch";
// 用途：从思源协议 URL 中提取块 ID；使用范围：refDefs.ts 中处理思源协议链接时解析 ID；解耦评估：纯函数工具，通过参数传递即可使用，已充分解耦
import { getIdFromSYProtocol } from "../../util/file/pathName";
// 用途：判断路径是否为本地路径；使用范围：tooltip.ts 中判断链接是否需要显示本地资源信息；解耦评估：纯函数工具，通过参数传递即可使用，已充分解耦
import { isLocalPath } from "../../util/file/pathName";
// 用途：隐藏 tooltip；使用范围：tooltip.ts 中需要隐藏提示时调用；解耦评估：UI操作函数，可通过事件机制解耦，但作为全局UI基础设施直接导入更合理
import { hideTooltip } from "../../dialog/tooltip";
// 用途：显示 tooltip；使用范围：tooltip.ts 中需要显示提示时调用；解耦评估：UI操作函数，可通过事件机制解耦，但作为全局UI基础设施直接导入更合理
import { showTooltip } from "../../dialog/tooltip";
// 用途：提供全局常量配置；使用范围：tooltip.ts 和 target.ts 中使用标题长度限制、菜单名称等常量；解耦评估：全局配置，可通过配置注入解耦，但作为全局常量直接导入更合理
import { Constants } from "../../constants";
// 用途：判断当前设备是否为触摸设备；使用范围：target.ts 中根据设备类型选择不同的事件目标获取方式；解耦评估：平台检测工具函数，通过参数传递即可使用，已充分解耦
import { isTouchDevice } from "../../util/platform/functions";
// 用途：类型守卫函数，判断元素是否为HTMLElement；使用范围：target.ts 中进行类型检查确保DOM操作安全；解耦评估：类型守卫工具函数，通过参数传递即可使用，已充分解耦
import { isHTMLElement } from "../../util/DOM/element.guard";
// 用途：获取属性视图单元格文本；使用范围：tooltip.ts 显示AV单元格tooltip；解耦评估：业务函数，参数可解耦，但作为protyle核心直接导入更合理
import { getCellText } from "../../protyle/render/av/cell";
// 用途：转义 aria-label 属性值；使用范围：tooltip.ts 中处理tooltip内容时防止XSS；解耦评估：安全工具函数，通过参数传递即可使用，已充分解耦
import { escapeAriaLabel } from "../../util/DOM/escape";
// 用途：转义 HTML 内容；使用范围：tooltip.ts 中处理tooltip内容时防止XSS；解耦评估：安全工具函数，通过参数传递即可使用，已充分解耦
import { escapeHtml } from "../../util/DOM/escape";
// 用途：获取国际化文本；使用范围：tooltip.ts 中显示本地化的提示信息；解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
// 用途：获取思源全局配置；使用范围：target.ts 中检查编辑器浮窗模式配置；解耦评估：全局配置访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取当前所有块面板实例；使用范围：target.ts 中遍历块面板进行层级检查和清理操作；解耦评估：全局状态访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanBlockPanels } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取当前菜单实例；使用范围：target.ts 中检查菜单层级和数据状态；解耦评估：全局状态访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanMenus } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：获取键盘按键状态；使用范围：target.ts 中检查Alt和Ctrl键是否按下以控制popover显示；解耦评估：全局状态访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSiyuanKeyboardState } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
// 用途：SForge全局状态符号常量；使用范围：target.ts 中访问popover目标元素状态；解耦评估：全局状态管理基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { SForgeSymbols } from "../../config/sforge";
// 用途：获取SForge全局状态；使用范围：target.ts 中读取popover目标元素状态；解耦评估：全局状态管理基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { getSForgeState } from "../../config/sforge";
// 用途：设置SForge全局状态；使用范围：target.ts 中更新popover目标元素状态；解耦评估：全局状态管理基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
import { setSForgeState } from "../../config/sforge";

// 块面板类导出
export { BlockPanel };
// DOM 工具函数导出
export { hasClosestBlock };
// DOM 工具函数导出
export { hasClosestByAttribute };
// DOM 工具函数导出
export { hasClosestByClassName };
// 网络请求工具导出
export { fetchSyncPost };
// 网络请求工具导出
export { fetchPost };
// 路径解析工具导出
export { getIdFromSYProtocol };
// 路径解析工具导出
export { isLocalPath };
// Dialog 工具导出
export { hideTooltip };
// Dialog 工具导出
export { showTooltip };
// 常量导出
export { Constants };
// 平台检测工具导出
export { isTouchDevice };
// 类型守卫工具导出
export { isHTMLElement };
// Protyle 工具导出
export { getCellText };
// DOM 转义工具导出
export { escapeAriaLabel };
// DOM 转义工具导出
export { escapeHtml };
// 环境工具导出
export { siyuanI18n };
// 环境配置访问器导出
export { getSiyuanConfig };
// 环境状态访问器导出
export { getSiyuanBlockPanels };
// 环境状态访问器导出
export { getSiyuanMenus };
// 环境状态访问器导出
export { getSiyuanKeyboardState };
// SForge状态管理导出
export { SForgeSymbols };
// SForge状态管理导出
export { getSForgeState };
// SForge状态管理导出
export { setSForgeState };
