/** 用途：约束初始化读写状态；使用范围：AgentChat 构造阶段；解耦评估：纯运行时协议避免初始化模块依赖具体门面。 */
import type {AgentChatRuntime} from "./imports";
/** 用途：初始化消息导航轨；使用范围：消息容器建立后；解耦评估：既有 UI 工厂由目录网关隔离具体实现。 */
import {initNavRail} from "./imports";
/** 用途：绑定初始化 DOM 引用；使用范围：面板模板写入后；解耦评估：同职责模块的命名步骤由初始化编排器直接调用最清晰。 */
import {bindAgentChatElements} from "./AgentChat.init.helpers";
/** 用途：创建会话面板；使用范围：Composer 挂载后；解耦评估：同职责模块的命名步骤由初始化编排器直接调用最清晰。 */
import {createAgentChatSessionPanel} from "./AgentChat.init.helpers";
/** 用途：投影消息滚动状态；使用范围：消息容器 scroll 监听；解耦评估：事件只显式传入 runtime，不持有全局状态。 */
import {handleAgentChatScroll} from "./AgentChat.init.helpers";
/** 用途：挂载 Composer；使用范围：模型选择器初始化后；解耦评估：同职责模块拥有编辑器生命周期，编排器只触发步骤。 */
import {mountAgentChatComposer} from "./AgentChat.init.helpers";
/** 用途：观察布局可见性；使用范围：初始化末尾；解耦评估：观察器工厂由 helper 所有，编排器不读取实现细节。 */
import {observeAgentChatLayout} from "./AgentChat.init.helpers";
/** 用途：同步建立面板模板；使用范围：初始化第一步；解耦评估：构造阶段必须先建立 DOM，事件化会引入无意义的时序竞争。 */
import {renderAgentChatPanel} from "./AgentChat.init.helpers";
/** 用途：查询已建立的消息区；使用范围：导航轨初始化；解耦评估：统一守卫集中处理缺失节点错误。 */
import {requireElement} from "./imports";
/** 用途：初始化模型选择；使用范围：DOM 引用绑定后；解耦评估：既有模型职责经网关复用。 */
import {initModelSelect} from "./imports";
/** 用途：启动会话恢复；使用范围：初始化异步阶段；解耦评估：会话仓储副作用保留在既有生命周期模块。 */
import {initSessions} from "./imports";
/** 用途：绑定 delivery 与 queue dock；使用范围：相关 DOM 引用建立后；解耦评估：控件模块只消费统一 controller 能力。 */
import {bindAgentConversationControls} from "./imports";

/**
 * 依次完成面板 DOM、编辑器、会话和布局观察器初始化。
 * @同步豁免: UI构建 - AgentChat 构造器紧接着绑定事件，必须在返回前建立全部 DOM 引用；会话加载仍通过 initialization 异步承载。
 */
export function initUI(runtime: AgentChatRuntime) {
    const panel = runtime.parent.panelElement;
    renderAgentChatPanel(panel);
    bindAgentChatElements(runtime, panel);
    runtime.messagesContainer.addEventListener("scroll", () => handleAgentChatScroll(runtime), {passive: true});
    initNavRail(runtime, requireElement<HTMLElement>(panel, ".agent-chat__messages-wrap"));
    initModelSelect(runtime);
    mountAgentChatComposer(runtime);
    createAgentChatSessionPanel(runtime);
    bindAgentConversationControls(runtime);
    runtime.initialization = initSessions(runtime);
    observeAgentChatLayout(runtime);
}
