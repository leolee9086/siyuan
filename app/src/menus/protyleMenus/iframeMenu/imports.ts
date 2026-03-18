/**
 * 用途：集中管理 iframeMenu 模块的所有外部依赖导入
 * 使用范围：本模块内所有文件通过此文件导入外部依赖
 * 解耦评估：作为导入转发层，已经是解耦的最佳实践，无需进一步解耦
 */

// ============ 事务处理导入 ============
/**
 * 用途：更新 Protyle 编辑器的事务记录，用于撤销/重做功能
 * 使用范围：handleIframeSrcChange 函数中，当用户修改 iframe src 后记录变更
 * 解耦评估：核心编辑器功能，是 Protyle 架构的基础设施。可通过依赖注入解耦，但考虑到这是菜单模块直接操作编辑器内容的必要功能，当前直接导入是合理的。若未来需要支持多种编辑器，可考虑抽象为事务接口
 */
import { updateTransaction } from "../../../protyle/wysiwyg/transaction";
/** 导出 updateTransaction 用于记录编辑器事务 */
export { updateTransaction };

// ============ 工具函数导入 ============
/**
 * 用途：从 URL 中提取查询参数值
 * 使用范围：updateIframeAttributes 函数中解析 Bilibili 视频链接的 bvid 参数
 * 解耦评估：纯工具函数，无副作用，无需解耦。已通过平台抽象层封装，是良好实践
 */
import { getSearch } from "../../../util/platform/functions";
/** 导出 getSearch 用于解析 URL 参数 */
export { getSearch };

// ============ 国际化导入 ============
/**
 * 用途：获取国际化文本，用于显示用户界面文本
 * 使用范围：iframeMenu 函数中显示 "链接" 占位符文本
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践，无需进一步改进
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 用于国际化文本 */
export { siyuanI18n };

// ============ 菜单功能导入 ============
/**
 * 用途：生成"打开方式"子菜单，提供多种打开 iframe 链接的选项
 * 使用范围：iframeMenu 函数中，当 iframe 有有效 src 时追加打开方式菜单
 * 解耦评估：通用菜单组件，已模块化封装。可通过依赖注入解耦，但考虑到这是菜单模块间的协作，当前直接导入是合理的。若未来需要支持自定义菜单提供者，可考虑使用策略模式或插件机制
 */
import { openMenu } from "../../commonMenuItem/openMenu";
/** 导出 openMenu 用于生成打开方式菜单 */
export { openMenu };
