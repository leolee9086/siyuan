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
import {focusByRange} from "../../protyle/util/selection";

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

/**
 * 用途：DOM元素类型守卫，用于在PDF注释处理中安全地判断Element类型
 * 使用范围：anno模块中DOM操作前进行类型断言，避免运行时类型错误
 * 解耦评估：纯类型守卫函数，作为通用工具直接导入最合理，无需解耦
 */
import { isHTMLElement, isHTMLDivElement } from "../../util/DOM/element.guard";
// 导出isHTMLElement类型守卫
export { isHTMLElement };
// 导出isHTMLDivElement类型守卫
export { isHTMLDivElement };

/**
 * 用途：获取所有编辑器模型实例，用于在PDF注释中访问编辑器状态
 * 使用范围：anno模块需要获取当前打开的编辑器实例以定位文档内容
 * 解耦评估：布局模型是全局单例，无法通过参数传递解耦，必须直接导入
 */
import { getAllModels } from "../../layout/getAll";
// 导出获取所有模型函数
export { getAllModels };

/**
 * 用途：系统常量定义，包含编辑器需要的各种枚举值和配置常量
 * 使用范围：anno模块中需要使用系统级常量进行逻辑判断
 * 解耦评估：常量为纯数据定义，直接导入是最优选择
 */
import { Constants } from "../../constants";
// 导出系统常量
export { Constants };

/**
 * 用途：网络POST请求函数，用于与后端API通信
 * 使用范围：anno模块需要向后端发送请求获取或保存注释数据
 * 解耦评估：网络请求是基础设施，直接导入最合理，替换为参数传递会引入不必要的抽象层
 */
import { fetchPost } from "../../util/network/fetch";
// 导出网络请求函数
export { fetchPost };

/**
 * 用途：安全获取 siyuan.storage 全局存储对象，用于持久化状态和用户偏好
 * 使用范围：click.ts 中读取 PDF 主题颜色等存储配置
 * 解耦评估：存储访问是平台抽象层，直接导入以确保跨平台兼容性
 */
import { getSiyuanStorage } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
// 导出存储访问函数
export { getSiyuanStorage };

/**
 * 用途：设置本地存储值，用于持久化用户偏好和缓存数据
 * 使用范围：anno模块需要保存或读取存储中的配置值
 * 解耦评估：存储操作是平台抽象层的一部分，直接导入以确保跨平台兼容性
 */
import { setStorageVal } from "../../protyle/util/compatibility";
// 导出存储值设置函数
export { setStorageVal };

/**
 * 用途：获取窗口origin，用于构造PDF资源的完整URL路径
 * 使用范围：anno模块中需要构造指向PDF文件的绝对URL时使用
 * 解耦评估：这是浏览器环境抽象层的一部分，必须直接导入以确保跨平台兼容
 */
import { getLocationOrigin } from "../../util/siyuanEnvironments/windowStandard.environment";
// 导出窗口origin获取函数
export { getLocationOrigin };

/**
 * 用途：国际化文案，用于多语言支持的文本展示
 * 使用范围：anno模块中所有面向用户显示的文本
 * 解耦评估：国际化是全局基础设施，直接导入避免重复初始化，无法通过参数合理解耦
 */
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
// 导出国际化文案
export { siyuanI18n };

/**
 * 用途：元素定位工具，用于在窗口中精确设置DOM元素的位置
 * 使用范围：anno模块中弹出面板或提示需要精确定位时使用
 * 解耦评估：DOM定位是通用UI工具，直接导入最合理
 */
import { setPosition } from "../../util/DOM/positioning/setPosition";
// 导出元素定位工具
export { setPosition };

/**
 * 用途：转义用户控制的 HTML 属性值。
 * 使用范围：PDF 标注关联 ID 写入 data-id 属性。
 * 解耦评估：统一 DOM 转义工具可确保所有注释渲染路径使用相同编码规则。
 */
import {escapeAttr} from "../../util/DOM/escape";
// 导出属性转义工具
export {escapeAttr};
/**
 * 用途：转义用户控制的 HTML 文本内容。
 * 使用范围：PDF 标注关联 ID 显示在列表文本节点前。
 * 解耦评估：统一 DOM 转义工具可确保所有注释渲染路径使用相同编码规则。
 */
import { escapeHtml } from "../../util/DOM/escape";
// 导出 HTML 文本转义工具
export { escapeHtml };

/**
 * 用途：按属性查找 PDF 查看器滚动容器。
 * 使用范围：标注高亮后将目标矩形滚动到可见区域。
 * 解耦评估：通过 anno imports 转发，避免高亮 owner 直接跨目录耦合 Protyle DOM helper。
 */
import {hasClosestByAttribute} from "../../protyle/util/hasClosest";
// 导出属性祖先查找工具
export {hasClosestByAttribute};
