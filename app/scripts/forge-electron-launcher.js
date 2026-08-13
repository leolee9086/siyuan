#!/usr/bin/env node
const crypto = require("crypto");
const fs = require("fs");
const http = require("http");
const path = require("path");
const {spawn} = require("child_process");
const {
    FORGE_LAUNCH_ACK_HEADER,
    FORGE_LAUNCH_ACK_TOKEN_ENV,
    FORGE_LAUNCH_ACK_URL_ENV,
    FORGE_LAUNCH_UI_HOST_READY,
} = require("../electron/forge-kernel-attach");
const {validateUIHostDescriptor} = require("./forge-ui-host-contract");

const DEFAULT_STARTUP_GRACE_MS = 1_500;
const DEFAULT_UI_READY_TIMEOUT_MS = 60_000;

const forgeURL = (port) => `http://127.0.0.1:${port}/`;

const timingSafeTokenEqual = (actual, expected) => {
    const actualBuffer = Buffer.from(String(actual || ""));
    const expectedBuffer = Buffer.from(String(expected || ""));
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const isLoopbackAddress = (address) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);

const readAcknowledgement = (request) => new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body) > 16 * 1024) {
            reject(new Error("Electron launch acknowledgement is too large"));
            request.destroy();
        }
    });
    request.once("end", () => {
        try {
            const payload = JSON.parse(body || "{}");
            if (payload.type === FORGE_LAUNCH_UI_HOST_READY) {
                payload.uiHost = validateUIHostDescriptor(payload.uiHost);
                resolve(payload);
                return;
            }
            if (!["ready", "rejected"].includes(payload.state)) {
                throw new Error("Electron launch acknowledgement has an invalid state");
            }
            if (payload.uiHost !== undefined) {
                payload.uiHost = validateUIHostDescriptor(payload.uiHost);
            }
            resolve(payload);
        } catch (error) {
            reject(error);
        }
    });
    request.once("error", reject);
});

const createLaunchAcknowledgement = async ({
    timeoutMs = DEFAULT_UI_READY_TIMEOUT_MS,
    token = crypto.randomBytes(32).toString("hex"),
    createServer = http.createServer,
    onUIHostReady = async () => undefined,
} = {}) => {
    let resolveAcknowledgement;
    let rejectAcknowledgement;
    let settled = false;
    let timer;
    const acknowledgement = new Promise((resolve, reject) => {
        resolveAcknowledgement = resolve;
        rejectAcknowledgement = reject;
    });
    const finish = (callback, value) => {
        if (settled) {
            return false;
        }
        settled = true;
        clearTimeout(timer);
        callback(value);
        return true;
    };
    const server = createServer((request, response) => {
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        if (!isLoopbackAddress(request.socket.remoteAddress) || request.method !== "POST" || request.url !== "/ready" ||
            !timingSafeTokenEqual(request.headers[FORGE_LAUNCH_ACK_HEADER], token)) {
            response.statusCode = 401;
            response.end(JSON.stringify({error: "invalid Electron launch acknowledgement"}));
            return;
        }
        void readAcknowledgement(request).then((payload) => {
            if (payload.type === FORGE_LAUNCH_UI_HOST_READY) {
                if (settled) {
                    response.statusCode = 409;
                    response.end(JSON.stringify({error: "Electron launch acknowledgement was already completed"}));
                    return;
                }
                void Promise.resolve(onUIHostReady(payload.uiHost)).then(() => {
                    response.statusCode = 202;
                    response.end(JSON.stringify({accepted: true}));
                }).catch((error) => {
                    response.statusCode = 502;
                    response.end(JSON.stringify({error: `UI Host registration failed: ${error.message}`}));
                });
                return;
            }
            if (!finish(resolveAcknowledgement, payload)) {
                response.statusCode = 409;
                response.end(JSON.stringify({error: "Electron launch acknowledgement was already completed"}));
                return;
            }
            response.statusCode = 202;
            response.end(JSON.stringify({accepted: true}));
        }).catch((error) => {
            response.statusCode = 400;
            response.end(JSON.stringify({error: error.message}));
        });
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Electron launch acknowledgement did not expose a TCP address");
    }
    timer = setTimeout(() => {
        finish(rejectAcknowledgement, new Error(`Electron main interface did not confirm readiness within ${timeoutMs}ms`));
    }, timeoutMs);
    return {
        url: `http://127.0.0.1:${address.port}/ready`,
        token,
        wait: () => acknowledgement,
        close: () => {
            finish(resolveAcknowledgement, {state: "rejected", reason: "Electron launch acknowledgement channel closed"});
            return new Promise((resolve) => {
                if (!server.listening) {
                    resolve();
                    return;
                }
                server.close(() => resolve());
            });
        },
    };
};

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
    attachKernel = true,
    env = process.env,
    spawnImpl = spawn,
    readyTimeoutMs = DEFAULT_UI_READY_TIMEOUT_MS,
    createAcknowledgement = createLaunchAcknowledgement,
    onUIHostReady = async () => undefined,
    reportError = console.error,
}) => {
    const ready = await createAcknowledgement({timeoutMs: readyTimeoutMs, onUIHostReady});
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
                [FORGE_LAUNCH_ACK_URL_ENV]: ready.url,
                [FORGE_LAUNCH_ACK_TOKEN_ENV]: ready.token,
            },
            stdio: "inherit",
            windowsHide: false,
        });
        if (!child || typeof child.once !== "function") {
            throw new Error("Electron launcher returned an invalid child process");
        }
    } catch (error) {
        await ready.close();
        throw new Error(`Electron process could not be created: ${error.message}`, {cause: error});
    }
    let exited = false;
    let onProcessError;
    let onProcessExit;
    let postStartupObserved = false;
    const observeAfterStartup = () => {
        if (postStartupObserved || exited || typeof child.on !== "function") {
            return;
        }
        postStartupObserved = true;
        child.on("error", (error) => reportError(`[forge] Electron process error after startup: ${error.message}`));
        child.on("exit", (code, signal) => {
            if (code !== 0 || signal) {
                reportError(`[forge] Electron exited after startup: code=${code ?? "null"}, signal=${signal || "none"}`);
            }
        });
    };
    const processFailure = new Promise((_, reject) => {
        onProcessError = (error) => reject(new Error(`Electron process error: ${error.message}`, {cause: error}));
        onProcessExit = (code, signal) => {
            exited = true;
            if (code !== 0 || signal) {
                reject(new Error(`Electron exited before the main interface was ready: code=${code ?? "null"}, signal=${signal || "none"}`));
            }
        };
        child.once("error", onProcessError);
        child.once("exit", onProcessExit);
    });
    let acknowledgement;
    let launchAccepted = false;
    try {
        acknowledgement = await Promise.race([ready.wait(), processFailure]);
        if (!acknowledgement || !["ready", "rejected"].includes(acknowledgement.state)) {
            throw new Error("Electron launch acknowledgement has an invalid state");
        }
        if (acknowledgement.state === "rejected") {
            const error = new Error(`Electron rejected the main interface request: ${acknowledgement.reason || "no reason reported"}`);
            error.uiHost = acknowledgement.uiHost;
            throw error;
        }
        launchAccepted = true;
    } finally {
        child.removeListener?.("error", onProcessError);
        child.removeListener?.("exit", onProcessExit);
        if (!launchAccepted) {
            observeAfterStartup();
        }
        await ready.close();
    }
    observeAfterStartup();
    child.unref?.();
    return {
        child,
        args,
        acknowledgement,
        forwarded: acknowledgement.disposition === "reused",
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

const openForgeElectronInterface = async ({
    root,
    port,
    resolveElectron = resolveElectronLaunch,
    launchElectron = launchElectronMain,
    registerUIHost = async () => undefined,
    report = console.log,
    reportError = console.error,
}) => {
    const url = forgeURL(port);
    const uiHosts = [];
    const registrationPromises = new Map();
    let uiHostRegistrationError;
    const registerDescriptor = (descriptor) => {
        const normalized = validateUIHostDescriptor(descriptor);
        const existing = registrationPromises.get(normalized.id);
        if (existing) {
            if (existing.serialized !== JSON.stringify(normalized)) {
                return Promise.reject(new Error(`UI Host ${normalized.id} sent conflicting descriptors`));
            }
            return existing.promise;
        }
        const serialized = JSON.stringify(normalized);
        const promise = Promise.resolve(registerUIHost(normalized)).then(() => {
            uiHosts.push(normalized);
            return normalized;
        }).catch((error) => {
            uiHostRegistrationError ||= error;
            registrationPromises.delete(normalized.id);
            throw error;
        });
        registrationPromises.set(normalized.id, {serialized, promise});
        return promise;
    };
    const registerAndReport = async (descriptor) => {
        try {
            return await registerDescriptor(descriptor);
        } catch (error) {
            reportError(`[forge] UI Host registration failed: ${error.message}`);
            throw error;
        }
    };
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
                onUIHostReady: registerAndReport,
                reportError,
            });
            const action = result.forwarded ? "forwarded to the running Electron instance" : "started";
            report(`[forge] Electron main interface ${action} for ${url}`);
            if (result.acknowledgement.uiHost) {
                try {
                    await registerAndReport(result.acknowledgement.uiHost);
                } catch (registrationError) {
                    return {
                        kind: "electron",
                        url,
                        forwarded: result.forwarded,
                        uiHosts: [],
                        uiHostRegistrationError: registrationError,
                    };
                }
            }
            const response = {kind: "electron", url, forwarded: result.forwarded, uiHosts};
            if (uiHostRegistrationError) {
                response.uiHostRegistrationError = uiHostRegistrationError;
            }
            return response;
        } catch (error) {
            reportError(`[forge] Electron main interface launch failed: ${error.message}`);
            if (error.uiHost) {
                try {
                    await registerAndReport(error.uiHost);
                } catch (_registrationError) {
                    // registerAndReport 已报告具体错误。
                }
            }
            const response = {kind: "electron-error", url, error, uiHosts};
            if (uiHostRegistrationError) {
                response.uiHostRegistrationError = uiHostRegistrationError;
            }
            return response;
        }
    } else {
        const error = new Error(electronLaunch.reason);
        reportError(`[forge] Electron main interface is not ready: ${error.message}`);
        return {kind: "electron-error", url, error, uiHosts: []};
    }
};

const openForgeInterface = async ({
    root,
    port,
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
        resolveElectron,
        launchElectron,
        registerUIHost,
        report,
        reportError,
    });
};

module.exports = {
    browserLaunchCommand,
    createLaunchAcknowledgement,
    forgeURL,
    FORGE_LAUNCH_ACK_HEADER,
    FORGE_LAUNCH_ACK_TOKEN_ENV,
    FORGE_LAUNCH_ACK_URL_ENV,
    hasGraphicalSession,
    launchElectronMain,
    openForgeBrowserInterface,
    openForgeElectronInterface,
    launchSystemBrowser,
    observeChildStartup,
    openForgeInterface,
    resolveElectronLaunch,
    spawnObserved,
};
