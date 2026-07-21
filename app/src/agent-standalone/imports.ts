/** 用途：加载应用基础主题与组件样式；使用范围：独立 Agent 全视口页面；解耦评估：经目录网关收口唯一跨目录样式依赖。 */
import "../assets/scss/base.scss";
/** 用途：转发独立资源脚本加载能力。使用范围：Agent 独立入口启动。解耦评估：稳定无状态工具，经目录网关隔离实现路径。 */
import {loadStandaloneScript} from "../standalone-runtime/assets";
/** 用途：转发独立资源样式加载能力。使用范围：Agent 独立入口启动。解耦评估：稳定无状态工具，经目录网关隔离实现路径。 */
import {loadStandaloneStyle} from "../standalone-runtime/assets";
/** 用途：转发语言字典加载能力。使用范围：Agent 独立入口启动。解耦评估：同源环境协议，经目录网关集中依赖。 */
import {fetchStandaloneLanguage} from "../standalone-runtime/kernel";
/** 用途：转发 Kernel 请求能力。使用范围：Agent 独立入口配置与存储读取。解耦评估：同源环境协议，经目录网关集中依赖。 */
import {postStandaloneKernel} from "../standalone-runtime/kernel";
/** 用途：转发主题属性映射能力。使用范围：Agent 独立入口首帧主题初始化。解耦评估：纯环境工具，经目录网关隔离实现路径。 */
import {applyStandaloneThemeAttributes} from "../standalone-runtime/theme";
/** 用途：转发主题选择能力。使用范围：Agent 独立入口首帧主题初始化。解耦评估：纯环境工具，经目录网关隔离实现路径。 */
import {resolveStandaloneTheme} from "../standalone-runtime/theme";
/** 用途：转发独立入口启动缓存能力。使用范围：Agent bootstrap 并发初始化。解耦评估：通用 Promise 生命周期工具，经目录网关隔离实现路径。 */
import {bootstrapStandaloneOnce} from "../standalone-runtime/bootstrap";
/** 用途：转发面板会话类型；使用范围：独立 ESM 公共导出；解耦评估：type-only 依赖不会使核心在 bootstrap 前求值。 */
import type {AgentPanelConversation} from "../layout/dock/agent/runtime/agentPanel.ports.types";
/** 用途：转发面板句柄类型；使用范围：独立 ESM 公共导出；解耦评估：type-only 依赖不会使核心在 bootstrap 前求值。 */
import type {AgentPanelHandle} from "../layout/dock/agent/runtime/agentPanel.ports.types";
/** 用途：转发面板挂载选项；使用范围：独立 ESM 公共函数参数；解耦评估：type-only 依赖不会使核心在 bootstrap 前求值。 */
import type {AgentPanelMountOptions} from "../layout/dock/agent/runtime/agentPanel.ports.types";

/** 导出脚本加载能力供 Agent 启动流程使用。 */
export {loadStandaloneScript};
/** 导出样式加载能力供 Agent 启动流程使用。 */
export {loadStandaloneStyle};
/** 导出语言加载能力供 Agent 启动流程使用。 */
export {fetchStandaloneLanguage};
/** 导出 Kernel 请求能力供 Agent 启动流程使用。 */
export {postStandaloneKernel};
/** 导出主题属性映射能力供 Agent 启动流程使用。 */
export {applyStandaloneThemeAttributes};
/** 导出主题选择能力供 Agent 启动流程使用。 */
export {resolveStandaloneTheme};
/** 导出启动缓存能力供 Agent bootstrap 使用。 */
export {bootstrapStandaloneOnce};
/** 导出面板会话类型。 */
export type {AgentPanelConversation};
/** 导出面板句柄类型。 */
export type {AgentPanelHandle};
/** 导出面板挂载选项。 */
export type {AgentPanelMountOptions};
