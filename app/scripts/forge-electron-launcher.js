#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const {spawn} = require("child_process");

const DEFAULT_STARTUP_GRACE_MS = 1_500;

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

const launchElectronMain = async ({
    launch,
    workspace,
    port,
    env = process.env,
    spawnImpl = spawn,
    startupGraceMs = DEFAULT_STARTUP_GRACE_MS,
    reportError = console.error,
}) => {
    const args = [
        launch.entry,
        `--workspace=${workspace}`,
        `--port=${port}`,
        "--attach-kernel=true",
    ];
    const result = await spawnObserved({
        command: launch.executable,
        args,
        options: {
            cwd: launch.appRoot,
            env: {...env, NODE_ENV: "development"},
            stdio: "inherit",
            windowsHide: false,
        },
        label: "Electron",
        startupGraceMs,
        spawnImpl,
        reportError,
    });
    return {...result, args};
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
        throw new Error("no graphical desktop session is present for the browser fallback");
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

const openForgeInterface = async ({
    root,
    port,
    disabled = false,
    resolveElectron = resolveElectronLaunch,
    launchElectron = launchElectronMain,
    launchBrowser = launchSystemBrowser,
    report = console.log,
    reportError = console.error,
}) => {
    const url = forgeURL(port);
    if (disabled) {
        report("[forge] automatic UI launch disabled by --no-browser");
        return {kind: "disabled", url};
    }
    let electronLaunch;
    try {
        electronLaunch = resolveElectron({root});
    } catch (error) {
        electronLaunch = {ready: false, reason: `Electron preflight failed: ${error.message}`};
    }
    if (!electronLaunch || typeof electronLaunch !== "object") {
        electronLaunch = {ready: false, reason: "Electron preflight returned no launch descriptor"};
    }
    if (electronLaunch.ready) {
        try {
            const result = await launchElectron({
                launch: electronLaunch,
                workspace: path.resolve(root, ".dev-workspace"),
                port,
                reportError,
            });
            const action = result.forwarded ? "forwarded to the running Electron instance" : "started";
            report(`[forge] Electron main interface ${action} for ${url}`);
            return {kind: "electron", url, forwarded: result.forwarded};
        } catch (error) {
            reportError(`[forge] Electron main interface launch failed: ${error.message}`);
        }
    } else {
        report(`[forge] Electron main interface is not ready: ${electronLaunch.reason}`);
    }
    try {
        await launchBrowser({url, reportError});
        report(`[forge] opened system browser fallback at ${url}`);
        return {kind: "browser", url};
    } catch (error) {
        reportError(`[forge] system browser fallback failed: ${error.message}`);
        reportError(`[forge] open this address manually: ${url}`);
        return {kind: "manual", url, error};
    }
};

module.exports = {
    browserLaunchCommand,
    forgeURL,
    hasGraphicalSession,
    launchElectronMain,
    launchSystemBrowser,
    observeChildStartup,
    openForgeInterface,
    resolveElectronLaunch,
    spawnObserved,
};
