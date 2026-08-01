import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {AgentChat} from "../../../../src/layout/dock/agent/AgentChat";
import type {AgentChatDomain} from "../../../../src/layout/dock/agent/runtime/public/AgentChat.types";
import type {AppFacade} from "../../../../src/app/AppFacade.types";
import type {Tab} from "../../../../src/layout/Tab";
import type {
    IsAssignable,
    PublicInstance,
    StrictEqual,
} from "../../../../src/util/types/LooksLike.types";

type AgentChatPublicSurface = PublicInstance<typeof AgentChat>;
type AbstractAgentChatDomain = AgentChatDomain<AppFacade | undefined, Tab>;
interface ConcreteAgentChatDomain extends Omit<AbstractAgentChatDomain, "createFloatingCopy"> {
    createFloatingCopy(tab: Tab): Promise<AgentChat>;
}
type AgentChatContract = IsAssignable<AgentChatPublicSurface, ConcreteAgentChatDomain>;
type AgentChatAbstractSurfaceContract = IsAssignable<AgentChatPublicSurface, AbstractAgentChatDomain>;
type AgentChatFloatingCopySelfContract = StrictEqual<
    Awaited<ReturnType<AbstractAgentChatDomain["createFloatingCopy"]>>,
    AbstractAgentChatDomain
>;
const agentChatContract: AgentChatContract = true;
const agentChatAbstractSurfaceContract: AgentChatAbstractSurfaceContract = true;
const agentChatFloatingCopySelfContract: AgentChatFloatingCopySelfContract = true;

describe("AgentChat domain contract", () => {
    it("covers the complete public panel abstraction while exposing observable runtime state", () => {
        assert.equal(agentChatContract, true);
        assert.equal(agentChatAbstractSurfaceContract, true);
        assert.equal(agentChatFloatingCopySelfContract, true);
    });
});
