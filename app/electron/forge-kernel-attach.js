const http = require("http");
const path = require("path");

const FORGE_SUPERVISOR_URL_ENV = "S_FORGE_SUPERVISOR_URL";
const FORGE_SUPERVISOR_TOKEN_ENV = "S_FORGE_SUPERVISOR_TOKEN";
const FORGE_SUPERVISOR_TOKEN_HEADER = "x-s-forge-supervisor-token";
const FORGE_SUPERVISOR_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

const commandArgument = (argv, name) => {
    const prefix = `${name}=`;
    const argument = argv.find((value) => typeof value === "string" && value.startsWith(prefix));
    return argument === undefined ? undefined : argument.slice(prefix.length);
};

const resolveAttachKernelArgument = (argv) => {
    const value = commandArgument(argv, "--attach-kernel");
    if (value === undefined || value === "false") {
        return {enabled: false};
    }
    if (value === "true") {
        return {enabled: true};
    }
    return {
        enabled: false,
        error: "The --attach-kernel argument must be either true or false.",
    };
};

const isValidKernelPort = (port) => {
    const value = String(port ?? "");
    if (!/^[0-9]+$/.test(value)) {
        return false;
    }
    const numericPort = Number(value);
    return Number.isInteger(numericPort) && numericPort > 0 && numericPort <= 65535;
};

const assertAttachedKernelOptions = ({attachKernel, workspace, port}) => {
    if (!attachKernel) {
        return;
    }
    if (typeof workspace !== "string" || !path.isAbsolute(workspace)) {
        throw new Error("An attached Kernel requires an absolute workspace path.");
    }
    if (!isValidKernelPort(port)) {
        throw new Error("An attached Kernel requires a port between 1 and 65535.");
    }
};

const shouldSpawnKernel = ({attachKernel, isDevEnv, workspaceCount}) =>
    !attachKernel && (!isDevEnv || workspaceCount > 0);

const sameWorkspacePath = (left, right, platform = process.platform) => {
    if (typeof left !== "string" || typeof right !== "string" || !left || !right) {
        return false;
    }
    const normalize = (value) => {
        const resolved = path.resolve(value);
        return platform === "win32" ? resolved.toLowerCase() : resolved;
    };
    return normalize(left) === normalize(right);
};

const canReuseWorkspaceWindow = ({
    attachKernel,
    requestedPort,
    currentPort,
    requestedWorkspace,
    currentWorkspace,
    windowURL,
    windowDestroyed = false,
    webContentsDestroyed = false,
    platform = process.platform,
}) => {
    if (windowDestroyed || webContentsDestroyed) {
        return false;
    }
    if (requestedWorkspace !== undefined &&
        !sameWorkspacePath(requestedWorkspace, currentWorkspace, platform)) {
        return false;
    }
    if (attachKernel && String(requestedPort) !== String(currentPort)) {
        return false;
    }
    if (attachKernel && windowURL !== undefined) {
        try {
            const parsed = new URL(windowURL);
            if (!["http:", "https:"].includes(parsed.protocol) ||
                !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
                String(parsed.port) !== String(requestedPort) ||
                !parsed.pathname.startsWith("/stage/build/app/")) {
                return false;
            }
        } catch (_error) {
            return false;
        }
    }
    return true;
};

// Electron 启动验收直连 Supervisor：Supervisor 是长生命周期管理面，
// 不存在一次性 ack 服务器那种「迟到回执撞上已关端口」的竞态。
const resolveForgeSupervisorContext = (env = process.env) => {
    const supervisorURL = String(env[FORGE_SUPERVISOR_URL_ENV] || "").trim();
    const supervisorToken = String(env[FORGE_SUPERVISOR_TOKEN_ENV] || "").trim();
    if (!supervisorURL && !supervisorToken) {
        return {supervisor: undefined};
    }
    if (!FORGE_SUPERVISOR_TOKEN_PATTERN.test(supervisorToken)) {
        return {error: "Forge Supervisor token is invalid."};
    }
    let parsed;
    try {
        parsed = new URL(supervisorURL);
    } catch (_error) {
        return {error: "Forge Supervisor URL is invalid."};
    }
    if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || !parsed.port ||
        parsed.username || parsed.password || parsed.search || parsed.hash) {
        return {error: "Forge Supervisor URL must be an exact loopback URL."};
    }
    return {
        supervisor: {
            url: parsed.origin,
            token: supervisorToken,
        },
    };
};

const sendForgeLaunchAcknowledgement = (launchContext, payload, requestImpl = http.request) => new Promise((resolve, reject) => {
    if (!launchContext?.supervisor) {
        resolve(false);
        return;
    }
    const body = JSON.stringify(payload);
    const request = requestImpl(`${launchContext.supervisor.url}/launch/ready`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            [FORGE_SUPERVISOR_TOKEN_HEADER]: launchContext.supervisor.token,
        },
        timeout: 3_000,
    }, (response) => {
        response.resume();
        response.once("end", () => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                reject(new Error(`Forge launch acknowledgement returned HTTP ${response.statusCode}`));
                return;
            }
            resolve(true);
        });
    });
    request.once("timeout", () => request.destroy(new Error("Forge launch acknowledgement timed out")));
    request.once("error", reject);
    request.end(body);
});

const sendForgeUIHostReady = (launchContext, uiHost, requestImpl = http.request) =>
    sendForgeLaunchAcknowledgement(launchContext, {
        state: "ready",
        uiHost,
    }, requestImpl);

module.exports = {
    FORGE_SUPERVISOR_TOKEN_ENV,
    FORGE_SUPERVISOR_TOKEN_HEADER,
    FORGE_SUPERVISOR_TOKEN_PATTERN,
    FORGE_SUPERVISOR_URL_ENV,
    assertAttachedKernelOptions,
    canReuseWorkspaceWindow,
    commandArgument,
    isValidKernelPort,
    resolveAttachKernelArgument,
    resolveForgeSupervisorContext,
    sameWorkspacePath,
    sendForgeLaunchAcknowledgement,
    sendForgeUIHostReady,
    shouldSpawnKernel,
};
