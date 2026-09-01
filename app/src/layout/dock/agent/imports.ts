/** 用途：提供 Agent 布局宿主；使用范围：门面和浮窗模型；解耦评估：框架模型必须保留真实 Tab 身份。 */
import {Tab} from "../../Tab";
/** 用途：提供布局模型基类；使用范围：AgentChat 门面；解耦评估：继承协议由布局反序列化器固定。 */
import {Model} from "../../Model";
/** 用途：约束完整应用能力；使用范围：门面和 Composer；解耦评估：纯类型依赖。 */
import type {AppFacade} from "../../../app/AppFacade.types";
/** 用途：生成连接标识；使用范围：AgentChat WebSocket 初始化；解耦评估：纯平台标识生成器。 */
import {genUUID} from "../../../util/platform/genID";
/** 用途：创建聊天 Markdown 渲染器；使用范围：AgentChat 初始化；解耦评估：渲染器由宿主统一配置。 */
import {getAgentLute} from "../../../protyle/render/setLute";
/** 用途：监听 MAGI 身份变化；使用范围：AgentChat 生命周期；解耦评估：全局事件是现有身份边界。 */
import {MAGI_IDENTITY_SESSION_CHANGED_EVENT} from "../../../magi/service/magiIdentitySession";
/** 用途：提供平台常量；使用范围：Composer 拖放与编辑器初始化；解耦评估：只读平台协议。 */
import {Constants} from "../../../constants";
/** 用途：转义 Composer 内容；使用范围：编辑器渲染；解耦评估：纯字符串函数。 */
import {escapeHtml} from "../../../util/DOM/escape";
/** 用途：发送编辑器请求；使用范围：Protyle Composer；解耦评估：复用统一网络入口。 */
import {fetchPost} from "../../../util/network/fetch";
/** 用途：解析块引用提示；使用范围：Protyle Composer；解耦评估：编辑器协议由 Protyle 提供。 */
import {hintRef} from "../../../protyle/hint/extend.hintRef";
/** 用途：创建空块元素；使用范围：Protyle Composer；解耦评估：复用编辑器 DOM 工厂。 */
import {genEmptyElement} from "../../../block/element.factory";
/** 用途：渲染块内容；使用范围：Protyle Composer；解耦评估：复用编辑器渲染生命周期。 */
import {blockRender} from "../../../protyle/render/blockRender";
/** 用途：聚焦指定块或回退编辑器整体聚焦；使用范围：Protyle Composer toEnd 聚焦协议；解耦评估：复用编辑器选择工具。 */
import {focusBlock} from "../../../protyle/util/selection";
/** 用途：匹配可配置发送快捷键；使用范围：Composer 发送分派；解耦评估：键位协议由平台热键模块统一解释。 */
import {matchHotKey} from "../../../protyle/util/hotKey";
/** 用途：读取块类型图标；使用范围：Tiptap Composer；解耦评估：纯展示映射。 */
import {getIconByType} from "../../../editor/getIcon";
/** 用途：创建项目标准菜单并约束其状态；使用范围：Tiptap Composer 建议菜单；解耦评估：复用统一定位和生命周期，不再维护自建遮罩层。 */
import {createProtyleMenu, type Menu, MenuItem} from "../../../menus/Menu";
/** 用途：提供 Tiptap 编辑器核心类；使用范围：Tiptap Composer 实例化与类型；解耦评估：编辑器运行时必须随宿主实例化，无法改为参数注入。 */
import {Editor} from "@tiptap/core";
/** 用途：提供 Tiptap 扩展集合与 JSON 内容类型；使用范围：Tiptap Composer 工厂和内容插入；解耦评估：纯类型依赖，无运行时耦合。 */
import type {Extensions, JSONContent} from "@tiptap/core";
/** 用途：提供 ProseMirror 节点类型；使用范围：Tiptap 发送数据投影；解耦评估：纯类型依赖，无运行时耦合。 */
import type {Node} from "@tiptap/pm/model";
/** 用途：复用 Tiptap 建议系统公开回调类型；使用范围：Composer @ 菜单适配；解耦评估：纯类型依赖，无运行时耦合。 */
import type {SuggestionKeyDownProps, SuggestionProps} from "@tiptap/suggestion";
/** 用途：提供 Tiptap 文档节点定义；使用范围：Tiptap Composer 扩展；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import Document from "@tiptap/extension-document";
/** 用途：提供 Tiptap 段落节点定义；使用范围：Tiptap Composer 扩展；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import Paragraph from "@tiptap/extension-paragraph";
/** 用途：提供 Tiptap 文本节点定义；使用范围：Tiptap Composer 扩展；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import Text from "@tiptap/extension-text";
/** 用途：提供 Tiptap 换行节点定义；使用范围：Tiptap Composer 扩展；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import HardBreak from "@tiptap/extension-hard-break";
/** 用途：提供 Tiptap @ 提及节点与建议系统；使用范围：Tiptap Composer 引用输入；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import Mention from "@tiptap/extension-mention";
/** 用途：提供 Tiptap 占位符提示扩展；使用范围：Tiptap Composer 空内容提示；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import {Placeholder} from "@tiptap/extension-placeholder";
/** 用途：提供 Tiptap 撤销/重做历史扩展；使用范围：Tiptap Composer 编辑历史；解耦评估：编辑器协议的一部分，必须随编辑器实例化。 */
import {History} from "@tiptap/extension-history";

/** 导出布局宿主。 */
export {Tab};
/** 导出布局模型基类。 */
export {Model};
/** 导出应用能力类型。 */
export type {AppFacade};
/** 导出连接标识生成器。 */
export {genUUID};
/** 导出聊天渲染器工厂。 */
export {getAgentLute};
/** 导出 MAGI 身份事件名。 */
export {MAGI_IDENTITY_SESSION_CHANGED_EVENT};
/** 导出平台常量。 */
export {Constants};
/** 导出 HTML 转义函数。 */
export {escapeHtml};
/** 导出网络请求入口。 */
export {fetchPost};
/** 导出块引用提示函数。 */
export {hintRef};
/** 导出空块工厂。 */
export {genEmptyElement};
/** 导出块渲染函数。 */
export {blockRender};
/** 导出块聚焦工具。 */
export {focusBlock};
/** 导出快捷键匹配工具。 */
export {matchHotKey};
/** 导出块图标映射。 */
export {getIconByType};
/** 导出标准菜单工厂。 */
export {createProtyleMenu};
/** 导出标准菜单类型。 */
export type {Menu};
/** 导出标准菜单项。 */
export {MenuItem};
/** 导出 Tiptap 编辑器核心类。 */
export {Editor};
/** 导出 Tiptap JSON 内容类型。 */
export type {JSONContent};
/** 导出 Tiptap 扩展集合类型。 */
export type {Extensions};
/** 导出 ProseMirror 节点类型。 */
export type {Node};
/** 导出 Tiptap 建议键盘回调类型。 */
export type {SuggestionKeyDownProps};
/** 导出 Tiptap 建议渲染属性类型。 */
export type {SuggestionProps};
/** 导出 Tiptap 文档节点定义。 */
export {Document};
/** 导出 Tiptap 段落节点定义。 */
export {Paragraph};
/** 导出 Tiptap 文本节点定义。 */
export {Text};
/** 导出 Tiptap 换行节点定义。 */
export {HardBreak};
/** 导出 Tiptap @ 提及节点与建议系统。 */
export {Mention};
/** 导出 Tiptap 占位符提示扩展。 */
export {Placeholder};
/** 导出 Tiptap 撤销/重做历史扩展。 */
export {History};
