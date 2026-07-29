import assert from "node:assert/strict";
import {describe, it} from "node:test";
import type {AgentChat} from "../../../../src/layout/dock/agent/AgentChat";
import type {AgentChatDomain} from "../../../../src/layout/dock/agent/AgentChat.types";
import type {AppFacade} from "../../../../src/app/AppFacade.types";
import type {Tab} from "../../../../src/layout/Tab";
import type {
    IsAssignable,
    PublicInstance,
    PublicInstanceLooksLike,
    StrictEqual,
} from "../../../../src/util/types/LooksLike.types";

type AgentChatPublicSurface = PublicInstance<typeof AgentChat>;
type AbstractAgentChatDomain = AgentChatDomain<AppFacade | undefined, Tab>;
interface ConcreteAgentChatDomain extends Omit<AbstractAgentChatDomain, "createFloatingCopy"> {
    createFloatingCopy(tab: Tab): Promise<AgentChat>;
}
type AgentChatContract = PublicInstanceLooksLike<typeof AgentChat, ConcreteAgentChatDomain>;
type AgentChatKeyContract = StrictEqual<keyof AgentChatPublicSurface, keyof ConcreteAgentChatDomain>;
type AgentChatImplementationContract = IsAssignable<AgentChatPublicSurface, ConcreteAgentChatDomain>;
type AgentChatAbstractionContract = IsAssignable<ConcreteAgentChatDomain, AgentChatPublicSurface>;
type AgentChatAbstractSurfaceContract = IsAssignable<AgentChatPublicSurface, AbstractAgentChatDomain>;
type AgentChatFloatingCopySelfContract = StrictEqual<
    Awaited<ReturnType<AbstractAgentChatDomain["createFloatingCopy"]>>,
    AbstractAgentChatDomain
>;
const agentChatContract: AgentChatContract = true;
const agentChatKeyContract: AgentChatKeyContract = true;
const agentChatImplementationContract: AgentChatImplementationContract = true;
const agentChatAbstractionContract: AgentChatAbstractionContract = true;
const agentChatAbstractSurfaceContract: AgentChatAbstractSurfaceContract = true;
const agentChatFloatingCopySelfContract: AgentChatFloatingCopySelfContract = true;

describe("AgentChat domain contract", () => {
    it("matches the complete public panel surface", () => {
        assert.equal(agentChatContract, true);
        assert.equal(agentChatKeyContract, true);
        assert.equal(agentChatImplementationContract, true);
        assert.equal(agentChatAbstractionContract, true);
        assert.equal(agentChatAbstractSurfaceContract, true);
        assert.equal(agentChatFloatingCopySelfContract, true);
    });
});
