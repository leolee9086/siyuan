import {afterEach, describe, expect, it, vi} from "vitest";
import {loadMagiMainUIConversation} from "../../../src/magi/conversation/magiMainUIConversation";
import type {MagiArmorSession} from "../../../src/magi/service/magiIdentitySession";

const session: MagiArmorSession = {
    armorToken: "TOKEN",
    expiresAt: Date.now() + 60_000,
    identityId: "identity-a",
    displayName: "Alice",
    nickname: "alice",
    routeClass: "guardian",
    channel: "magi-main-ui",
};

describe("loadMagiMainUIConversation", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("calls the default browser fetch with its Window receiver", async () => {
        const windowLike = {
            fetch(this: unknown) {
                if (this !== windowLike) {
                    throw new TypeError("Illegal invocation");
                }
                return Promise.resolve(new Response(JSON.stringify({
                    conversationId: "conversation-a",
                    messages: [],
                    hasMore: false,
                }), {status: 200}));
            },
        };
        vi.stubGlobal("window", windowLike);

        const history = await loadMagiMainUIConversation({session});

        expect(history.conversationId).toBe("conversation-a");
    });

    it("joins channel history pages in chronological order", async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                conversationId: "conversation-a",
                messages: [{id: "3", role: "user", content: "new", createdAt: 30}],
                hasMore: true,
                oldestAt: 30,
            }), {status: 200}))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                conversationId: "conversation-a",
                messages: [
                    {id: "1", role: "user", content: "old", createdAt: 10},
                    {id: "2", role: "assistant", content: "answer", createdAt: 20},
                ],
                hasMore: false,
                oldestAt: 10,
            }), {status: 200}));

        const history = await loadMagiMainUIConversation({session, fetchImpl});

        expect(history.messages.map((message) => message.id)).toEqual(["1", "2", "3"]);
        expect(fetchImpl).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
            body: JSON.stringify({before: 30, limit: 200}),
        }));
    });

    it("reports a conversation change instead of combining identities", async () => {
        const fetchImpl = vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({
                conversationId: "conversation-a", messages: [], hasMore: true, oldestAt: 30,
            }), {status: 200}))
            .mockResolvedValueOnce(new Response(JSON.stringify({
                conversationId: "conversation-b", messages: [], hasMore: false,
            }), {status: 200}));

        await expect(loadMagiMainUIConversation({session, fetchImpl})).rejects.toThrow(
            "MAGI history conversation changed during pagination",
        );
    });
});
