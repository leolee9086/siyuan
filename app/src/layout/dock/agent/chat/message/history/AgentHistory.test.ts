import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {
    findAgentUserEntryIndex,
    filterAgentReferencesForContent,
    hasAgentExecutedToolsAfter,
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

/** 注册 AgentHistory 的四个独立行为用例。 */
function registerAgentHistoryTests() {
    it("finds the requested user entry or the latest user entry", testFindAgentUserEntryIndex);
    it("detects executed tools after the selected user entry", testExecutedToolDetection);
    it("rejects regenerate state changed while confirmation is open", testRegenerateStateIdentity);
    it("drops block references removed from edited content", testReferenceFiltering);
}

describe("AgentHistory", registerAgentHistoryTests);
