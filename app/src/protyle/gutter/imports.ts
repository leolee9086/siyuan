/**
 * Gutter 模块统一导入转发
 *
 * 用途：集中管理 gutter 模块的所有外部依赖导入
 * 意图：通过统一的导入入口提高模块的可维护性和解耦性
 */

// ============ 国际化与环境配置 ============

/**
 * 用途：国际化文本获取，用于菜单标签显示
 * 使用范围：所有需要显示用户界面文本的菜单构建函数
 * 解耦评估：作为全局环境配置，通过参数传递会增加所有函数签名复杂度，当前直接导入是合理的
 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

/**
 * 用途：获取思源笔记配置，用于访问数据目录等配置信息
 * 使用范围：需要访问系统配置的菜单操作
 * 解耦评估：作为全局配置访问，通过参数传递会增加复杂度，当前直接导入是合理的
 */
import { getSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

// ============ 网络与数据操作 ============

/**
 * 用途：后端 API 调用，用于数据获取和操作
 * 使用范围：需要与后端交互的菜单操作（如导出、保存等）
 * 解耦评估：可通过依赖注入解耦，但会显著增加函数签名复杂度，当前项目架构下直接导入是合理的
 */
import { fetchPost } from "../../util/network/fetch";

// ============ 系统与文件操作 ============

/**
 * 用途：系统 Shell 操作，用于打开文件管理器等系统级操作
 * 使用范围：需要调用系统功能的菜单操作（如在文件夹中显示）
 * 解耦评估：可通过依赖注入解耦，但作为底层系统调用，直接导入是合理的
 */
import { originalPath, useShell } from "../../util/file/pathName";

/**
 * 用途：路径处理工具，用于构建文件路径
 * 使用范围：需要处理文件路径的菜单操作
 * 解耦评估：通过路径边界按需取得 Electron 原生实现
 */

// ============ 平台兼容性 ============

/**
 * 用途：移动端兼容性处理，用于在移动设备上打开文件
 * 使用范围：需要打开文件或 URL 的菜单操作
 * 解耦评估：可通过事件发射解耦，但当前使用频率较低，直接导入更简洁
 */
import {openByMobile} from "../../editor/openLink";

// ============ 导出 ============

/** 导出国际化文本获取工具 */
export { siyuanI18n };

/** 导出系统配置获取工具 */
export { getSiyuanConfig };

/** 导出后端 API 调用工具 */
export { fetchPost };

/** 导出系统 Shell 操作工具 */
export { useShell };

/** 导出原生路径入口。 */
export { originalPath };

/** 导出移动端兼容性工具 */
export { openByMobile };

/**
 * 用途：导出图片功能入口
 * 使用范围：块菜单等需要复用现有导出图片弹窗与流程的场景
 * 解耦评估：导出图片已在 protyle/export 模块集中实现，通过 imports.ts 转发可避免 gutter 层新增直接父级耦合
 */
import { exportImage } from "../export/util";

/** 导出图片功能入口 */
export { exportImage };

// ============ 渲染引擎 ============

/**
 * 用途：代码语法高亮渲染
 * 使用范围：代码块开关切换后重新渲染高亮
 * 解耦评估：渲染引擎依赖，通过 imports.ts 统一管理
 */
import { highlightRender } from "../render/highlightRender";

/** 导出代码语法高亮渲染 */
export { highlightRender };

// ============ 对话框工具 ============

/**
 * 用途：显示消息提示框
 * 使用范围：需要向用户展示加载状态、操作结果等场景
 * 解耦评估：UI基础设施，通过 imports.ts 统一管理
 */
import { showMessage } from "../runtime/dialog.port";

/**
 * 用途：隐藏消息提示框
 * 使用范围：异步操作完成后关闭提示框
 * 解耦评估：UI基础设施，通过 imports.ts 统一管理
 */
import { hideMessage } from "../runtime/dialog.port";

/** 导出消息提示工具 */
export { showMessage };
/** 导出隐藏消息提示工具 */
export { hideMessage };

// ============ 平台兼容性 ============

/**
 * 用途：保存导出文件，触发 Electron 系统保存对话框或浏览器下载
 * 使用范围：代码块导出为文件、数据库视图导出 CSV/ZIP 等需要下载文件的场景
 * 解耦评估：平台兼容性工具，通过 imports.ts 统一管理
 */
import { saveExportFile } from "../util/compatibility";

/** 导出文件保存工具 */
export { saveExportFile };

// ============ 菜单管理 ============

/**
 * 用途：获取全局菜单实例
 * 使用范围：代码块开关切换后需要关闭菜单的场景
 * 解耦评估：全局菜单管理，通过 imports.ts 统一管理
 */
import { getSiyuanMenus } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

/** 导出全局菜单实例获取函数 */
export { getSiyuanMenus };

// ============ AI功能 ============

/**
 * 用途：生成块内容图片
 * 使用范围：AI图片生成菜单功能
 * 解耦评估：通过imports.ts统一管理AI模块依赖
 */
import { 生成块内容图片 } from "../../ai/imageGeneration";

/** 导出生成块内容图片函数 */
export { 生成块内容图片 };

/**
 * 用途：识别空段落并执行其事务转换，供 gutter 转换菜单构建使用。
 * 使用范围：仅 buildGutterTurnIntoMenu.ts 的空段落菜单分支。
 * 解耦评估：事务所有者位于 wysiwyg 层，通过本目录入口集中依赖；将 protyle 上下文逐层传递会扩大菜单 API。
 */
import {isEmptyParagraph} from "../wysiwyg/transaction/transforms/emptyParagraph";
/** 导出空段落识别能力。 */
export {isEmptyParagraph};

/**
 * 用途：执行空段落结构转换事务，供 gutter 菜单点击动作调用。
 * 使用范围：仅 buildGutterTurnIntoMenu.ts 的 code/table/line/math 项。
 * 解耦评估：事务与 undo/focus 恢复必须由 wysiwyg 统一维护，局部重实现会破坏编辑器状态。
 */
import {turnEmptyParagraphsIntoTransaction} from "../wysiwyg/transaction/transforms/emptyParagraph";
/** 导出空段落事务转换能力。 */
export {turnEmptyParagraphsIntoTransaction};
