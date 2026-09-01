/** 用途：约束组合结果；使用范围：AgentChat 构造阶段；解耦评估：接口保证业务模块只消费抽象端口。 */
import type {AgentChatSessionPorts} from "./imports";
/** 用途：创建显式修订状态；使用范围：repository 端口；解耦评估：状态工厂只在实例组合边界调用。 */
import {createAgentSessionRevisionState} from "./imports";
/** 用途：读取显式修订状态；使用范围：repository 端口；解耦评估：具体读取函数只登记到抽象仓储。 */
import {getAgentSessionRevision} from "./imports";
/** 用途：装配会话列表；使用范围：repository 端口；解耦评估：网络实现只在组合根绑定。 */
import {listAgentSessions} from "./imports";
/** 用途：装配会话加载；使用范围：repository 端口；解耦评估：网络实现只在组合根绑定。 */
import {loadAgentSession} from "./imports";
/** 用途：装配会话保存；使用范围：repository 端口；解耦评估：网络实现只在组合根绑定。 */
import {saveAgentSession} from "./imports";
/** 用途：装配会话删除；使用范围：repository 端口；解耦评估：网络实现只在组合根绑定。 */
import {removeAgentSession} from "./imports";
/** 用途：装配会话重命名；使用范围：repository 端口；解耦评估：命令实现只在组合根绑定。 */
import {renameAgentSession} from "./imports";
/** 用途：装配会话权限切换；使用范围：repository 端口；解耦评估：命令实现只在组合根绑定。 */
import {setAgentSessionPermission} from "./imports";
/** 用途：校验会话标识；使用范围：repository 端口；解耦评估：领域校验通过仓储能力暴露。 */
import {createAgentSessionID} from "./imports";
/** 用途：装配目录资格查询；使用范围：taskDirectories 端口；解耦评估：网络实现只在组合根绑定。 */
import {canBindAgentTaskDirectories} from "./imports";
/** 用途：装配目录摘要查询；使用范围：taskDirectories 端口；解耦评估：网络实现只在组合根绑定。 */
import {listAgentTaskDirectories} from "./imports";
/** 用途：装配主目录绑定；使用范围：taskDirectories 端口；解耦评估：命令实现只在组合根绑定。 */
import {bindAgentTaskDirectory} from "./imports";
/** 用途：绑定文件浏览根内目录；使用范围：Agent 新建任务。 */
import {bindFileBrowserAgentTaskDirectory} from "./imports";
/** 用途：装配附加目录绑定；使用范围：taskDirectories 端口；解耦评估：命令实现只在组合根绑定。 */
import {addAgentTaskDirectory} from "./imports";
/** 用途：装配目录解除；使用范围：taskDirectories 端口；解耦评估：命令实现只在组合根绑定。 */
import {unbindAgentTaskDirectory} from "./imports";
/** 用途：装配提示词来源读取；使用范围：promptSources 端口；解耦评估：仓储实现只在组合根绑定。 */
import {getAgentPromptSource} from "./imports";
/** 用途：装配提示词来源搜索；使用范围：promptSources 端口；解耦评估：仓储实现只在组合根绑定。 */
import {searchAgentPromptSourceDocuments} from "./imports";
/** 用途：装配提示词来源解析；使用范围：promptSources 端口；解耦评估：仓储实现只在组合根绑定。 */
import {resolveAgentPromptSourceDocument} from "./imports";
/** 用途：装配提示词来源绑定；使用范围：promptSources 端口；解耦评估：命令实现只在组合根绑定。 */
import {bindAgentPromptSourceDocument} from "./imports";
/** 用途：装配提示词来源刷新；使用范围：promptSources 端口；解耦评估：命令实现只在组合根绑定。 */
import {refreshAgentPromptSourceDocument} from "./imports";
/** 用途：装配提示词快照保持；使用范围：promptSources 端口；解耦评估：命令实现只在组合根绑定。 */
import {keepAgentPromptSourceDocument} from "./imports";
/** 用途：装配提示词文档创建；使用范围：promptSources 端口；解耦评估：命令实现只在组合根绑定。 */
import {createAgentPromptSourceDocument} from "./imports";
/** 用途：装配附件上传；使用范围：uploadFiles 端口；解耦评估：网络实现只在组合根绑定。 */
import {uploadAgentFiles} from "./imports";
/** 用途：生成显式身份请求头；使用范围：全部 Agent 请求；解耦评估：纯生成器接收每次读取的身份值。 */
import {createAgentRequestHeaders} from "./imports";
/** 用途：约束请求头输入；使用范围：组合根请求函数；解耦评估：纯类型不加载请求实现。 */
import type {AgentRequestHeaderInput} from "./imports";
/** 用途：提供会话条目构建；使用范围：projection 端口；解耦评估：具体函数仅在本组合根登记。 */
import {buildEntriesFromSession} from "./imports";
/** 用途：提供会话消息渲染；使用范围：projection 端口；解耦评估：具体函数仅在本组合根登记。 */
import {renderLoadedSession} from "./imports";
/** 用途：提供网页引用清理；使用范围：projection 端口；解耦评估：具体函数仅在本组合根登记。 */
import {resetWebReferenceIndex} from "./imports";
/** 用途：提供当前模型读取；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {getSelectedModel} from "./imports";
/** 用途：提供会话模型应用；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {applySessionModelIfValid} from "./imports";
/** 用途：提供令牌展示刷新；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {updateTokenDisplay} from "./imports";
/** 用途：提供错误卡片呈现；使用范围：presentation 端口；解耦评估：错误视图仅在组合根登记。 */
import {appendError} from "./imports";
/** 用途：提供贴底观察目标更新；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {observeStickTarget} from "./imports";
/** 用途：提供导航重建；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {rebuildNavMarkers} from "./imports";
/** 用途：提供消息贴底；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {scrollToBottom} from "./imports";
/** 用途：提供距底位置恢复；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {restoreScrollToBottom} from "./imports";
/** 用途：提供欢迎页呈现；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {showWelcome} from "./imports";
/** 用途：提供能力可见性同步；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {applyConversationCapabilityVisibility} from "./imports";
/** 用途：提供发送按钮刷新；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {updateSendButtonState} from "./imports";
/** 用途：提供镜像占位显示；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {showMirrorPlaceholder} from "./imports";
/** 用途：提供镜像占位移除；使用范围：presentation 端口；解耦评估：具体函数仅在本组合根登记。 */
import {removeMirrorPlaceholder} from "./imports";
/** 用途：提供流式状态更新；使用范围：turnLifecycle 端口；解耦评估：具体函数仅在本组合根登记。 */
import {setStreaming} from "./imports";
/** 用途：提供活动思考收尾；使用范围：turnLifecycle 端口；解耦评估：具体函数仅在本组合根登记。 */
import {finishActiveThinking} from "./imports";
/** 用途：提供思考步骤提交；使用范围：turnLifecycle 端口；解耦评估：具体函数仅在本组合根登记。 */
import {flushThinkingStep} from "./imports";
/** 用途：提供编辑草稿恢复；使用范围：turnLifecycle 端口；解耦评估：具体函数仅在本组合根登记。 */
import {restorePendingEditDraft} from "./imports";
/** 用途：读取当前 MAGI 身份；使用范围：magiConversation 端口；解耦评估：身份具体实现仅在本组合根访问。 */
import {getActiveMagiArmorSession} from "./imports";
/** 用途：加载当前 MAGI 历史；使用范围：magiConversation 端口；解耦评估：会话具体实现仅在本组合根访问。 */
import {loadMagiMainUIConversation} from "./imports";

/** 读取当前 MAGI 身份的最小公开快照。 */
function readActiveMagiIdentity() {
    const identity = getActiveMagiArmorSession();
    const ready = identity?.routeClass === "guardian" && identity.channel === "magi-main-ui";
    return {ready, identityId: ready ? identity.identityId : ""};
}

/** 按已确认的身份标识加载 MAGI 历史，拒绝身份切换后的迟到请求。 */
async function loadMagiConversation(identityId: string, signal: AbortSignal) {
    const identity = getActiveMagiArmorSession();
    const current = identity?.routeClass === "guardian" && identity.channel === "magi-main-ui" &&
        identity.identityId === identityId;
    if (!current) {
        throw new Error("MAGI identity changed before conversation loading");
    }
    return loadMagiMainUIConversation({session: identity, signal});
}

/** 读取当前 MAGI guardian 身份携带的 owner token。 */
function readAgentOwnerToken() {
    const identity = getActiveMagiArmorSession();
    if (identity?.routeClass !== "guardian" || identity.channel !== "magi-main-ui") {
        return "";
    }
    return identity.armorToken;
}

/** 每次请求时读取当前身份并生成请求头，不保存模块作用域 provider。 */
function buildAgentChatRequestHeaders(input?: AgentRequestHeaderInput) {
    const ownerToken = readAgentOwnerToken();
    return createAgentRequestHeaders(ownerToken, input);
}

/** 组合会话仓储实现，并把修订状态限定在当前 AgentChat 实例。 */
function createSessionRepository(
    revisionState: AgentChatSessionPorts["repository"]["revisionState"],
    requestHeaders: AgentChatSessionPorts["requestHeaders"],
    generateID: () => string,
) {
    const newSessionId = createAgentSessionID.bind(null, generateID);
    return {
        revisionState,
        list: listAgentSessions.bind(null, requestHeaders),
        load: loadAgentSession.bind(null, revisionState, requestHeaders),
        save: saveAgentSession.bind(null, revisionState, requestHeaders),
        remove: removeAgentSession.bind(null, revisionState, requestHeaders),
        rename: renameAgentSession.bind(null, revisionState, requestHeaders),
        setPermission: setAgentSessionPermission.bind(null, requestHeaders),
        getRevision: getAgentSessionRevision.bind(null, revisionState),
        newSessionId,
    } satisfies AgentChatSessionPorts["repository"];
}

/** 组合任务目录仓储，直接保留领域接口已经定义的命令参数。 */
function createTaskDirectoryRepository(requestHeaders: AgentChatSessionPorts["requestHeaders"]) {
    return {
        canBindTaskDirectories: canBindAgentTaskDirectories.bind(null, requestHeaders),
        listTaskDirectories: listAgentTaskDirectories.bind(null, requestHeaders),
        bindTaskDirectory: bindAgentTaskDirectory.bind(null, requestHeaders),
        bindFileBrowserTaskDirectory: bindFileBrowserAgentTaskDirectory.bind(null, requestHeaders),
        addTaskDirectory: addAgentTaskDirectory.bind(null, requestHeaders),
        unbindTaskDirectory: unbindAgentTaskDirectory.bind(null, requestHeaders),
    } satisfies AgentChatSessionPorts["taskDirectories"];
}

/** 组合提示词来源仓储，使全部修订命令共享当前实例的修订状态。 */
function createPromptSourceRepository(
    revisionState: AgentChatSessionPorts["repository"]["revisionState"],
    requestHeaders: AgentChatSessionPorts["requestHeaders"],
) {
    return {
        getPromptSource: getAgentPromptSource.bind(null, revisionState, requestHeaders),
        searchPromptSourceDocuments: searchAgentPromptSourceDocuments.bind(null, requestHeaders),
        resolvePromptSourceDocument: resolveAgentPromptSourceDocument.bind(null, requestHeaders),
        bindPromptSourceDocument: bindAgentPromptSourceDocument.bind(null, revisionState, requestHeaders),
        refreshPromptSourceDocument: refreshAgentPromptSourceDocument.bind(null, revisionState, requestHeaders),
        keepPromptSourceDocument: keepAgentPromptSourceDocument.bind(null, revisionState, requestHeaders),
        createPromptSourceDocument: createAgentPromptSourceDocument.bind(null, requestHeaders),
    } satisfies AgentChatSessionPorts["promptSources"];
}

/** 组合持久化会话到聊天条目的确定投影能力。 */
function createSessionProjection(newSessionId: AgentChatSessionPorts["repository"]["newSessionId"]) {
    return {
        buildEntries: buildEntriesFromSession.bind(null, newSessionId),
        render: renderLoadedSession,
        resetWebReferences: resetWebReferenceIndex,
    } satisfies AgentChatSessionPorts["projection"];
}

/** 组合会话状态机可调用的全部同步界面命令。 */
function createSessionPresentation() {
    return {
        getSelectedModel,
        applySessionModel: applySessionModelIfValid,
        updateTokenDisplay,
        observeStickTarget,
        rebuildNavigation: rebuildNavMarkers,
        scrollToBottom,
        restoreScrollBottom: restoreScrollToBottom,
        showWelcome,
        appendError,
        applyConversationCapabilities: applyConversationCapabilityVisibility,
        updateSendButton: updateSendButtonState,
        showMirror: showMirrorPlaceholder,
        removeMirror: removeMirrorPlaceholder,
    } satisfies AgentChatSessionPorts["presentation"];
}

/** 组合活动轮次结束和草稿恢复命令。 */
function createTurnLifecycle() {
    return {
        setStreaming,
        finishThinking: finishActiveThinking,
        flushThinkingStep,
        restorePendingEditDraft,
    } satisfies AgentChatSessionPorts["turnLifecycle"];
}

/** 组合 MAGI 身份观察与历史加载能力。 */
function createMagiConversation() {
    return {
        readActiveIdentity: readActiveMagiIdentity,
        loadConversation: loadMagiConversation,
    } satisfies AgentChatSessionPorts["magiConversation"];
}

/**
 * 装配 AgentChat 会话领域依赖，具体实现仅在此组合边界出现。
 * @同步豁免: 生命周期 - AgentChat 构造必须在任何会话初始化前同步取得完整端口集合。
 */
export function createAgentChatSessionPorts(generateID: () => string = Lute.NewNodeID) {
    const revisionState = createAgentSessionRevisionState();
    const repository = createSessionRepository(revisionState, buildAgentChatRequestHeaders, generateID);
    return {
        repository,
        taskDirectories: createTaskDirectoryRepository(buildAgentChatRequestHeaders),
        promptSources: createPromptSourceRepository(revisionState, buildAgentChatRequestHeaders),
        uploadFiles: uploadAgentFiles.bind(null, buildAgentChatRequestHeaders),
        requestHeaders: buildAgentChatRequestHeaders,
        projection: createSessionProjection(repository.newSessionId),
        presentation: createSessionPresentation(),
        turnLifecycle: createTurnLifecycle(),
        magiConversation: createMagiConversation(),
    } satisfies AgentChatSessionPorts;
}
