const assert = require("node:assert/strict");
const test = require("node:test");
const {
    UI_HOST_INSPECT_WINDOWS,
    UI_HOST_TOKEN_HEADER,
} = require("../scripts/forge-ui-host-contract");
const {
    createElectronWindowInspectHandler,
    createForgeUIHostControl,
    inspectElectronWindows,
} = require("../electron/forge-ui-host-control");

const fetchHost = (descriptor, path, init = {}) => fetch(`${descriptor.controlURL}${path}`, {
    ...init,
    headers: {
        [UI_HOST_TOKEN_HEADER]: descriptor.token,
        ...init.headers,
    },
});

test("UI Host control is loopback-only, token-authenticated, and capability-strict", async (t) => {
    const control = await createForgeUIHostControl({
        hostId: "test-host",
        kind: "test",
        platform: "test-os",
        token: "a".repeat(64),
        capabilityHandlers: {
            [UI_HOST_INSPECT_WINDOWS]: async (input) => ({input}),
        },
    });
    t.after(() => control.close());

    const unauthorized = await fetch(`${control.descriptor.controlURL}/status`);
    assert.equal(unauthorized.status, 401);
    assert.equal((await unauthorized.json()).errorCode, "ui_host_unauthorized");

    const status = await fetchHost(control.descriptor, "/status");
    assert.equal(status.status, 200);
    assert.deepEqual(await status.json(), {
        schemaVersion: 1,
        id: "test-host",
        kind: "test",
        platform: "test-os",
        capabilities: [UI_HOST_INSPECT_WINDOWS],
        state: "online",
    });

    const unknown = await fetchHost(control.descriptor, "/invoke", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({capability: "ui.windows.reload"}),
    });
    assert.equal(unknown.status, 409);
    assert.equal((await unknown.json()).errorCode, "ui_host_capability_unavailable");

    const invalid = await fetchHost(control.descriptor, "/invoke", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({capability: UI_HOST_INSPECT_WINDOWS, extra: true}),
    });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json()).errorCode, "ui_host_invalid_request");
});

test("UI Host capability failures are explicit and never converted to placeholder results", async (t) => {
    const control = await createForgeUIHostControl({
        hostId: "failing-host",
        kind: "test",
        platform: "test-os",
        capabilityHandlers: {
            [UI_HOST_INSPECT_WINDOWS]: async () => {
                throw new Error("window inspection failed");
            },
        },
    });
    t.after(() => control.close());

    const response = await fetchHost(control.descriptor, "/invoke", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({capability: UI_HOST_INSPECT_WINDOWS}),
    });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
        errorCode: "ui_host_capability_failed",
        error: "window inspection failed",
    });
});

const createWindow = ({id, url, loading = false, crashed = false}) => ({
    id,
    getTitle: () => `Window ${id}`,
    isVisible: () => true,
    isFocused: () => false,
    isMinimized: () => false,
    isMaximized: () => false,
    isFullScreen: () => false,
    webContents: {
        id: id + 100,
        isDestroyed: () => false,
        isCrashed: () => crashed,
        isLoading: () => loading,
        getURL: () => url,
    },
});

test("Electron inspection reports real window and renderer startup state", async () => {
    const window = createWindow({id: 7, url: "http://127.0.0.1:6806/stage/build/app/"});
    const startupDiagnostics = {
        createdAt: "2026-08-13T00:00:00.000Z",
        loadRequestedAt: "2026-08-13T00:00:01.000Z",
        didFinishLoadAt: "2026-08-13T00:00:02.000Z",
        rendererReadyAt: null,
        readyTimeoutAt: "2026-08-13T00:01:02.000Z",
        lastLoadFailure: null,
        lastRendererExit: null,
    };
    const input = {
        BrowserWindow: {getAllWindows: () => [window]},
        workspaces: [{browserWindow: window, port: 6806, workspaceDir: "D:/repo/.dev-workspace", startupDiagnostics}],
        magiWindows: new Map(),
        bootWindows: [],
    };

    const result = inspectElectronWindows(input);
    assert.equal(result.processId, process.pid);
    assert.equal(result.windows.length, 1);
    assert.equal(result.windows[0].type, "workspace");
    assert.equal(result.windows[0].renderer.state, "loaded_not_ready");
    assert.deepEqual(result.windows[0].workspace, {path: "D:/repo/.dev-workspace", port: 6806});
    assert.deepEqual(result.windows[0].startup, startupDiagnostics);

    const handler = createElectronWindowInspectHandler({
        BrowserWindow: input.BrowserWindow,
        getWorkspaces: () => input.workspaces,
        getMagiWindows: () => input.magiWindows,
        getBootWindows: () => input.bootWindows,
    });
    await assert.rejects(() => handler({unexpected: true}), /does not accept input fields/);
});
