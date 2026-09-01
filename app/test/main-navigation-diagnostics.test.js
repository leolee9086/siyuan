const assert = require("node:assert/strict");
const {EventEmitter} = require("node:events");
const test = require("node:test");
const {createMainNavigationDiagnostics} = require("../electron/main-navigation-diagnostics");

const createClock = () => {
    let tick = 0;
    return () => `2026-08-13T09:00:${String(tick++).padStart(2, "0")}.000Z`;
};

const createWebContents = () => {
    const webContents = new EventEmitter();
    webContents.mainFrame = {name: "main"};
    return webContents;
};

test("main navigation listeners capture synchronous navigation emitted by loadURL", async () => {
    const webContents = createWebContents();
    const diagnostics = createMainNavigationDiagnostics(webContents, {
        now: createClock(),
        loadURL: async (targetURL) => {
            webContents.emit("did-start-navigation", {
                url: targetURL,
                isSameDocument: false,
                isMainFrame: true,
            });
            webContents.emit("did-redirect-navigation", {
                url: "https://127.0.0.1:6806/check-auth?to=/stage/build/app/",
                isSameDocument: false,
                isMainFrame: true,
            });
            webContents.emit("did-frame-navigate", {}, "https://127.0.0.1:6806/check-auth?to=/stage/build/app/",
                200, "OK", true, 1, 2);
            webContents.emit("dom-ready");
            webContents.emit("did-finish-load");
            webContents.emit("did-stop-loading");
        },
    });

    diagnostics.prepareTarget("https://127.0.0.1:6806/stage/build/app/?v=1");
    await diagnostics.loadTarget();

    assert.deepEqual(diagnostics.state.timeline.map((entry) => entry.type), [
        "target-prepared",
        "load-requested",
        "did-start-navigation",
        "did-redirect-navigation",
        "did-frame-navigate",
        "dom-ready",
        "did-finish-load",
        "did-stop-loading",
    ]);
    assert.equal(diagnostics.state.mainDocumentURL,
        "https://127.0.0.1:6806/check-auth?to=/stage/build/app/");
    assert.equal(diagnostics.state.createdAt, "2026-08-13T09:00:00.000Z");
    assert.equal(diagnostics.state.didFinishLoadAt, "2026-08-13T09:00:07.000Z");
});

test("main navigation diagnostics exclude subframes and retain the first main-frame console error", () => {
    const webContents = createWebContents();
    const diagnostics = createMainNavigationDiagnostics(webContents, {now: createClock()});
    const subframe = {name: "subframe"};

    webContents.emit("did-start-navigation", {
        url: "https://example.invalid/frame",
        isSameDocument: false,
        isMainFrame: false,
    });
    webContents.emit("did-fail-load", {}, -2, "FAILED", "https://example.invalid/frame", false, 1, 3);
    webContents.emit("console-message", {
        level: "error",
        message: "subframe error",
        lineNumber: 1,
        sourceId: "frame.js",
        frame: subframe,
    });
    webContents.emit("console-message", {
        level: "error",
        message: "first main error",
        lineNumber: 2,
        sourceId: "main.js",
        frame: webContents.mainFrame,
    });
    webContents.emit("console-message", {
        level: "error",
        message: "second main error",
        lineNumber: 3,
        sourceId: "later.js",
        frame: webContents.mainFrame,
    });

    assert.deepEqual(diagnostics.state.timeline.map((entry) => entry.type), ["console-error"]);
    assert.equal(diagnostics.state.firstConsoleError.message, "first main error");
    assert.equal(diagnostics.state.lastLoadFailure, null);
});

test("main navigation diagnostics preserve explicit failures and bound the event timeline", async () => {
    const webContents = createWebContents();
    const diagnostics = createMainNavigationDiagnostics(webContents, {
        maxTimelineEntries: 3,
        now: createClock(),
        loadURL: async () => {
            throw new Error("TLS handshake stopped");
        },
    });

    diagnostics.prepareTarget("https://127.0.0.1:6806/stage/build/app/?v=2");
    await assert.rejects(() => diagnostics.loadTarget(), /TLS handshake stopped/u);
    webContents.emit("did-fail-provisional-load", {}, -202, "CERT_AUTHORITY_INVALID",
        "https://127.0.0.1:6806/stage/build/app/?v=2", true, 1, 2);
    webContents.emit("render-process-gone", {}, {reason: "crashed", exitCode: 9});

    assert.equal(diagnostics.state.timeline.length, 3);
    assert.equal(diagnostics.state.timelineDroppedCount, 2);
    assert.deepEqual(diagnostics.state.timeline.map((entry) => entry.type), [
        "load-url-rejected",
        "did-fail-provisional-load",
        "render-process-gone",
    ]);
    assert.equal(diagnostics.state.lastLoadFailure.phase, "did-fail-provisional-load");
    assert.equal(diagnostics.state.createdAt, "2026-08-13T09:00:00.000Z");
    assert.deepEqual(diagnostics.state.lastRendererExit, {
        at: "2026-08-13T09:00:05.000Z",
        reason: "crashed",
        exitCode: 9,
    });
});
