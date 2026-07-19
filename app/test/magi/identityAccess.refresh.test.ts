import {beforeEach, describe, expect, it, vi} from "vitest";

const identityServices = vi.hoisted(() => ({
    fetchMagiIdentityStats: vi.fn(),
    refreshMagiIdentities: vi.fn(),
}));

vi.mock("../../src/magi/identity-access/controller/imports", () => identityServices);

import {createIdentityAccessSessionActions} from "../../src/magi/identity-access/controller/IdentityAccessPanel.session";

type IdentityAccessSessionPanel = Parameters<typeof createIdentityAccessSessionActions>[0];

/** 创建刷新动作所需的最小面板状态。 */
function createPanel() {
    return {
        loading: {value: false},
        statusText: {value: ""},
        stats: {value: null},
        loginForm: {identityId: ""},
        state: {identities: []},
    } as unknown as IdentityAccessSessionPanel;
}

describe("Identity Access refresh coalescing", () => {
    beforeEach(() => {
        identityServices.fetchMagiIdentityStats.mockReset();
        identityServices.refreshMagiIdentities.mockReset();
    });

    it("keeps only one refresh in flight during standalone startup broadcasts", async () => {
        const pendingIdentities = Promise.withResolvers<void>();
        identityServices.refreshMagiIdentities.mockReturnValue(pendingIdentities.promise);
        identityServices.fetchMagiIdentityStats.mockResolvedValue({
            totalIdentities: 0,
            enabledCount: 0,
            totalUsage: 0,
            identities: [],
        });
        const actions = createIdentityAccessSessionActions(createPanel());

        const initialRefresh = actions.onRefresh();
        const broadcastRefresh = actions.onRefresh();

        expect(identityServices.refreshMagiIdentities).toHaveBeenCalledOnce();
        pendingIdentities.resolve();
        await Promise.all([initialRefresh, broadcastRefresh]);
        expect(identityServices.fetchMagiIdentityStats).toHaveBeenCalledOnce();
    });
});
