/**
 * 用途：集中管理 iframeMenu 模块的所有外部依赖导入
 * 使用范围：本模块内所有文件通过此文件导入外部依赖
 * 解耦评估：作为导入转发层，已经是解耦的最佳实践，无需进一步解耦
 */

// 事务处理导入
/**
 * 用途：更新 Protyle 编辑器的事务记录，用于撤销/重做功能
 * 使用范围：handleIframeSrcChange 函数中，当用户修改 iframe src 后记录变更
 * 解耦评估：核心编辑器功能，是 Protyle 架构的基础设施。可通过依赖注入解耦，但考虑到这是菜单模块直接操作编辑器内容的必要功能，当前直接导入是合理的。若未来需要支持多种编辑器，可考虑抽象为事务接口
 */
import {updateTransaction} from "../../../protyle/wysiwyg/transaction/update";
/** 导出 updateTransaction 用于记录编辑器事务 */
export { updateTransaction };

// 工具函数导入
/**
 * 用途：从 URL 中提取查询参数值
 * 使用范围：updateIframeAttributes 函数中解析 Bilibili 视频链接的 bvid 参数
 * 解耦评估：纯工具函数，无副作用，无需解耦。已通过平台抽象层封装，是良好实践
 */
import { getSearch } from "../../../util/platform/functions";
/** 导出 getSearch 用于解析 URL 参数 */
export { getSearch };

// 国际化导入
/**
 * 用途：获取国际化文本，用于显示用户界面文本
 * 使用范围：iframeMenu 函数中显示 "链接" 占位符文本
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践，无需进一步改进
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 用于国际化文本 */
export { siyuanI18n };

// 打开动作能力导入
/**
 * 用途：判断是否 Electron 环境
 * 使用范围：iframeMenu.open.ts 的浏览器打开动作
 * 解耦评估：平台能力属于外部依赖，适合在 imports.ts 转发
 */
import { isElectron } from "../../../platform";
/** 导出 isElectron */
export { isElectron };

/**
 * 用途：Electron 外链打开能力
 * 使用范围：iframeMenu.open.ts 的浏览器打开动作
 * 解耦评估：平台能力属于外部依赖，适合在 imports.ts 转发
 */
import { openExternal } from "../../../platform/electron/shell";
/** 导出 openExternal */
export { openExternal };

/**
 * 用途：移动端/浏览器打开能力
 * 使用范围：iframeMenu.open.ts 的浏览器打开动作
 * 解耦评估：兼容层能力属于外部依赖，适合在 imports.ts 转发
 */
import {openByMobile} from "../../../editor/openLink";
/** 导出 openByMobile */
export { openByMobile };

/**
 * 用途：复用 Bazaar source 自定义页签类型
 * 使用范围：iframeMenu.open.ts 的“在新页签中打开”动作
 * 解耦评估：仅依赖不可变类型常量，不加载 Bazaar 业务入口，避免菜单到业务实现的回边
 */
import { BAZAAR_SOURCE_TAB_TYPE } from "../../../bazaar-hub/constants";
/** 导出 BAZAAR_SOURCE_TAB_TYPE */
export { BAZAAR_SOURCE_TAB_TYPE };

/**
 * 用途：向当前窗口派发自定义事件
 * 使用范围：widgetMenu.ts 触发挂件菜单扩展事件
 * 解耦评估：事件派发能力属于外部依赖，适合在 imports.ts 转发
 */
import { dispatchWindowCustomEvent } from "../../../util/siyuanEnvironments/window.environment";
/** 导出 dispatchWindowCustomEvent */
export { dispatchWindowCustomEvent };

/**
 * 用途：向指定事件目标派发自定义事件
 * 使用范围：widgetMenu.ts 向挂件 iframe 窗口派发扩展事件
 * 解耦评估：事件派发能力属于外部依赖，适合在 imports.ts 转发
 */
import { dispatchCustomEvent } from "../../../util/siyuanEnvironments/window.environment";
/** 导出 dispatchCustomEvent */
export { dispatchCustomEvent };

/**
 * 用途：读取当前页面 origin
 * 使用范围：iframeMenu.open.ts 中补全相对地址
 * 解耦评估：location 环境能力属于外部依赖，适合在 imports.ts 转发
 */
import { getLocationOrigin } from "../../../util/siyuanEnvironments/windowLocation.environment";
/** 导出 getLocationOrigin */
export { getLocationOrigin };

/**
 * 用途：显示消息提示
 * 使用范围：iframeMenu.open.ts 的错误提示
 * 解耦评估：UI 能力属于外部依赖，适合在 imports.ts 转发
 */
import { showMessage } from "../../../dialog/message";
/** 导出 showMessage */
export { showMessage };

