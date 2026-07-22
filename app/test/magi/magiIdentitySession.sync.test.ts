import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

type BroadcastHandler = ((event: MessageEvent) => void) | null;

class FakeBroadcastChannel {
    static channels = new Map<string, Set<FakeBroadcastChannel>>();

    onmessage: BroadcastHandler = null;

    constructor(readonly name: string) {
        const peers = FakeBroadcastChannel.channels.get(name) ?? new Set<FakeBroadcastChannel>();
        peers.add(this);
        FakeBroadcastChannel.channels.set(name, peers);
    }

    postMessage(data: unknown): void {
        const clonedData = structuredClone(data);
        for (const peer of FakeBroadcastChannel.channels.get(this.name) ?? []) {
            if (peer === this) {
                continue;
            }
            queueMicrotask(() => peer.onmessage?.({data: clonedData} as MessageEvent));
        }
    }

    close(): void {
        FakeBroadcastChannel.channels.get(this.name)?.delete(this);
    }

    static reset(): void {
        for (const peers of FakeBroadcastChannel.channels.values()) {
            for (const peer of peers) {
                peer.close();
            }
        }
        FakeBroadcastChannel.channels.clear();
    }
}

async function flushBroadcasts(): Promise<void> {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
}

describe("MAGI armor session cross-window synchronization", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.resetModules();
        FakeBroadcastChannel.reset();
        const eventTarget = new EventTarget();
        vi.stubGlobal("BroadcastChannel", FakeBroadcastChannel);
        vi.stubGlobal("window", {
            addEventListener: eventTarget.addEventListener.bind(eventTarget),
            removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
            dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
            setTimeout,
            clearTimeout,
        });
    });

    afterEach(() => {
        FakeBroadcastChannel.reset();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it("shares login and logout between independent renderer module instances", async () => {
        const firstWindow = await import("../../src/magi/service/magiIdentitySession");
        firstWindow.setActiveMagiArmorSession({
            armorToken: "magi_ak_v1_guardian",
            expiresAt: Date.now() + 60_000,
            identityId: "guardian-owner",
            displayName: "Guardian Owner",
            routeClass: "guardian",
            channel: "magi-main-ui",
            nickname: "owner",
        });

        vi.resetModules();
        const secondWindow = await import("../../src/magi/service/magiIdentitySession");
        await flushBroadcasts();

        expect(secondWindow.getActiveMagiArmorSession()).toMatchObject({
            armorToken: "magi_ak_v1_guardian",
            identityId: "guardian-owner",
            routeClass: "guardian",
            channel: "magi-main-ui",
        });

        secondWindow.clearActiveMagiArmorSession();
        await flushBroadcasts();
        expect(firstWindow.getActiveMagiArmorSession()).toBeNull();
    });
});
