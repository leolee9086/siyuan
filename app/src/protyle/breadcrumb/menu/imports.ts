/**
 * 面包屑菜单模块外部依赖转发
 * 集中管理父级目录导入，便于依赖追踪和解耦
 */

/*
 * 用途：发送异步 POST 请求到后端 API
 * 使用范围：资源转换、上传CDN、分享到链滴、只读模式、全宽模式等菜单项的后端交互
 * 解耦评估：网络请求基础设施，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { fetchPost } from "../../../util/network/fetch";
/*
 * 用途：提供全局常量配置
 * 使用范围：只读模式和全宽模式菜单项中使用自定义属性常量
 * 解耦评估：全局配置，可通过配置注入解耦，但作为全局常量直接导入更合理
 */
import { Constants } from "../../../constants";
/*
 * 用途：菜单类，用于创建和管理菜单容器
 * 使用范围：所有菜单项辅助函数的参数类型和菜单项追加操作
 * 解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
 */
import { Menu } from "../../../menus/Menu";
/*
 * 用途：菜单项类，用于创建菜单项
 * 使用范围：所有菜单项辅助函数中创建具体的菜单项实例
 * 解耦评估：核心业务类，可通过接口抽象解耦，但作为模块核心依赖直接导入更合理
 */
import { MenuItem } from "../../../menus/Menu.Item";
/*
 * 用途：将网络资源转换为本地资源
 * 使用范围：资源转换菜单项中执行网络图片和网络资源的本地化操作
 * 解耦评估：业务逻辑函数，可通过参数传递解耦，但作为protyle核心功能直接导入更合理
 */
import { net2LocalAssets } from "../action";
/*
 * 用途：检查用户是否需要订阅（未订阅会弹出订阅提示）
 * 使用范围：上传资源到CDN菜单项中，在执行上传前检查订阅状态
 * 解耦评估：订阅状态检查是平台级功能，可通过依赖注入或事件机制解耦，
 * 但作为全局权限检查直接导入更合理
 */
import { needSubscribe } from "../../../util/platform/needSubscribe";
/*
 * 用途：显示确认对话框
 * 使用范围：上传资源到CDN和分享到链滴菜单项中，在执行敏感操作前请求用户确认
 * 解耦评估：UI操作函数，可通过事件机制解耦，但作为全局UI基础设施直接导入更合理
 */
import { confirmDialog } from "../../../dialog/confirmDialog";
/*
 * 用途：获取云服务 URL
 * 使用范围：分享到链滴菜单项中构建确认提示信息
 * 解耦评估：配置访问函数，可通过依赖注入解耦，但作为全局配置直接导入更合理
 */
import { getCloudURL } from "../../../config/util/about";
/*
 * 用途：在编辑器中打开文件
 * 使用范围：导出预览菜单项中打开预览页签
 * 解耦评估：编辑器核心功能，可通过依赖注入解耦，但作为全局编辑器操作直接导入更合理
 */
import { openFile } from "../../../editor/util";
/*
 * 用途：导出预览页签类型常量
 * 使用范围：导出预览菜单项中指定页签类型
 * 解耦评估：常量定义，无需解耦
 */
import { EXPORT_PREVIEW_TAB_TYPE } from "../../../export-preview/constants";
/*
 * 用途：获取国际化文本
 * 使用范围：所有菜单项的标签和提示信息本地化
 * 解耦评估：全局i18n服务，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/*
 * 用途：获取思源全局配置
 * 使用范围：菜单项辅助函数中获取快捷键配置
 * 解耦评估：全局配置访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/*
 * 用途：检查是否有思源用户登录
 * 使用范围：分享到链滴菜单项中判断是否显示该选项
 * 解耦评估：用户状态检查函数，可通过依赖注入解耦，但作为全局用户状态直接导入更合理
 */
import { hasSiyuanUser } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/*
 * 用途：判断当前是否为移动端环境
 * 使用范围：面包屑菜单显示逻辑中判断是否使用全屏模式和popup模式
 * 解耦评估：平台检测函数，可通过依赖注入解耦，但作为全局平台判断直接导入更合理
 */
import { isMobile } from "../../../platform";
/*
 * 用途：查找最近的块级元素
 * 使用范围：面包屑菜单显示时获取当前光标所在块的ID
 * 解耦评估：DOM工具函数，可通过参数传递解耦，但作为protyle核心工具直接导入更合理
 */
import { hasClosestBlock } from "../../util/hasClosest";
/*
 * 用途：查找最近的指定类名的祖先元素
 * 使用范围：面包屑菜单显示时判断是否在popover中，用于设置菜单来源属性
 * 解耦评估：DOM工具函数，可通过参数传递解耦，但作为protyle核心工具直接导入更合理
 */
import { hasTopClosestByClassName } from "../../util/hasClosest";
/*
 * 用途：获取编辑器当前选区范围
 * 使用范围：面包屑菜单显示时获取光标位置以确定当前块ID
 * 解耦评估：编辑器工具函数，可通过参数传递解耦，但作为protyle核心工具直接导入更合理
 */
import { getEditorRange } from "../../util/selection";
/*
 * 用途：触发插件菜单打开事件
 * 使用范围：面包屑菜单构建时通知插件系统添加自定义菜单项
 * 解耦评估：事件发射函数，已经是解耦的事件机制实现，直接导入合理
 */
import { emitOpenMenu } from "../../../plugin/EventBus";
/*
 * 用途：获取思源菜单系统实例
 * 使用范围：面包屑菜单显示和构建时获取全局Menu实例
 * 解耦评估：全局菜单系统访问器，可通过依赖注入解耦，但作为全局基础设施直接导入更合理
 */
import { getSiyuanMenus } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/*
 * 用途：录音器上下文类型定义
 * 使用范围：面包屑菜单显示函数的参数类型标注
 * 解耦评估：类型定义，无需解耦
 */
import type { 录音器上下文 } from "../breadcrumb.types";

// 网络请求工具导出
export { fetchPost };
// 常量导出
export { Constants };
// 菜单类导出
export { Menu };
// 菜单项类导出
export { MenuItem };
// Protyle 操作导出
export { net2LocalAssets };
// 平台功能导出
export { needSubscribe };
// Dialog 工具导出
export { confirmDialog };
// 配置工具导出
export { getCloudURL };
// 编辑器工具导出
export { openFile };
// 常量导出
export { EXPORT_PREVIEW_TAB_TYPE };
// 环境工具导出
export { siyuanI18n };
// 环境配置访问器导出
export { getSiyuanConfig };
// 环境状态访问器导出
export { hasSiyuanUser };
// 平台检测导出
export { isMobile };
// DOM工具 - 查找最近块级元素
export { hasClosestBlock };
// DOM工具 - 查找最近指定类名祖先元素
export { hasTopClosestByClassName };
// 编辑器工具 - 获取选区范围
export { getEditorRange };
// 插件事件 - 触发菜单打开事件
export { emitOpenMenu };
// 菜单系统访问器
export { getSiyuanMenus };
// 类型导出 - 录音器上下文
export type { 录音器上下文 };
