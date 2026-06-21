/**
 * 用途：集中管理 protyleMenus 模块的所有外部依赖导入
 * 使用范围：本模块内所有文件通过此文件导入外部依赖
 * 解耦评估：作为导入转发层，已经是解耦的最佳实践，无需进一步解耦
 */

// 编辑器功能导入
/**
 * 用途：重命名资源文件（如图片、视频等媒体资源）
 * 使用范围：protyle.videoMenu 中为本地资源提供重命名功能
 * 解耦评估：核心业务逻辑，已通过模块化封装。可通过命令模式解耦，但考虑到使用频率和项目规模，当前直接导入是合理的
 */
import { renameAsset } from "../../../editor/rename";
/** 导出 renameAsset 用于重命名资源文件 */
export { renameAsset };

// 平台相关导入
/**
 * 用途：检测当前是否在 Electron 环境中运行
 * 使用范围：protyle.videoMenu 中判断是否显示复制资源到剪贴板功能（仅桌面端支持）
 * 解耦评估：平台检测是基础设施功能，通过环境变量或配置注入会增加复杂度，当前方式合理
 */
import { isElectron } from "../../../platform";
/** 导出 isElectron 用于检测 Electron 环境 */
export { isElectron };

// 窗口和配置导入
/**
 * 用途：获取思源配置信息
 * 使用范围：protyle.videoMenu 中获取操作系统类型，判断是否支持复制资源功能
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { getSiyuanConfig } from "../../../window/imports";
/** 导出 getSiyuanConfig 用于获取思源配置 */
export { getSiyuanConfig };

// 国际化导入
/**
 * 用途：获取国际化文本
 * 使用范围：protyle.videoMenu 中显示菜单项文本（如"链接"、"重命名"、"打开方式"等）
 * 解耦评估：已通过环境抽象层封装，是解耦的良好实践
 */
import { siyuanI18n } from "../../commonMenuItem/imports";
/** 导出 siyuanI18n 用于国际化文本 */
export { siyuanI18n };

// 菜单工具导入
/**
 * 用途：创建"打开方式"子菜单
 * 使用范围：protyle.videoMenu 中为资源文件提供多种打开方式选项
 * 解耦评估：菜单构建工具函数，已通过模块化封装，无需进一步解耦
 */
import { openMenu } from "../../commonMenuItem/openMenu";
/** 导出 openMenu 用于创建打开方式菜单 */
export { openMenu };

/**
 * 用途：导出资源文件到本地
 * 使用范围：protyle.videoMenu 中为本地资源提供导出功能
 * 解耦评估：业务逻辑函数，已通过模块化封装，无需进一步解耦
 */
import { exportAsset } from "../../util";
/** 导出 exportAsset 用于导出资源 */
export { exportAsset };

/**
 * 用途：复制资源文件到剪贴板
 * 使用范围：protyle.videoMenu 中为本地资源提供复制功能（仅桌面端支持）
 * 解耦评估：业务逻辑函数，已通过模块化封装，无需进一步解耦
 */
import { copyAsset } from "../../util";
/** 导出 copyAsset 用于复制资源到剪贴板 */
export { copyAsset };

// 事务导入
/**
 * 用途：写入编辑器事务，保证修改可撤销/重做
 * 使用范围：protyle.videoMenu 中修改 src 后提交事务
 * 解耦评估：事务能力属于编辑器基础设施，当前直接依赖合理，通过本文件转发控制耦合边界
 */
import { updateTransaction } from "../../../protyle/wysiwyg/transaction";
/** 导出 updateTransaction 用于提交编辑事务 */
export { updateTransaction };
