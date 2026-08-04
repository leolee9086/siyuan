/** 用途：约束生命周期流程读写的聊天状态；使用范围：本目录全部流程。 */
import type {AgentChatRuntime} from "../../AgentChat.runtime.types";
/** 导出聊天运行时契约。 */
export type {AgentChatRuntime};

/** 用途：约束公开会话切换输入；使用范围：生命周期门面。 */
import type {AgentPanelConversation} from "../../../runtime/agentPanel.ports.types";
/** 导出面板会话协议。 */
export type {AgentPanelConversation};


/** 用途：挂载输入编辑器；使用范围：面板初始化。 */
import {mountComposer} from "../../../AgentComposer";
/** 导出编辑器挂载函数。 */
export {mountComposer};

/** 用途：创建提示词来源控制器；使用范围：面板元素绑定。 */
import {createAgentPromptSourceController} from "../../../prompt/AgentPromptSource.factory";
/** 导出提示词来源控制器工厂。 */
export {createAgentPromptSourceController};

/** 用途：创建会话列表控制器；使用范围：面板初始化。 */
import {createAgentSessionPanelController} from "../../../session-panel/controller";
/** 导出会话列表控制器工厂。 */
export {createAgentSessionPanelController};

/** 用途：生成快捷键提示；使用范围：标题栏渲染。 */
import {updateHotkeyAfterTip} from "../../../../../../protyle/util/compatibility";
/** 导出快捷键提示函数。 */
export {updateHotkeyAfterTip};

/** 用途：转义标题栏文案；使用范围：面板 HTML 渲染。 */
import {escapeHtml} from "../../../../../../util/DOM/escape";
/** 导出 HTML 转义函数。 */
export {escapeHtml};

/** 用途：读取必备 DOM 元素；使用范围：面板元素绑定。 */
import {requireElement} from "../AgentChat.dom.guard";
/** 导出必备元素守卫。 */
export {requireElement};

/** 用途：读取已初始化配置；使用范围：标题栏与模型刷新。 */
import {requireSiyuanConfig} from "../../AgentChat.environment";
/** 导出配置读取函数。 */
export {requireSiyuanConfig};

/** 用途：读取当前语言资源；使用范围：面板 HTML 渲染。 */
import {getAgentChatLanguages} from "../../AgentChat.environment";
/** 导出语言资源读取函数。 */
export {getAgentChatLanguages};

/** 用途：监听 MAGI 身份变化；使用范围：生命周期释放。 */
import {MAGI_IDENTITY_SESSION_CHANGED_EVENT} from "../../../../../../magi/service/magiIdentitySession";
/** 导出 MAGI 身份事件名。 */
export {MAGI_IDENTITY_SESSION_CHANGED_EVENT};

/** 用途：读取当前 MAGI 身份；使用范围：身份按钮刷新。 */
import {getActiveMagiArmorSession} from "../../../../../../magi/service/magiIdentitySession";
/** 导出 MAGI 身份读取函数。 */
export {getActiveMagiArmorSession};

/** 用途：创建新会话；使用范围：生命周期门面。 */
import {createSession} from "../../session/lifecycle/AgentChat.manage.methods";
/** 导出会话创建命令。 */
export {createSession};
/** 用途：删除会话；使用范围：会话面板回调。 */
import {deleteSession} from "../../session/lifecycle/AgentChat.manage.methods";
/** 导出会话删除命令。 */
export {deleteSession};
/** 用途：初始化会话；使用范围：面板初始化。 */
import {initSessions} from "../../session/lifecycle/AgentChat.session";
/** 导出会话初始化命令。 */
export {initSessions};
/** 用途：绑定统一投递和 queue dock；使用范围：AgentChat 初始化；解耦评估：生命周期组合根只调用 UI 绑定入口，不读取队列 DOM 或 adapter 实现。 */
import {bindAgentConversationControls} from "../queue/AgentChat.queueDock";
/** 导出会话控制绑定入口。 */
export {bindAgentConversationControls};
/** 用途：按当前目标注册状态同步执行控制器；使用范围：目标或恢复会话切换；解耦评估：生命周期门面只调用组合根入口，不读取 adapter 实现。 */
import {syncAgentChatConversationController} from "../../runtime/AgentChat.conversationController";
/** 导出执行控制器同步入口。 */
export {syncAgentChatConversationController};
/** 用途：加载 MAGI 历史；使用范围：会话目标刷新。 */
import {loadMagiIdentityConversation} from "../../session/lifecycle/AgentChat.magi";
/** 导出 MAGI 历史加载命令。 */
export {loadMagiIdentityConversation};

/** 用途：切换会话；使用范围：会话面板与公开门面。 */
import {switchSession} from "../../session/switching/AgentChat.switch";
/** 导出会话切换命令。 */
export {switchSession};
/** 用途：加载浮窗会话；使用范围：生命周期门面。 */
import {loadSessionForFloating} from "../../session/switching/AgentChat.sessionLoad";
/** 导出浮窗会话加载命令。 */
export {loadSessionForFloating};

/** 用途：持久化当前会话；使用范围：生命周期门面。 */
import {saveSession} from "../../session/persistence/AgentChat.save";
/** 导出会话保存命令。 */
export {saveSession};

/** 用途：保证当前会话已持久化；使用范围：提示词与文件操作。 */
import {ensureCurrentSessionPersisted} from "../../session/files/AgentChat.files";
/** 导出会话持久化保证命令。 */
export {ensureCurrentSessionPersisted};
/** 用途：报告会话文件错误；使用范围：会话面板回调。 */
import {reportSessionFileError} from "../../session/files/AgentChat.fileOperation";
/** 导出文件错误报告命令。 */
export {reportSessionFileError};

/** 用途：计算当前目标策略；使用范围：界面能力同步。 */
import {resolveTargetPolicy} from "../model/AgentChat.targetPolicy";
/** 导出目标策略计算函数。 */
export {resolveTargetPolicy};
/** 用途：初始化推理强度选项；使用范围：面板元素绑定。 */
import {initReasoningEffortSelect} from "../model/AgentChat.model.methods";
/** 导出推理强度初始化函数。 */
export {initReasoningEffortSelect};
/** 用途：刷新模型选项；使用范围：配置变化。 */
import {refreshModelOptions} from "../model/AgentChat.model.methods";
/** 导出模型选项刷新函数。 */
export {refreshModelOptions};
/** 用途：计算模型配置签名；使用范围：配置变化检测。 */
import {getUsableModelSignature} from "../model/AgentChat.modelSignature";
/** 导出模型配置签名函数。 */
export {getUsableModelSignature};

/** 用途：挂载独立宿主拖放；使用范围：编辑器初始化。 */
import {bindComposerDragDrop} from "../composer/AgentChat.composer";
/** 导出编辑器拖放绑定命令。 */
export {bindComposerDragDrop};
/** 用途：初始化模型选择器；使用范围：面板初始化。 */
import {initModelSelect} from "../composer/AgentChat.composer";
/** 导出模型选择器初始化命令。 */
export {initModelSelect};

/** 用途：初始化消息导航轨道；使用范围：面板初始化。 */
import {initNavRail} from "../navigation/AgentChat.navigation";
/** 导出导航初始化命令。 */
export {initNavRail};
/** 用途：同步活动导航标记；使用范围：消息滚动事件。 */
import {updateActiveMarker} from "../navigation/AgentChat.navigation";
/** 导出活动标记更新命令。 */
export {updateActiveMarker};

/** 用途：发送当前草稿；使用范围：编辑器挂载回调。 */
import {sendMessage} from "../../message/sending/AgentChat.send.methods";
/** 导出消息发送命令。 */
export {sendMessage};

/** 用途：刷新发送按钮；使用范围：编辑器与目标状态变化。 */
import {updateSendButtonState} from "../feedback/AgentChat.streamingState";
/** 导出发送按钮状态更新命令。 */
export {updateSendButtonState};
/** 用途：恢复会话滚动位置；使用范围：Dock 重新可见。 */
import {restoreScrollToBottom} from "../feedback/AgentChat.scrolling";
/** 导出滚动位置恢复命令。 */
export {restoreScrollToBottom};
/** 用途：创建尺寸观察器；使用范围：Dock 布局可见性跟踪；解耦评估：生命周期只依赖工厂函数，不直接实例化浏览器对象。 */
import {createAgentChatResizeObserver} from "../feedback/AgentChat.observer.factory";
/** 导出尺寸观察器工厂。 */
export {createAgentChatResizeObserver};
/** 用途：停止思考刷新；使用范围：生命周期释放。 */
import {stopThinkingUpdates} from "../feedback/AgentChat.thinkingState";
/** 导出思考刷新停止命令。 */
export {stopThinkingUpdates};

/** 用途：关闭令牌明细弹窗；使用范围：生命周期释放。 */
import {closeTokenBreakdownPopup} from "../../interaction/metrics/AgentChat.metrics.methods";
/** 导出令牌明细关闭命令。 */
export {closeTokenBreakdownPopup};

/** 用途：展示欢迎界面；使用范围：目标能力同步。 */
import {showWelcome} from "../welcome/AgentChat.welcome.methods";
/** 导出欢迎界面命令。 */
export {showWelcome};
