/**
 * 用途：集中管理 assetMenu 模块的外部依赖
 * 使用范围：assetMenu 目录下业务文件统一从此处转发导入
 * 解耦评估：通过单一导入边界降低跨目录耦合，便于后续替换具体实现
 */

/**
 * 用途：恢复编辑器工具栏选区焦点
 * 使用范围：资源菜单在无回调场景关闭时恢复编辑状态
 * 解耦评估：编辑器基础能力，当前通过转发层隔离调用方
 */
import { focusToolbarRange } from "../../../protyle/util/selection";
/** 导出 focusToolbarRange 供资源菜单恢复焦点 */
export { focusToolbarRange };

/**
 * 用途：渲染素材预览 HTML
 * 使用范围：资源列表 hover 与初始预览区渲染
 * 解耦评估：预览渲染逻辑已在 asset 模块内封装，转发层保证边界稳定
 */
import { renderAssetsPreview } from "../../../asset/renderAssets";
/** 导出 renderAssetsPreview 供资源菜单渲染预览 */
export { renderAssetsPreview };

/**
 * 用途：打开全局资源选择对话框
 * 使用范围：桌面端 assetMenu 使用 Dialog 选择资源
 * 解耦评估：对话框能力已模块化，转发层可避免业务文件直接依赖实现路径
 */
import { openAssetDialog } from "../../../asset/assetDialog";
/** 导出 openAssetDialog 供桌面端资源选择 */
export { openAssetDialog };

/**
 * 用途：创建临时过滤菜单实例
 * 使用范围：Type/Size/Rating/Color 下拉过滤菜单
 * 解耦评估：菜单组件是基础设施，转发层用于收敛依赖入口
 */
import { Menu } from "../../../plugin/Menu";
/** 导出 Menu 供过滤下拉菜单构建 */
export { Menu };

/**
 * 用途：创建全局菜单项
 * 使用范围：移动端资源菜单 readonly 项追加
 * 解耦评估：菜单项组件依赖稳定，通过转发层与业务解耦
 */
import { MenuItem } from "../../Menu.Item";
/** 导出 MenuItem 供移动端资源菜单构建 */
export { MenuItem };

/**
 * 用途：向上查找列表项节点
 * 使用范围：资源列表 hover/click 事件命中项查找
 * 解耦评估：DOM 工具函数职责清晰，转发层保持业务与工具解耦
 */
import { hasClosestByClassName } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestByClassName 供列表事件命中判断 */
export { hasClosestByClassName };

/**
 * 用途：判断是否移动端
 * 使用范围：决定菜单弹出策略与布局模板差异
 * 解耦评估：平台判断能力通过转发层暴露，便于后续统一平台抽象
 */
import { isMobile } from "../../../platform";
/** 导出 isMobile 供资源菜单判断端类型 */
export { isMobile };

/**
 * 用途：处理列表上下键焦点移动
 * 使用范围：资源列表键盘导航
 * 解耦评估：键盘导航工具函数可复用，转发层避免业务跨层直接依赖
 */
import { upDownHint } from "../../../util/DOM/upDownHint";
/** 导出 upDownHint 供资源列表方向键导航 */
export { upDownHint };

/**
 * 用途：请求后端搜索和元数据接口
 * 使用范围：搜索资源列表与加载素材元数据
 * 解耦评估：网络调用能力统一由 fetchPost 提供，转发层保证调用边界一致
 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 fetchPost 供资源菜单请求后端数据 */
export { fetchPost };

/**
 * 用途：获取国际化文案
 * 使用范围：空内容、按钮与提示文案渲染
 * 解耦评估：i18n 能力已抽象，转发层可避免业务文件直接依赖环境路径
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供资源菜单文案展示 */
export { siyuanI18n };

/**
 * 用途：获取全局菜单单例
 * 使用范围：移动端资源菜单展示、关闭与追加菜单项
 * 解耦评估：菜单实例来源已环境封装，转发层进一步收敛耦合
 */
import { getSiyuanGlobalMenus } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenus 供资源菜单访问菜单单例 */
export { getSiyuanGlobalMenus };

/**
 * 用途：获取窗口外部宽度
 * 使用范围：判断是否隐藏预览区域
 * 解耦评估：环境读取能力已封装，转发层使业务文件无需感知具体来源
 */
import { getWindowOuterWidth } from "../../../util/siyuanEnvironments/getWindowGeometry.environment";
/** 导出 getWindowOuterWidth 供布局判断 */
export { getWindowOuterWidth };

/**
 * 用途：资源项类型定义
 * 使用范围：资源列表渲染、搜索响应与回调参数类型约束
 * 解耦评估：类型集中在父目录复用，本地转发可避免业务文件直接上跳目录
 */
import type {
    assetItem,
    AssetMenuDestination,
    AssetMenuKeyboardContext,
    AssetMenuOptions,
} from "../protyle.types";
/** 导出资源列表项供 assetMenu 模块类型约束 */
export type {assetItem};
/** 导出资源选择去向供 assetMenu 模块保持对应生命周期 */
export type {AssetMenuDestination};
/** 导出资源选择菜单完整参数 */
export type {AssetMenuOptions};
/** 导出资源菜单键盘生命周期上下文 */
export type {AssetMenuKeyboardContext};
