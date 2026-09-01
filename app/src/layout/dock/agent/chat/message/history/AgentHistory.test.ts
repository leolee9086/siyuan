import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {
    applyAgentUserEdit,
    buildAgentPresentationEntries,
    findAgentUserEntryIndex,
    filterAgentReferencesForContent,
    getAgentThinkingDisplaySeconds,
    hasAgentExecutedToolsAfter,
    hasAgentModelSpecificContext,
    hasAgentThinkingStepDetails,
    isAgentAssistantContentFinalInTurn,
    isAgentRegenerateStateCurrent,
} from "./AgentHistory";

const historyEntries = [
    {id: "user-1", type: "user"},
    {id: "assistant-1", type: "assistant"},
    {id: "user-2", type: "user"},
    {id: "assistant-2", type: "assistant"},
];

/** 验证显式用户标识和默认末尾查找。 */
function testFindAgentUserEntryIndex() {
    assert.equal(findAgentUserEntryIndex(historyEntries, "user-1"), 0);
    assert.equal(findAgentUserEntryIndex(historyEntries, "user-2"), 2);
    assert.equal(findAgentUserEntryIndex(historyEntries), 2);
    assert.equal(findAgentUserEntryIndex(historyEntries, "missing"), -1);
}

/** 验证工具结果、拒绝确认和快照对副作用资格的影响。 */
function testExecutedToolDetection() {
    const completedToolEntries = [
        {id: "user-1", type: "user"},
        {id: "assistant-1", type: "assistant", toolCalls: [{result: "done"}]},
    ];
    const rejectedConfirmationEntries = [
        {id: "user-1", type: "user"},
        {id: "confirm-1", type: "confirm", status: "rejected"},
    ];
    const snapshotEntries = [
        {id: "user-1", type: "user"},
        {id: "snapshot-1", type: "snapshot"},
    ];
    assert.equal(hasAgentExecutedToolsAfter(completedToolEntries, 0), true);
    assert.equal(hasAgentExecutedToolsAfter(rejectedConfirmationEntries, 0), false);
    assert.equal(hasAgentExecutedToolsAfter(snapshotEntries, 0), true);
}

/** 验证会话、修订、流式和镜像锁共同决定请求快照是否有效。 */
function testRegenerateStateIdentity() {
    const request = {sessionID: "session-1", revision: 2};
    assert.equal(isAgentRegenerateStateCurrent(request, {
        sessionID: "session-1", revision: 2, isStreaming: false, mirrorLocked: false,
    }), true);
    assert.equal(isAgentRegenerateStateCurrent(request, {
        sessionID: "session-2", revision: 2, isStreaming: false, mirrorLocked: false,
    }), false);
    assert.equal(isAgentRegenerateStateCurrent(request, {
        sessionID: "session-1", revision: 3, isStreaming: false, mirrorLocked: false,
    }), false);
    assert.equal(isAgentRegenerateStateCurrent(request, {
        sessionID: "session-1", revision: 2, isStreaming: true, mirrorLocked: false,
    }), false);
    assert.equal(isAgentRegenerateStateCurrent(request, {
        sessionID: "session-1", revision: 2, isStreaming: false, mirrorLocked: true,
    }), false);
}

/** 验证编辑正文不再包含的块引用会被移除。 */
function testReferenceFiltering() {
    const references = [
        {id: "block-1", title: "First block"},
        {id: "block-2", title: "Second block"},
    ];
    assert.deepEqual(filterAgentReferencesForContent(references, "Review First block"), [references[0]]);
}

/** 验证富文本编辑、模型上下文和逐轮重新生成边界。 */
function testHistoryMetadataHelpers() {
    const entry = {content: "Old", blockHTML: "<div>Old</div>",
        references: [{id: "old", title: "Old"}]};
    const references = [{id: "new", title: "New"}];
    applyAgentUserEdit(entry, {text: "New", blockHTML: "<div>New</div>", references});
    assert.deepEqual(entry, {content: "New", blockHTML: "<div>New</div>", references});
    assert.notEqual(entry.references, references);
    applyAgentUserEdit(entry, {text: "None", blockHTML: "<div>None</div>", references: []});
    assert.equal(entry.references, undefined);
    assert.equal(getAgentThinkingDisplaySeconds(0.001), 1);
    assert.equal(getAgentThinkingDisplaySeconds(1.5), 2);
    assert.equal(hasAgentThinkingStepDetails({roundID: "round-1", reasoning: "processing"}), false);
    assert.equal(hasAgentThinkingStepDetails({reasoningContent: "reasoning"}), true);
    assert.equal(hasAgentModelSpecificContext([{type: "assistant", toolCalls: [{}]}]), true);
    assert.equal(hasAgentModelSpecificContext([{type: "thinking", steps: [{reasoningContent: "reasoning"}]}]), true);
    const turnEntries = [
        {type: "user", content: "question"},
        {type: "assistant", content: "intermediate"},
        {type: "thinking"},
        {type: "assistant", content: "final"},
    ];
    assert.equal(isAgentAssistantContentFinalInTurn(turnEntries, 1), false);
    assert.equal(isAgentAssistantContentFinalInTurn(turnEntries, 3), true);
}

/** 验证 roundID 驱动正文、问题、待办与快照的稳定呈现顺序。 */
function testRoundAwarePresentation() {
    const display = buildAgentPresentationEntries([
        {id: "user-1", type: "user", content: "work"},
        {id: "snapshot-1", type: "snapshot", roundID: "round-1"},
        {id: "thinking-1", type: "thinking", steps: [{roundID: "round-1",
            reasoningContent: "plan", toolNames: ["todo_write", "question"],
            toolCallIDs: ["call-todo", "call-question"]}]},
        {id: "question-1", type: "question", roundID: "round-1"},
        {id: "assistant-1", type: "assistant", roundID: "round-1", content: "before question",
            toolCalls: [
                {id: "call-todo", name: "todo_write", result: "todo result"},
                {id: "call-question", name: "question"},
            ]},
        {id: "assistant-2", type: "assistant", roundID: "round-2", content: "done"},
    ]);
    assert.deepEqual(display.map((entry) => entry.type), [
        "user", "thinking", "snapshot", "todo", "assistant", "question", "assistant",
    ]);
    assert.equal(display[1]?.steps?.[0]?.roundID, "round-1");
    assert.equal(display[3]?.result, "todo result");
    assert.equal(display[4]?.content, "before question");
    assert.equal(display[4]?.toolCalls?.length, 1);
}

/** 验证缺失思考条目时按 roundID 恢复思考步骤。 */
function testRecoveredRoundPresentation() {
    const display = buildAgentPresentationEntries([
        {id: "user-1", type: "user"},
        {id: "assistant-1", type: "assistant", roundID: "round-1", reasoningContent: "inspect",
            toolCalls: [{id: "call-1", name: "block", result: "ok"}]},
        {id: "assistant-2", type: "assistant", roundID: "round-2", content: "done"},
    ]);
    assert.equal(display[1]?.type, "thinking");
    assert.equal(display[1]?.steps?.[0]?.roundID, "round-1");
    assert.deepEqual(display[1]?.steps?.[0]?.toolCallIDs, ["call-1"]);
}

/** 注册 AgentHistory 的独立行为用例。 */
function registerAgentHistoryTests() {
    it("finds the requested user entry or the latest user entry", testFindAgentUserEntryIndex);
    it("detects executed tools after the selected user entry", testExecutedToolDetection);
    it("rejects regenerate state changed while confirmation is open", testRegenerateStateIdentity);
    it("drops block references removed from edited content", testReferenceFiltering);
    it("preserves rich edits and model metadata helpers", testHistoryMetadataHelpers);
    it("orders round-aware question, todo, and snapshot entries", testRoundAwarePresentation);
    it("recovers missing thinking entries from round metadata", testRecoveredRoundPresentation);
}

describe("AgentHistory", registerAgentHistoryTests);
