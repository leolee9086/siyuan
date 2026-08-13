const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {EventEmitter} = require("node:events");
const {
    browserLaunchCommand,
    forgeURL,
    FORGE_SUPERVISOR_TOKEN_ENV,
    FORGE_SUPERVISOR_URL_ENV,
    launchElectronMain,
    observeChildStartup,
    openForgeBrowserInterface,
    openForgeInterface,
    resolveElectronLaunch,
    waitForElectronLaunch,
} = require("../scripts/forge-electron-launcher");
const {
    assertAttachedKernelOptions,
    canReuseWorkspaceWindow,
    commandArgument,
    FORGE_SUPERVISOR_TOKEN_HEADER,
    isValidKernelPort,
    resolveAttachKernelArgument,
    resolveForgeSupervisorContext,
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

const createSupervisorCredential = (overrides = {}) => ({
    url: "http://127.0.0.1:19785",
    token: "a".repeat(64),
    ...overrides,
});

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

test("Electron launch injects Supervisor credentials and forwards exact Kernel arguments", async () => {
    const child = createChild();
    const lateErrors = [];
    let spawned;
    const result = await launchElectronMain({
        launch: {executable: "electron.exe", entry: "D:/repo/app/electron/main.js", appRoot: "D:/repo/app"},
        workspace: "D:/repo/.dev-workspace",
        port: 6810,
        supervisor: createSupervisorCredential(),
        env: {TEST_ENV: "present"},
        reportError: (message) => lateErrors.push(message),
        spawnImpl: (command, args, options) => {
            spawned = {command, args, options};
            queueMicrotask(() => child.emit("spawn"));
            return child;
        },
    });

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
    assert.equal(spawned.options.env[FORGE_SUPERVISOR_URL_ENV], "http://127.0.0.1:19785");
    assert.equal(spawned.options.env[FORGE_SUPERVISOR_TOKEN_ENV], "a".repeat(64));
    assert.equal(result.forwarded, false);
    assert.equal(child.unrefCalled, true);
    child.emit("error", new Error("late process error"));
    child.emit("exit", 9, null);
    assert.equal(lateErrors.some((message) => message.includes("late process error")), true);
    assert.equal(lateErrors.some((message) => message.includes("code=9")), true);
});

test("Electron launch requires Supervisor credentials", async () => {
    const child = createChild();
    await assert.rejects(launchElectronMain({
        launch: {executable: "electron.exe", entry: "D:/repo/app/electron/main.js", appRoot: "D:/repo/app"},
        workspace: "D:/repo/.dev-workspace",
        port: 6810,
        spawnImpl: () => child,
    }), /Supervisor credential is required/);
});

test("Forge Supervisor context is loopback-only and carries the full credential", () => {
    const context = resolveForgeSupervisorContext({
        [FORGE_SUPERVISOR_URL_ENV]: "http://127.0.0.1:19785",
        [FORGE_SUPERVISOR_TOKEN_ENV]: "b".repeat(64),
    });
    assert.equal(context.error, undefined);
    assert.deepEqual(context.supervisor, {
        url: "http://127.0.0.1:19785",
        token: "b".repeat(64),
    });
    assert.match(resolveForgeSupervisorContext({
        [FORGE_SUPERVISOR_URL_ENV]: "http://example.com:19785",
        [FORGE_SUPERVISOR_TOKEN_ENV]: "b".repeat(64),
    }).error, /exact loopback/);
    assert.match(resolveForgeSupervisorContext({
        [FORGE_SUPERVISOR_URL_ENV]: "http://127.0.0.1:19785",
        [FORGE_SUPERVISOR_TOKEN_ENV]: "short",
    }).error, /token is invalid/);
    assert.deepEqual(resolveForgeSupervisorContext({}), {supervisor: undefined});
});

test("Electron launch readiness is polled from Supervisor status", async () => {
    const calls = [];
    const launch = await waitForElectronLaunch({
        supervisor: createSupervisorCredential(),
        pollIntervalMs: 1,
        fetchImpl: async (url, options) => {
            calls.push({url, options});
            const payload = calls.length < 3 ?
                {lastElectronLaunch: null} :
                {lastElectronLaunch: {state: "ready", disposition: "created", port: 6810}};
            return new Response(JSON.stringify(payload), {status: 200, headers: {"Content-Type": "application/json"}});
        },
    });
    assert.equal(launch.state, "ready");
    assert.equal(calls.length, 3);
    assert.equal(calls[0].url, "http://127.0.0.1:19785/status");
    assert.equal(calls[0].options.headers[FORGE_SUPERVISOR_TOKEN_HEADER], "a".repeat(64));
});

test("Electron launch readiness rejects when Supervisor reports a rejected launch", async () => {
    await assert.rejects(waitForElectronLaunch({
        supervisor: createSupervisorCredential(),
        pollIntervalMs: 1,
        fetchImpl: async () => new Response(JSON.stringify({
            lastElectronLaunch: {state: "rejected", reason: "main UI load failed"},
        }), {status: 200}),
    }), (error) => {
        assert.match(error.message, /rejected/);
        return true;
    });
});

test("Electron launch readiness times out without a Supervisor record", async () => {
    await assert.rejects(waitForElectronLaunch({
        supervisor: createSupervisorCredential(),
        timeoutMs: 10,
        pollIntervalMs: 1,
        fetchImpl: async () => new Response(JSON.stringify({lastElectronLaunch: null}), {status: 200}),
    }), (error) => {
        assert.equal(error.timedOut, true);
        return true;
    });
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

test("Electron launch failure does not start the independent browser interface", async () => {
    const reports = [];
    const errors = [];
    let browserLaunches = 0;
    const result = await openForgeInterface({
        root: "D:/repo",
        port: 6807,
        supervisor: createSupervisorCredential(),
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

test("Electron interface reports Supervisor-declared launch rejection", async () => {
    const errors = [];
    const result = await openForgeInterface({
        root: "D:/repo",
        port: 6807,
        supervisor: createSupervisorCredential(),
        resolveElectron: () => ({ready: true}),
        launchElectron: async () => ({forwarded: false}),
        launchBrowser: async () => assert.fail("browser must not launch"),
        report: () => undefined,
        reportError: (message) => errors.push(message),
        registerUIHost: async () => undefined,
    });
    // launchElectron 桩返回后，openForgeInterface 轮询真实 Supervisor /status，
    // 但这里没有真实 Supervisor——waitForElectronLaunch 会因 fetch 失败/超时。
    // 该测试验证失败路径仍归类为 electron-error 而不是抛异常。
    assert.equal(result.kind, "electron-error");
    assert.equal(errors.some((message) => message.includes("Electron main interface launch failed")), true);
});

test("Independent browser interface opens the same complete main URL without probing Electron", async () => {
    let browserURL;
    const result = await openForgeBrowserInterface({
        port: 6806,
        launchBrowser: async ({url}) => { browserURL = url; },
        report: () => undefined,
    });

    assert.deepEqual(result, {kind: "browser", url: "http://127.0.0.1:6806/", uiHosts: []});
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
    assert.deepEqual(result, {kind: "disabled", url: "http://127.0.0.1:6806/", uiHosts: []});
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
    assert.equal(isProtectedRestartPath("app/scripts/forge-ui-host-contract.js", policy), true);
    assert.equal(isProtectedRestartPath("app/scripts/forge-ui-host-registry.js", policy), true);
    assert.equal(isProtectedRestartPath("app/electron/forge-ui-host-control.js", policy), true);
    assert.equal(isProtectedRestartPath("app/test/forge-electron-launcher.test.js", policy), true);
    assert.equal(isProtectedRestartPath("app/test/forge-ui-host-control.test.js", policy), true);
});

test("forgeURL preserves the exact loopback port", () => {
    assert.equal(forgeURL(6806), "http://127.0.0.1:6806/");
});
