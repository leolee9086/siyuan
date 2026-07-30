import {describe, expect, it} from "vitest";
import {resolveAgentPanelTargetPolicy} from "../../../../../src/layout/dock/agent/runtime/agentPanel.targetPolicy";

describe("resolveAgentPanelTargetPolicy", () => {
    it("keeps native session actions and regeneration", () => {
        expect(resolveAgentPanelTargetPolicy({
            kind: "native-agent",
            nativeTitle: "Agent",
            magiIdentityReady: false,
            magiConversationLoading: false,
        })).toMatchObject({
            sessionActionsVisible: true,
            promptSourceVisible: true,
            regenerationVisible: true,
            sendingAvailable: true,
        });
    });

    it("uses one continuous MAGI timeline without session or retry actions", () => {
        expect(resolveAgentPanelTargetPolicy({
            kind: "magi",
            nativeTitle: "Agent",
            magiIdentityDisplayName: "Guardian A",
            magiIdentityReady: true,
            magiConversationLoading: false,
        })).toMatchObject({
            identityLabel: "Guardian A",
            identityVisible: true,
            sessionActionsVisible: false,
            promptSourceVisible: false,
            regenerationVisible: false,
            sendingAvailable: true,
        });
    });

    it("locks MAGI sending while identity or conversation is pending", () => {
        expect(resolveAgentPanelTargetPolicy({
            kind: "magi",
            nativeTitle: "Agent",
            magiIdentityReady: false,
            magiConversationLoading: false,
        }).sendingAvailable).toBe(false);
        expect(resolveAgentPanelTargetPolicy({
            kind: "magi",
            nativeTitle: "Agent",
            magiIdentityReady: true,
            magiConversationLoading: true,
        }).sendingAvailable).toBe(false);
    });
});
