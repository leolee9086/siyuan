/** 用途：Tree 更新后调用统一公式渲染；使用范围：Tree 具体实现；解耦评估：公式渲染属于既有 Protyle 输出协议，由宿主注入会泄漏内部渲染步骤。 */
import {mathRender} from "../../../protyle/render/mathRender";
/** 用途：Tree 事件从子元素定位列表项；使用范围：Tree 事件模块；解耦评估：共享无状态 DOM 查询是唯一实现，注入会扩大 Tree 配置而不增加可替换性。 */
import {hasClosestByTag} from "../../../protyle/util/hasClosest";
/** 用途：Tree 事件收窄任意 DOM Element；使用范围：Tree 事件模块；解耦评估：共享无状态守卫可直接复用，重复实现会造成边界分叉。 */
import {isElement} from "../../DOM/element.guard";
/** 用途：Tree 公开入口收窄 HTMLElement；使用范围：Tree 实现与事件模块；解耦评估：共享无状态守卫可直接复用，不需要宿主提供。 */
import {isHTMLElement} from "../../DOM/element.guard";
/** 用途：Tree 项和块项选择统一图标；使用范围：Tree 渲染模块；解耦评估：图标规则是编辑器共享表现协议，参数化会把其所有权错误转移给每个 Tree 宿主。 */
import {getIconByType} from "../../../editor/getIcon";
/** 用途：Tree 文档块渲染 emoji；使用范围：Tree 渲染模块；解耦评估：统一编码转换必须复用生态实现，局部注入或复制会产生不一致输出。 */
import {unicode2Emoji} from "../../../emoji/emoji.render";
/** 用途：Tree 读取本地图标存储键；使用范围：Tree 渲染模块；解耦评估：常量属于应用存储协议且无运行时状态，不适合通过构造参数重复传递。 */
import {Constants} from "../../../constants";
/** 用途：Tree aria-label 转义；使用范围：Tree 渲染模块；解耦评估：安全转义边界必须保持唯一实现，由宿主注入会允许产生不一致或未转义输出。 */
import {escapeAriaLabel} from "../../DOM/escape";
/** 用途：Tree 标题 HTML 转义；使用范围：大纲序号渲染；解耦评估：共享转义边界应保持唯一实现。 */
import {escapeHtml} from "../../DOM/escape";
/** 用途：判断大纲序号后是否需要间距；使用范围：Tree 大纲序号渲染；解耦评估：标题编号判定属于共享表现协议。 */
import {headingNumberNeedsSpacing} from "../../../protyle/util/headingNumberCore";
/** 用途：Tree 保留移动端与桌面端布局差异；使用范围：Tree 渲染模块；解耦评估：这是现有统一平台状态读取，额外参数会造成检测结果和传入值分叉。 */
import {isMobile} from "../../platform/functions";
/** 用途：Tree 完整公共领域根；使用范围：tree 子域实现模块。 */
import type {TreeDomain} from "../tree.types";
/** 用途：Tree 完整构造配置；使用范围：tree 子域实现模块。 */
import type {TreeOptions} from "../tree.types";
/** 用途：Tree 内核块渲染投影；使用范围：渲染与守卫模块。 */
import type {TreeBlockData} from "../tree.types";
/** 用途：Tree 完整递归输入数据；使用范围：实现与渲染模块。 */
import type {TreeNodeData} from "../tree.types";
/** 用途：Tree 块载荷校验的官方兼容基底；使用范围：Tree 块守卫。 */
import type {IBlock} from "siyuan";

/** Tree 子域公式渲染依赖。 */
export {mathRender};
/** Tree 子域列表项定位依赖。 */
export {hasClosestByTag};
/** Tree 子域通用 Element 守卫。 */
export {isElement};
/** Tree 子域 HTMLElement 守卫。 */
export {isHTMLElement};
/** Tree 子域节点图标解析依赖。 */
export {getIconByType};
/** Tree 子域 emoji 渲染依赖。 */
export {unicode2Emoji};
/** Tree 子域共享常量依赖。 */
export {Constants};
/** Tree 子域可访问文本转义依赖。 */
export {escapeAriaLabel};
/** Tree 子域标题 HTML 转义依赖。 */
export {escapeHtml};
/** Tree 子域大纲序号间距判定依赖。 */
export {headingNumberNeedsSpacing};
/** Tree 子域平台检测依赖。 */
export {isMobile};
/** Tree 子域完整公共抽象。 */
export type {TreeDomain};
/** Tree 子域完整构造配置。 */
export type {TreeOptions};
/** Tree 子域内核块渲染投影。 */
export type {TreeBlockData};
/** Tree 子域完整递归输入数据。 */
export type {TreeNodeData};
/** Tree 子域官方块兼容基底。 */
export type {IBlock};
