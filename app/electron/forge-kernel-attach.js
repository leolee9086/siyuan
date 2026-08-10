const http = require("http");
const path = require("path");

const FORGE_LAUNCH_ACK_URL_ENV = "S_FORGE_LAUNCH_ACK_URL";
const FORGE_LAUNCH_ACK_TOKEN_ENV = "S_FORGE_LAUNCH_ACK_TOKEN";
const FORGE_LAUNCH_ACK_HEADER = "x-s-forge-launch-token";
const FORGE_TOKEN_PATTERN = /^[0-9a-f]{64}$/;

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

const resolveForgeLaunchContext = (env = process.env) => {
    const acknowledgementURL = String(env[FORGE_LAUNCH_ACK_URL_ENV] || "").trim();
    const acknowledgementToken = String(env[FORGE_LAUNCH_ACK_TOKEN_ENV] || "").trim();
    if (!acknowledgementURL && !acknowledgementToken) {
        return {acknowledgement: undefined};
    }
    if (!FORGE_TOKEN_PATTERN.test(acknowledgementToken)) {
        return {error: "Forge launch acknowledgement token is invalid."};
    }
    let parsed;
    try {
        parsed = new URL(acknowledgementURL);
    } catch (_error) {
        return {error: "Forge launch acknowledgement URL is invalid."};
    }
    if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || !parsed.port ||
        parsed.pathname !== "/ready" || parsed.username || parsed.password || parsed.search || parsed.hash) {
        return {error: "Forge launch acknowledgement must use an exact loopback URL."};
    }
    return {
        acknowledgement: {url: parsed.toString(), token: acknowledgementToken},
    };
};

const sendForgeLaunchAcknowledgement = (launchContext, payload, requestImpl = http.request) => new Promise((resolve, reject) => {
    if (!launchContext?.acknowledgement) {
        resolve(false);
        return;
    }
    const body = JSON.stringify(payload);
    const request = requestImpl(launchContext.acknowledgement.url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            [FORGE_LAUNCH_ACK_HEADER]: launchContext.acknowledgement.token,
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

module.exports = {
    FORGE_LAUNCH_ACK_HEADER,
    FORGE_LAUNCH_ACK_TOKEN_ENV,
    FORGE_LAUNCH_ACK_URL_ENV,
    FORGE_TOKEN_PATTERN,
    assertAttachedKernelOptions,
    canReuseWorkspaceWindow,
    commandArgument,
    isValidKernelPort,
    resolveAttachKernelArgument,
    resolveForgeLaunchContext,
    sameWorkspacePath,
    sendForgeLaunchAcknowledgement,
    shouldSpawnKernel,
};
