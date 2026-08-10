const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {EventEmitter} = require("node:events");
const {
    browserLaunchCommand,
    FORGE_LAUNCH_ACK_HEADER,
    FORGE_LAUNCH_ACK_TOKEN_ENV,
    FORGE_LAUNCH_ACK_URL_ENV,
    launchElectronMain,
    observeChildStartup,
    openForgeBrowserInterface,
    openForgeInterface,
    resolveElectronLaunch,
} = require("../scripts/forge-electron-launcher");
const {
    assertAttachedKernelOptions,
    canReuseWorkspaceWindow,
    commandArgument,
    isValidKernelPort,
    resolveAttachKernelArgument,
    sameWorkspacePath,
    shouldSpawnKernel,
} = require("../electron/forge-kernel-attach");
const {isProtectedRestartPath, validateRestartPolicy} = require("../scripts/forge-runtime-supervisor");

const temporaryRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "s-forge-electron-launcher-"));
const createLaunchFixture = () => {
    const root = temporaryRoot();
    const appRoot = path.join(root, "app");
    const entry = path.join(appRoot, "electron", "main.js");
    const frontendEntry = path.join(appRoot, "stage", "build", "app", "index.html");
    const executable = path.join(root, "electron.exe");
    fs.mkdirSync(path.dirname(entry), {recursive: true});
    fs.mkdirSync(path.dirname(frontendEntry), {recursive: true});
    fs.writeFileSync(entry, "");
    fs.writeFileSync(frontendEntry, "");
    fs.writeFileSync(executable, "");
    return {root, appRoot, entry, executable};
};

const createChild = () => {
    const child = new EventEmitter();
    child.pid = 1234;
    child.unrefCalled = false;
    child.unref = () => {
        child.unrefCalled = true;
    };
    return child;
};

test("Electron preflight requires a graphical session, built UI, and executable", () => {
    const fixture = createLaunchFixture();
    const launch = resolveElectronLaunch({
        root: fixture.root,
        platform: "win32",
        loadElectron: () => fixture.executable,
        access: () => undefined,
    });
    assert.deepEqual(launch, {
        ready: true,
        executable: fixture.executable,
        entry: fixture.entry,
        appRoot: fixture.appRoot,
    });

    const headless = resolveElectronLaunch({
        root: fixture.root,
        platform: "linux",
        env: {},
        loadElectron: () => assert.fail("headless preflight must stop before loading Electron"),
    });
    assert.equal(headless.ready, false);
    assert.match(headless.reason, /graphical desktop session/);
});

test("Electron launch passes exact external Kernel ownership arguments", async () => {
    const child = createChild();
    const lateErrors = [];
    let spawned;
    const resultPromise = launchElectronMain({
        launch: {executable: "electron.exe", entry: "D:/repo/app/electron/main.js", appRoot: "D:/repo/app"},
        workspace: "D:/repo/.dev-workspace",
        port: 6810,
        env: {TEST_ENV: "present"},
        readyTimeoutMs: 1_000,
        reportError: (message) => lateErrors.push(message),
        spawnImpl: (command, args, options) => {
            spawned = {command, args, options};
            queueMicrotask(() => {
                child.emit("spawn");
                void fetch(options.env[FORGE_LAUNCH_ACK_URL_ENV], {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        [FORGE_LAUNCH_ACK_HEADER]: options.env[FORGE_LAUNCH_ACK_TOKEN_ENV],
                    },
                    body: JSON.stringify({state: "ready", disposition: "created", port: 6810}),
                });
            });
            return child;
        },
    });
    const result = await resultPromise;

    assert.equal(spawned.command, "electron.exe");
    assert.deepEqual(spawned.args, [
        "D:/repo/app/electron/main.js",
        "--workspace=D:/repo/.dev-workspace",
        "--port=6810",
        "--attach-kernel=true",
    ]);
    assert.equal(spawned.options.cwd, "D:/repo/app");
    assert.equal(spawned.options.env.NODE_ENV, "development");
    assert.equal(spawned.options.env.TEST_ENV, "present");
    assert.equal(result.forwarded, false);
    assert.equal(child.unrefCalled, true);
    child.emit("error", new Error("late process error"));
    child.emit("exit", 9, null);
    assert.equal(lateErrors.some((message) => message.includes("late process error")), true);
    assert.equal(lateErrors.some((message) => message.includes("code=9")), true);
});

test("Generic child observation distinguishes forwarding, process errors, and early crashes", async (t) => {
    await t.test("clean early exit remains forwarding only for generic launchers", async () => {
        const child = createChild();
        const resultPromise = observeChildStartup(child, "Electron", 100);
        queueMicrotask(() => child.emit("exit", 0, null));
        assert.deepEqual(await resultPromise, {forwarded: true});
    });

    await t.test("spawn errors retain their cause", async () => {
        const child = createChild();
        const resultPromise = observeChildStartup(child, "Electron", 100);
        const cause = new Error("missing DLL");
        queueMicrotask(() => child.emit("error", cause));
        await assert.rejects(resultPromise, (error) => {
            assert.match(error.message, /missing DLL/);
            assert.equal(error.cause, cause);
            return true;
        });
    });

    await t.test("nonzero early exit is a launch failure", async () => {
        const child = createChild();
        const resultPromise = observeChildStartup(child, "Electron", 100);
        queueMicrotask(() => {
            child.emit("spawn");
            child.emit("exit", 7, null);
        });
        await assert.rejects(resultPromise, /exited during startup: code=7/);
    });
});

test("Electron clean exit is not accepted without a matching renderer-ready acknowledgement", async () => {
    const child = createChild();
    const launching = launchElectronMain({
        launch: {executable: "electron.exe", entry: "D:/repo/app/electron/main.js", appRoot: "D:/repo/app"},
        workspace: "D:/repo/.dev-workspace",
        port: 6810,
        readyTimeoutMs: 20,
        spawnImpl: () => {
            queueMicrotask(() => child.emit("exit", 0, null));
            return child;
        },
    });
    await assert.rejects(launching, /did not confirm readiness/);
});

test("Electron launch failure does not start the independent browser interface", async () => {
    const reports = [];
    const errors = [];
    let browserLaunches = 0;
    const result = await openForgeInterface({
        root: "D:/repo",
        port: 6807,
        resolveElectron: () => ({ready: true}),
        launchElectron: async ({workspace, port}) => {
            assert.equal(workspace, path.resolve("D:/repo", ".dev-workspace"));
            assert.equal(port, 6807);
            throw new Error("renderer exited");
        },
        launchBrowser: async () => { browserLaunches += 1; },
        report: (message) => reports.push(message),
        reportError: (message) => errors.push(message),
    });

    assert.equal(result.kind, "electron-error");
    assert.equal(result.url, "http://127.0.0.1:6807/");
    assert.equal(browserLaunches, 0);
    assert.equal(errors.some((message) => message.includes("renderer exited")), true);
    assert.equal(errors.some((message) => message.includes("Electron main interface launch failed")), true);
});

test("Independent browser interface opens the same complete main URL without probing Electron", async () => {
    let browserURL;
    const result = await openForgeBrowserInterface({
        port: 6806,
        resolveElectron: () => assert.fail("browser interface must not probe Electron"),
        launchBrowser: async ({url}) => { browserURL = url; },
        report: () => undefined,
    });

    assert.deepEqual(result, {kind: "browser", url: "http://127.0.0.1:6806/"});
    assert.equal(browserURL, "http://127.0.0.1:6806/");
});

test("Forge UI respects explicit no-interface mode without probing launchers", async () => {
    const result = await openForgeInterface({
        root: "D:/repo",
        port: 6806,
        disabled: true,
        resolveElectron: () => assert.fail("disabled UI must not probe Electron"),
        launchBrowser: () => assert.fail("disabled UI must not open a browser"),
        report: () => undefined,
    });
    assert.deepEqual(result, {kind: "disabled", url: "http://127.0.0.1:6806/"});
});

test("Forge UI keeps the runtime active when the Electron interface fails", async () => {
    const errors = [];
    const result = await openForgeInterface({
        root: "D:/repo",
        port: 6808,
        resolveElectron: () => {
            throw new Error("preflight exploded");
        },
        report: () => undefined,
        reportError: (message) => errors.push(message),
    });

    assert.equal(result.kind, "electron-error");
    assert.equal(result.url, "http://127.0.0.1:6808/");
    assert.equal(errors.some((message) => message.includes("preflight exploded")), true);
});

test("Independent browser commands preserve the exact local URL", () => {
    const url = "http://127.0.0.1:6809/";
    assert.deepEqual(browserLaunchCommand(url, "win32"), {
        command: "rundll32.exe",
        args: ["url.dll,FileProtocolHandler", url],
    });
    assert.deepEqual(browserLaunchCommand(url, "darwin"), {command: "open", args: [url]});
    assert.deepEqual(browserLaunchCommand(url, "linux", {DISPLAY: ":0"}), {
        command: "xdg-open",
        args: [url],
    });
    assert.equal(browserLaunchCommand(url, "linux", {}), undefined);
});

test("External Kernel attach arguments are exact and never spawn a duplicate Kernel", () => {
    const argv = [
        "electron.exe",
        "main.js",
        "--workspace=D:/repo=name/.dev-workspace",
        "--port=6811",
        "--attach-kernel=true",
    ];
    assert.equal(commandArgument(argv, "--workspace"), "D:/repo=name/.dev-workspace");
    assert.deepEqual(resolveAttachKernelArgument(argv), {enabled: true});
    assert.deepEqual(resolveAttachKernelArgument(["--attach-kernel=false"]), {enabled: false});
    assert.match(resolveAttachKernelArgument(["--attach-kernel=yes"]).error, /true or false/);
    assert.equal(isValidKernelPort("1"), true);
    assert.equal(isValidKernelPort("65535"), true);
    assert.equal(isValidKernelPort("0"), false);
    assert.equal(isValidKernelPort("65536"), false);
    assert.equal(isValidKernelPort("6806.5"), false);
    assert.doesNotThrow(() => assertAttachedKernelOptions({
        attachKernel: true,
        workspace: path.resolve("D:/repo/.dev-workspace"),
        port: "6811",
    }));
    assert.throws(() => assertAttachedKernelOptions({attachKernel: true, workspace: "relative", port: "6811"}), /absolute/);
    assert.throws(() => assertAttachedKernelOptions({attachKernel: true, workspace: "D:/repo", port: "0"}), /1 and 65535/);
    assert.equal(shouldSpawnKernel({attachKernel: true, isDevEnv: true, workspaceCount: 4}), false);
    assert.equal(shouldSpawnKernel({attachKernel: true, isDevEnv: false, workspaceCount: 0}), false);
    assert.equal(shouldSpawnKernel({attachKernel: false, isDevEnv: true, workspaceCount: 0}), false);
    assert.equal(shouldSpawnKernel({attachKernel: false, isDevEnv: true, workspaceCount: 1}), true);
    assert.equal(shouldSpawnKernel({attachKernel: false, isDevEnv: false, workspaceCount: 0}), true);
    assert.equal(canReuseWorkspaceWindow({attachKernel: true, requestedPort: "6806", currentPort: 6806}), true);
    assert.equal(canReuseWorkspaceWindow({attachKernel: true, requestedPort: "6807", currentPort: 6806}), false);
    assert.equal(canReuseWorkspaceWindow({attachKernel: false, requestedPort: "6807", currentPort: 6806}), true);
    assert.equal(sameWorkspacePath("D:/Repo/Workspace", "d:/repo/workspace", "win32"), true);
    assert.equal(canReuseWorkspaceWindow({
        attachKernel: true,
        requestedPort: "6806",
        currentPort: 6806,
        requestedWorkspace: "D:/Repo/Workspace",
        currentWorkspace: "d:/repo/workspace",
        windowURL: "https://127.0.0.1:6806/stage/build/app/?v=1",
        platform: "win32",
    }), true);
    assert.equal(canReuseWorkspaceWindow({
        attachKernel: true,
        requestedPort: "6806",
        currentPort: 6806,
        requestedWorkspace: "D:/Repo/Workspace",
        currentWorkspace: "d:/repo/workspace",
        windowURL: "https://127.0.0.1:6807/stage/build/app/?v=1",
        platform: "win32",
    }), false);
});

test("Forge restart policy protects the Electron launcher and its boundary tests", () => {
    const policyPath = path.resolve(__dirname, "../../kernel/forge_restart_test_policy.json");
    const policy = validateRestartPolicy(JSON.parse(fs.readFileSync(policyPath, "utf8")));
    assert.equal(isProtectedRestartPath("app/scripts/forge-electron-launcher.js", policy), true);
    assert.equal(isProtectedRestartPath("app/test/forge-electron-launcher.test.js", policy), true);
});
