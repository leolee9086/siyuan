/**
 * anno模块的外部依赖转发文件
 * 
 * 用途：集中管理anno模块对外部模块的依赖，避免直接使用../导入
 * 使用范围：anno模块内所有需要引用父级目录模块的文件
 */

/**
 * 用途：Range聚焦功能，用于在PDF注释选区处理时设置浏览器焦点
 * 使用范围：getHightlightCoordsByRange中处理跨页选区时需要聚焦到克隆的Range
 * 解耦评估：依赖DOM操作和Selection API，无法通过参数传递解耦，必须直接调用以确保选区正确聚焦
 */
import { focusByRange } from "../../ai/imports";

/**
 * 用途：查找最近的具有指定className的祖先元素，用于定位Range所在的PDF页面元素
 * 使用范围：getRangePageInfo中通过Range的startContainer和endContainer查找所在页面
 * 解耦评估：这是纯DOM遍历工具函数，理论上可通过参数传递Element查找逻辑，但会增加复杂度且无实际收益
 */
import { hasClosestByClassName } from "../../protyle/util/hasClosest";

/**
 * 用途：获取当前窗口的Selection对象，用于获取用户在PDF中选中的文本范围
 * 使用范围：getHightlightCoordsByRange入口处获取用户选区
 * 解耦评估：这是浏览器环境抽象层，用于跨平台兼容，无法解耦，必须通过环境工具统一访问
 */
import { getWindowSelection } from "../../util/siyuanEnvironments/windowStandard.environment";

/**
 * 用途：合并Range的多个DOMRect为连续的矩形区域，用于优化高亮区域的坐标计算
 * 使用范围：processPageSelection中处理选区矩形时合并相邻矩形
 * 解耦评估：纯几何计算工具函数，理论上可通过参数传递，但作为通用DOM工具，直接导入更符合职责分离原则
 */
import { mergeRects } from "../../util/DOM/selection/mergeRects";

/**
 * 用途：处理Range内容，提取选中的文本内容
 * 使用范围：getHightlightCoordsByRange中获取用户选中的文本作为注释内容
 * 解耦评估：纯DOM Range处理工具，理论上可通过参数传递，但作为通用工具直接导入更清晰
 */
import { processRangeContents } from "../../util/DOM/selection/rangeOperations";

// 导出AI模块功能
export { focusByRange };

// 导出Protyle工具
export { hasClosestByClassName };

// 导出环境工具
export { getWindowSelection };

// 导出DOM工具
export { mergeRects };

// 导出Range操作工具
export { processRangeContents };
