import {beforeEach, describe, expect, it, vi} from "vitest";

const network = vi.hoisted(() => ({fetchSyncPost: vi.fn()}));

vi.mock("../../../src/sforge/fileBrowser/repository/imports", () => ({
    fetchSyncPost: network.fetchSyncPost,
}));

const provider = "windows-smb-mount";
const sessionAddress = {kind: "provider-session" as const, provider, session: "session-a"};
const resourceAddress = {
    kind: "provider-resource" as const,
    provider,
    session: "session-a",
    resource: "share-video",
};
const descriptor = {
    id: provider,
    displayName: "Windows SMB shares",
    kind: "file-share",
    sessionMode: "automatic",
    sessionLabel: "当前 Windows 会话",
    capabilities: ["list", "stat", "open"],
};

function resource(id: string, name: string, drive: string) {
    return {
        provider,
        session: "session-a",
        id,
        name,
        kind: "file-share",
        readOnly: true,
        capabilities: ["list", "stat", "open"],
        source: {name: "192.168.31.195", kind: "smb-host"},
        aliases: [{kind: "mapped-drive", label: drive}],
    };
}

describe("file browser provider repository", () => {
    beforeEach(() => vi.clearAllMocks());

    it("opens the mapped SMB session and keeps its two shares as distinct resources", async () => {
        network.fetchSyncPost
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                provider, session: "session-a", readOnly: true, descriptor,
            }})
            .mockResolvedValueOnce({code: 0, msg: "", data: {
                resources: [resource("share-video", "视频素材", "N:"), resource("share-work", "工作文件", "O:")],
                total: 2, limit: 100, hasMore: false,
            }});
        const {openFileBrowserProviderSession, listFileBrowserProviderResources} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.repository"
        );

        const session = await openFileBrowserProviderSession({provider, endpoint: "mapped", readOnly: true});
        const page = await listFileBrowserProviderResources(session.address, {limit: 100});

        expect(session.address).toEqual(sessionAddress);
        expect(page.resources.map(item => ({name: item.name, address: item.address, aliases: item.aliases}))).toEqual([
            {name: "视频素材", address: {...resourceAddress, resource: "share-video"},
                aliases: [{kind: "mapped-drive", label: "N:"}]},
            {name: "工作文件", address: {...resourceAddress, resource: "share-work"},
                aliases: [{kind: "mapped-drive", label: "O:"}]},
        ]);
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            1, "/api/s-forge/file-browser/provider/session/open", {provider, endpoint: "mapped", readOnly: true},
        );
        expect(network.fetchSyncPost).toHaveBeenNthCalledWith(
            2, "/api/s-forge/file-browser/provider/resources", {provider, session: "session-a", page: {limit: 100}},
        );
    });

    it("blocks unsafe HTTP before network and only sends explicit private-network confirmation", async () => {
        const {openFileBrowserProviderSession} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.repository"
        );

        await expect(openFileBrowserProviderSession({
            provider: "webdav",
            endpoint: "http://127.0.0.1:8080/dav",
            credentials: {username: "tester", password: "secret"},
        })).rejects.toThrow("请显式确认");
        await expect(openFileBrowserProviderSession({
            provider: "s3",
            endpoint: "http://8.8.8.8:9000",
            insecureHTTPConfirmed: true,
            credentials: {accessKey: "access", secretKey: "secret"},
        })).rejects.toThrow("私网或链路本地");
        expect(network.fetchSyncPost).not.toHaveBeenCalled();

        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: {
            provider: "webdav",
            session: "session-private",
            readOnly: false,
            descriptor: {
                id: "webdav", displayName: "WebDAV", kind: "file-share", sessionMode: "configured",
                sessionLabel: "WebDAV 会话",
                sessionConfig: {
                    readOnly: true,
                    endpointTransport: "https-or-confirmed-private-http",
                    fields: [
                        {target: "endpoint", key: "endpoint", label: "WebDAV 地址",
                            input: "url", required: true, placeholder: "https://dav.example.com/files",
                            autocomplete: "url"},
                        {target: "credential", key: "username", label: "用户名",
                            input: "text", autocomplete: "username"},
                        {target: "credential", key: "password", label: "密码",
                            input: "password", requiredWith: ["username"], autocomplete: "current-password"},
                    ],
                },
                capabilities: ["list"],
            },
        }});
        const request = {
            provider: "webdav",
            endpoint: "http://192.168.1.20:8080/dav",
            insecureHTTPConfirmed: true as const,
            credentials: {username: "tester", password: "secret"},
        };
        await openFileBrowserProviderSession(request);
        expect(network.fetchSyncPost).toHaveBeenCalledWith(
            "/api/s-forge/file-browser/provider/session/open",
            request,
        );
    });

    it("does not send an insecure transport confirmation for HTTPS", async () => {
        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: {
            provider: "s3",
            session: "session-https",
            readOnly: true,
            descriptor: {
                id: "s3", displayName: "S3", kind: "object-store", sessionMode: "configured",
                sessionLabel: "对象存储会话",
                sessionConfig: {
                    readOnly: true,
                    endpointTransport: "https-or-confirmed-private-http",
                    fields: [
                        {target: "endpoint", key: "endpoint", label: "S3 地址",
                            input: "url", required: true, placeholder: "https://s3.example.com",
                            autocomplete: "url"},
                        {target: "option", key: "region", label: "区域",
                            input: "text", defaultValue: "us-east-1", placeholder: "us-east-1"},
                        {target: "option", key: "bucket", label: "Bucket",
                            input: "text", placeholder: "留空以列出全部 Bucket"},
                        {target: "option", key: "pathStyle", label: "使用 Path-style 地址",
                            input: "checkbox"},
                        {target: "credential", key: "accessKey", label: "Access Key",
                            input: "text", required: true, autocomplete: "username"},
                        {target: "credential", key: "secretKey", label: "Secret Key",
                            input: "password", required: true, autocomplete: "current-password"},
                    ],
                },
                capabilities: ["list"],
            },
        }});
        const {openFileBrowserProviderSession} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.repository"
        );
        const request = {
            provider: "s3",
            endpoint: "https://s3.example.test",
            insecureHTTPConfirmed: true as const,
            readOnly: true,
        };

        await openFileBrowserProviderSession(request);

        expect(network.fetchSyncPost).toHaveBeenCalledWith(
            "/api/s-forge/file-browser/provider/session/open",
            {provider: "s3", endpoint: "https://s3.example.test", readOnly: true},
        );
        expect(request.insecureHTTPConfirmed).toBe(true);
    });

    it("composes opaque entry addresses from the request resource and validates content URLs", async () => {
        network.fetchSyncPost.mockResolvedValue({code: 0, msg: "", data: {
            entries: [{
                id: "token-file",
                name: "cover.svg",
                kind: "file",
                isDir: false,
                size: 42,
                modified: 100,
                created: 90,
                extension: ".svg",
                mediaType: "image/svg+xml",
                revision: {etag: "etag-1", size: 42},
                address: {provider, token: "token-file", name: "cover.svg"},
                previewKind: "image",
                contentURL: "/api/s-forge/file-browser/provider/content?provider=windows-smb-mount&session=session-a&resource=share-video&token=token-file",
            }],
            total: 1,
            totalKnown: true,
            limit: 200,
            hasMore: false,
        }});
        const {listFileBrowserProviderDirectory} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.repository"
        );

        const page = await listFileBrowserProviderDirectory({
            parent: resourceAddress,
            page: {limit: 200},
            sortBy: "updated",
            sortDirection: "desc",
            directoriesFirst: true,
        });

        expect(page.entries[0]?.address).toEqual({
            kind: "provider-entry", provider, session: "session-a", resource: "share-video", token: "token-file",
        });
        expect(network.fetchSyncPost).toHaveBeenCalledWith("/api/s-forge/file-browser/provider/list", {
            provider, session: "session-a", resource: "share-video",
            page: {limit: 200}, sort: [{field: "modified", desc: true}], directoriesFirst: true,
        });
    });

    it("rejects cross-session resources and source identity fields", async () => {
        const {listFileBrowserProviderResources} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.repository"
        );
        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: {
            resources: [{...resource("share-video", "视频素材", "N:"), session: "session-other"}],
            total: 1, limit: 100, hasMore: false,
        }});
        await expect(listFileBrowserProviderResources(sessionAddress, {limit: 100}))
            .rejects.toThrow("文件 provider 资源响应格式错误");

        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: {
            resources: [{...resource("share-video", "视频素材", "N:"), source: {
                id: "host:192.168.31.195",
                name: "192.168.31.195",
                kind: "smb-host",
                fingerprint: "192.168.31.195",
            }}],
            total: 1, limit: 100, hasMore: false,
        }});
        await expect(listFileBrowserProviderResources(sessionAddress, {limit: 100}))
            .rejects.toThrow("文件 provider 资源响应格式错误");
    });

    it("keeps equal display names from different providers in independent sessions", async () => {
        const {parseFileBrowserProviderResourcePage} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.guards"
        );
        const smbPage = parseFileBrowserProviderResourcePage({
            resources: [resource("share-video", "视频素材", "N:")], total: 1, limit: 10, hasMore: false,
        }, sessionAddress, {limit: 10});
        const dsmSession = {
            kind: "provider-session" as const,
            provider: "synology-file-station",
            session: "session-a",
        };
        const dsmPage = parseFileBrowserProviderResourcePage({
            resources: [{
                provider: "synology-file-station", session: "session-a", id: "share-video", name: "视频素材",
                kind: "file-share", readOnly: true, capabilities: ["list"],
                source: {name: "192.168.31.195", kind: "smb-host"},
            }], total: 1, limit: 10, hasMore: false,
        }, dsmSession, {limit: 10});

        expect(smbPage.resources[0]?.address).not.toEqual(dsmPage.resources[0]?.address);
        expect([smbPage.resources[0], dsmPage.resources[0]]).toHaveLength(2);
    });

    it("propagates failed envelopes and verifies session close acknowledgement", async () => {
        const {closeFileBrowserProviderSession, listFileBrowserProviders} = await import(
            "../../../src/sforge/fileBrowser/FileBrowser.provider.repository"
        );
        network.fetchSyncPost.mockResolvedValueOnce({code: 502, msg: "SMB enumeration failed"});
        await expect(listFileBrowserProviders()).rejects.toThrow("SMB enumeration failed");

        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: {
            provider, session: "session-other", closed: true,
        }});
        await expect(closeFileBrowserProviderSession(sessionAddress))
            .rejects.toThrow("关闭文件 provider 会话响应格式错误");

        network.fetchSyncPost.mockResolvedValueOnce({code: 0, msg: "", data: {
            provider, session: "session-a", closed: true,
        }});
        await expect(closeFileBrowserProviderSession(sessionAddress)).resolves.toBeUndefined();
    });
});
