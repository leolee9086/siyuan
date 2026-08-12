import {describe, expect, it} from "vitest";
import {
    applyFileBrowserProviderResourcePage,
    createFileBrowserProviderSessionNode,
    reconcileFileBrowserProviders,
} from "../../../src/sforge/fileBrowser/FileBrowser.provider.tree";
import type {
    FileBrowserProviderDescriptor,
    FileBrowserProviderResourcePage,
    FileBrowserProviderSession,
} from "../../../src/sforge/fileBrowser/FileBrowser.types";

const sharedDescriptor = {
    displayName: "同名文件服务",
    kind: "file-share",
    sessionMode: "automatic",
    sessionLabel: "同名会话",
    capabilities: ["list"],
} as const;

function descriptor(id: string): FileBrowserProviderDescriptor {
    return {...sharedDescriptor, id, capabilities: [...sharedDescriptor.capabilities]};
}

function session(value: FileBrowserProviderDescriptor): FileBrowserProviderSession {
    return {
        address: {kind: "provider-session", provider: value.id, session: "same-session"},
        readOnly: true,
        descriptor: value,
    };
}

function resourcePage(provider: string): FileBrowserProviderResourcePage {
    return {
        resources: [{
            id: "same-resource",
            name: "视频素材",
            kind: "file-share",
            readOnly: true,
            capabilities: ["list"],
            source: {name: "192.168.31.195", kind: "endpoint", metadata: {label: "same"}},
            address: {
                kind: "provider-resource",
                provider,
                session: "same-session",
                resource: "same-resource",
            },
        }],
        total: 1,
        limit: 100,
        hasMore: false,
    };
}

describe("FileBrowser provider tree identity", () => {
    it("keeps equal-valued providers in independent tree namespaces", () => {
        const descriptors = [descriptor("windows-smb-mount"), descriptor("synology-file-station")];
        const roots = reconcileFileBrowserProviders([], descriptors);
        expect(roots).toHaveLength(2);
        const [smbRoot, dsmRoot] = roots;
        const [smbDescriptor, dsmDescriptor] = descriptors;
        if (!smbRoot || !dsmRoot || !smbDescriptor || !dsmDescriptor) {
            throw new Error("expected two provider roots");
        }
        expect(smbRoot.key).not.toBe(dsmRoot.key);

        const smbSession = createFileBrowserProviderSessionNode(smbRoot, session(smbDescriptor));
        const dsmSession = createFileBrowserProviderSessionNode(dsmRoot, session(dsmDescriptor));
        applyFileBrowserProviderResourcePage(smbSession, resourcePage(smbDescriptor.id), false);
        applyFileBrowserProviderResourcePage(dsmSession, resourcePage(dsmDescriptor.id), false);

        expect(smbSession.key).not.toBe(dsmSession.key);
        expect(smbSession.children[0]?.key).not.toBe(dsmSession.children[0]?.key);
        expect([smbSession.children[0]?.name, dsmSession.children[0]?.name]).toEqual(["视频素材", "视频素材"]);
    });
});
