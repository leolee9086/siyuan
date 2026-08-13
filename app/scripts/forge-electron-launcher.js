#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");
const {
    FORGE_SUPERVISOR_TOKEN_ENV,
    FORGE_SUPERVISOR_TOKEN_HEADER,
    FORGE_SUPERVISOR_URL_ENV,
} = require("../electron/forge-kernel-attach");

const DEFAULT_STARTUP_GRACE_MS = 1_500;
const DEFAULT_UI_READY_TIMEOUT_MS = 60_000;
const DEFAULT_SUPERVISOR_POLL_INTERVAL_MS = 500;

const forgeURL = (port) => `http://127.0.0.1:${port}/`;

const hasGraphicalSession = (platform = process.platform, env = process.env) => {
    if (platform !== "linux") {
        return true;
    }
    return Boolean(env.DISPLAY || env.WAYLAND_DISPLAY || env.MIR_SOCKET);
};

const resolveElectronLaunch = ({
    root,
    platform = process.platform,
    env = process.env,
    loadElectron = () => require("electron"),
    exists = fs.existsSync,
    access = fs.accessSync,
} = {}) => {
    if (!hasGraphicalSession(platform, env)) {
        return {ready: false, reason: "no graphical desktop session was detected"};
    }
    const appRoot = path.join(root, "app");
    const entry = path.join(appRoot, "electron", "main.js");
    const frontendEntry = path.join(appRoot, "stage", "build", "app", "index.html");
    if (!exists(entry)) {
        return {ready: false, reason: `Electron main entry is missing: ${entry}`};
    }
    if (!exists(frontendEntry)) {
        return {ready: false, reason: `desktop frontend build is missing: ${frontendEntry}`};
    }
    let executable;
    try {
        executable = loadElectron();
    } catch (error) {
        return {ready: false, reason: `Electron dependency could not be loaded: ${error.message}`};
    }
    if (typeof executable !== "string" || !exists(executable)) {
        return {ready: false, reason: `Electron executable is missing: ${executable || "not resolved"}`};
    }
    try {
        access(executable, fs.constants.X_OK);
    } catch (error) {
        return {ready: false, reason: `Electron executable cannot be started: ${error.message}`};
    }
    return {ready: true, executable, entry, appRoot};
};

const observeChildStartup = (child, label, startupGraceMs = DEFAULT_STARTUP_GRACE_MS) => new Promise((resolve, reject) => {
    let timer;
    let settled = false;
    function finish(callback, value) {
        if (settled) {
            return;
        }
        settled = true;
        clearTimeout(timer);
        child.removeListener("error", onError);
        child.removeListener("exit", onExit);
        child.removeListener("spawn", onSpawn);
        callback(value);
    }
    function onError(error) {
        finish(reject, new Error(`${label} process error: ${error.message}`, {cause: error}));
    }
    function onExit(code, signal) {
        if (code === 0 && !signal) {
            finish(resolve, {forwarded: true});
            return;
        }
        finish(reject, new Error(`${label} exited during startup: code=${code ?? "null"}, signal=${signal || "none"}`));
    }
    function onSpawn() {
        timer = setTimeout(() => finish(resolve, {forwarded: false}), startupGraceMs);
    }
    child.once("error", onError);
    child.once("exit", onExit);
    child.once("spawn", onSpawn);
});

const spawnObserved = async ({
    command,
    args,
    options,
    label,
    startupGraceMs,
    spawnImpl = spawn,
    reportError = console.error,
}) => {
    let child;
    try {
        child = spawnImpl(command, args, options);
    } catch (error) {
        throw new Error(`${label} process could not be created: ${error.message}`, {cause: error});
    }
    const startup = await observeChildStartup(child, label, startupGraceMs);
    if (!startup.forwarded) {
        child.on("error", (error) => reportError(`[forge] ${label} process error after startup: ${error.message}`));
        child.on("exit", (code, signal) => {
            if (code !== 0 || signal) {
                reportError(`[forge] ${label} exited after startup: code=${code ?? "null"}, signal=${signal || "none"}`);
            }
        });
    }
    child.unref?.();
    return {child, ...startup};
};

// 启动 Electron 主进程。启动验收不再由一次性 ack 服务器中转：
// forge-start 把 Supervisor 凭据注入 Electron env，Electron 就绪/失败直接
// POST Supervisor /launch/ready；本函数只负责 spawn 并注入凭据，由调用方
// 轮询 Supervisor /status 的 lastElectronLaunch 判定验收结果。
const launchElectronMain = async ({
    launch,
    workspace,
    port,
    attachKernel = true,
    supervisor,
    env = process.env,
    spawnImpl = spawn,
    reportError = console.error,
}) => {
    if (!supervisor || typeof supervisor.url !== "string" || typeof supervisor.token !== "string") {
        throw new Error("Forge Supervisor credential is required to launch the Electron main interface");
    }
    const args = [
        launch.entry,
        `--workspace=${workspace}`,
        `--port=${port}`,
        `--attach-kernel=${attachKernel}`,
    ];
    let child;
    try {
        child = spawnImpl(launch.executable, args, {
            cwd: launch.appRoot,
            env: {
                ...env,
                NODE_ENV: "development",
                [FORGE_SUPERVISOR_URL_ENV]: supervisor.url,
                [FORGE_SUPERVISOR_TOKEN_ENV]: supervisor.token,
            },
            stdio: "inherit",
            windowsHide: false,
        });
        if (!child || typeof child.once !== "function") {
            throw new Error("Electron launcher returned an invalid child process");
        }
    } catch (error) {
        throw new Error(`Electron process could not be created: ${error.message}`, {cause: error});
    }
    let exited = false;
    let postStartupObserved = false;
    const observeAfterStartup = () => {
        if (postStartupObserved || exited || typeof child.on !== "function") {
            return;
        }
        postStartupObserved = true;
        child.on("error", (error) => reportError(`[forge] Electron process error after startup: ${error.message}`));
        child.on("exit", (code, signal) => {
            exited = true;
            if (code !== 0 || signal) {
                reportError(`[forge] Electron exited after startup: code=${code ?? "null"}, signal=${signal || "none"}`);
            }
        });
    };
    observeAfterStartup();
    child.unref?.();
    return {
        child,
        args,
        forwarded: false,
    };
};

const browserLaunchCommand = (url, platform = process.platform, env = process.env) => {
    if (!hasGraphicalSession(platform, env)) {
        return undefined;
    }
    if (platform === "win32") {
        return {command: "rundll32.exe", args: ["url.dll,FileProtocolHandler", url]};
    }
    if (platform === "darwin") {
        return {command: "open", args: [url]};
    }
    return {command: "xdg-open", args: [url]};
};

const launchSystemBrowser = async ({
    url,
    platform = process.platform,
    env = process.env,
    spawnImpl = spawn,
    startupGraceMs = 500,
    reportError = console.error,
}) => {
    const launch = browserLaunchCommand(url, platform, env);
    if (!launch) {
        throw new Error("no graphical desktop session is present for the system browser");
    }
    return spawnObserved({
        ...launch,
        options: {detached: true, stdio: "ignore", windowsHide: true},
        label: "system browser",
        startupGraceMs,
        spawnImpl,
        reportError,
    });
};

const openForgeBrowserInterface = async ({
    port,
    launchBrowser = launchSystemBrowser,
    report = console.log,
    reportError = console.error,
}) => {
    const url = forgeURL(port);
    try {
        await launchBrowser({url, reportError});
        report(`[forge] opened independent system browser at ${url}`);
        return {kind: "browser", url, uiHosts: []};
    } catch (error) {
        reportError(`[forge] independent system browser launch failed: ${error.message}`);
        reportError(`[forge] open this address manually: ${url}`);
        return {kind: "browser-error", url, error, uiHosts: []};
    }
};

// 轮询 Supervisor /status，等待 Electron 启动验收回执（ready/rejected）或超时。
const waitForElectronLaunch = async ({
    supervisor,
    fetchImpl = globalThis.fetch.bind(globalThis),
    timeoutMs = DEFAULT_UI_READY_TIMEOUT_MS,
    pollIntervalMs = DEFAULT_SUPERVISOR_POLL_INTERVAL_MS,
    wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    now = Date.now,
}) => {
    const deadline = now() + timeoutMs;
    const query = async () => {
        const response = await fetchImpl(`${supervisor.url}/status`, {
            headers: {[FORGE_SUPERVISOR_TOKEN_HEADER]: supervisor.token},
        });
        if (!response.ok) {
            throw new Error(`Forge Supervisor status returned HTTP ${response.status}`);
        }
        const status = await response.json();
        return status.lastElectronLaunch || null;
    };
    while (true) {
        const launch = await query();
        if (launch && ["ready", "rejected"].includes(launch.state)) {
            return launch;
        }
        if (now() >= deadline) {
            const error = new Error(`Electron main interface did not confirm readiness within ${timeoutMs}ms`);
            error.timedOut = true;
            throw error;
        }
        await wait(pollIntervalMs);
    }
};

const openForgeElectronInterface = async ({
    root,
    port,
    supervisor,
    resolveElectron = resolveElectronLaunch,
    launchElectron = launchElectronMain,
    registerUIHost = async () => undefined,
    report = console.log,
    reportError = console.error,
}) => {
    const url = forgeURL(port);
    const uiHosts = [];
    let electronLaunch;
    try {
        electronLaunch = resolveElectron({root});
    } catch (error) {
        electronLaunch = {ready: false, reason: `Electron preflight failed: ${error.message}`};
    }
    if (!electronLaunch || typeof electronLaunch !== "object") {
        electronLaunch = {ready: false, reason: "Electron preflight returned no launch descriptor"};
    }
    if (!electronLaunch.ready) {
        const error = new Error(electronLaunch.reason);
        reportError(`[forge] Electron main interface is not ready: ${error.message}`);
        return {kind: "electron-error", url, error, uiHosts: []};
    }
    try {
        const result = await launchElectron({
            launch: electronLaunch,
            workspace: path.resolve(root, ".dev-workspace"),
            port,
            supervisor,
            reportError,
        });
        report(`[forge] Electron main interface started for ${url}`);
        // 验收由 Electron 直连 Supervisor 完成，本函数只轮询结果。
        const launch = await waitForElectronLaunch({supervisor});
        if (launch.state === "rejected") {
            const error = new Error(`Electron rejected the main interface request: ${launch.reason || "no reason reported"}`);
            error.launch = launch;
            throw error;
        }
        const response = {kind: "electron", url, forwarded: result.forwarded, uiHosts};
        return response;
    } catch (error) {
        reportError(`[forge] Electron main interface launch failed: ${error.message}`);
        const response = {kind: "electron-error", url, error, uiHosts};
        return response;
    }
};

const openForgeInterface = async ({
    root,
    port,
    supervisor,
    mode = "electron",
    disabled = false,
    resolveElectron = resolveElectronLaunch,
    launchElectron = launchElectronMain,
    launchBrowser = launchSystemBrowser,
    registerUIHost = async () => undefined,
    report = console.log,
    reportError = console.error,
}) => {
    const url = forgeURL(port);
    if (disabled || mode === "none") {
        report("[forge] automatic UI launch disabled by --no-browser");
        return {kind: "disabled", url, uiHosts: []};
    }
    if (mode === "browser") {
        return openForgeBrowserInterface({port, launchBrowser, report, reportError});
    }
    if (mode !== "electron") {
        throw new Error(`unknown Forge interface mode: ${mode}`);
    }
    return openForgeElectronInterface({
        root,
        port,
        supervisor,
        resolveElectron,
        launchElectron,
        registerUIHost,
        report,
        reportError,
    });
};

module.exports = {
    browserLaunchCommand,
    forgeURL,
    FORGE_SUPERVISOR_TOKEN_ENV,
    FORGE_SUPERVISOR_URL_ENV,
    hasGraphicalSession,
    launchElectronMain,
    openForgeBrowserInterface,
    openForgeElectronInterface,
    launchSystemBrowser,
    observeChildStartup,
    openForgeInterface,
    resolveElectronLaunch,
    spawnObserved,
    waitForElectronLaunch,
};
