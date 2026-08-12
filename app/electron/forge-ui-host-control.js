const crypto = require("crypto");
const http = require("http");
const {
    UI_HOST_INSPECT_WINDOWS,
    UI_HOST_MAX_REQUEST_BYTES,
    UI_HOST_SCHEMA_VERSION,
    UI_HOST_TOKEN_HEADER,
    normalizeUIHostCapabilities,
    validateUIHostDescriptor,
    validateUIHostInvocation,
} = require("../scripts/forge-ui-host-contract");

const isLoopbackAddress = (address) => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address);

const timingSafeTokenEqual = (actual, expected) => {
    const actualBuffer = Buffer.from(String(actual || ""));
    const expectedBuffer = Buffer.from(String(expected || ""));
    return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
};

const readRequestJSON = (request) => new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
        body += chunk;
        if (Buffer.byteLength(body) > UI_HOST_MAX_REQUEST_BYTES) {
            reject(new Error("UI Host request is too large"));
            request.destroy();
        }
    });
    request.once("end", () => {
        try {
            resolve(JSON.parse(body || "{}"));
        } catch (error) {
            reject(new Error(`UI Host request contains invalid JSON: ${error.message}`));
        }
    });
    request.once("error", reject);
});

const normalizeCapabilityHandlers = (handlers) => {
    if (!handlers || typeof handlers !== "object" || Array.isArray(handlers)) {
        throw new Error("UI Host capability handlers are required");
    }
    const capabilities = Object.keys(handlers).sort();
    if (capabilities.some((capability) => typeof handlers[capability] !== "function")) {
        throw new Error("UI Host capability handlers are invalid");
    }
    return normalizeUIHostCapabilities(capabilities);
};

const writeJSON = (response, statusCode, payload) => {
    response.statusCode = statusCode;
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.end(JSON.stringify(payload));
};

const createForgeUIHostControl = async ({
    hostId = `electron-${process.pid}-${crypto.randomBytes(8).toString("hex")}`,
    kind = "electron",
    platform = process.platform,
    capabilityHandlers,
    token = crypto.randomBytes(32).toString("hex"),
    createServer = http.createServer,
} = {}) => {
    const capabilities = normalizeCapabilityHandlers(capabilityHandlers);
    const provisionalDescriptor = validateUIHostDescriptor({
        schemaVersion: UI_HOST_SCHEMA_VERSION,
        id: hostId,
        kind,
        platform,
        capabilities,
        controlURL: "http://127.0.0.1:1",
        token,
    });
    const server = createServer((request, response) => {
        if (!isLoopbackAddress(request.socket.remoteAddress) ||
            !timingSafeTokenEqual(request.headers[UI_HOST_TOKEN_HEADER], token)) {
            writeJSON(response, 401, {errorCode: "ui_host_unauthorized", error: "invalid UI Host credential"});
            return;
        }
        if (request.method === "GET" && request.url === "/status") {
            writeJSON(response, 200, {
                schemaVersion: UI_HOST_SCHEMA_VERSION,
                id: hostId,
                kind,
                platform,
                capabilities,
                state: "online",
            });
            return;
        }
        if (request.method !== "POST" || request.url !== "/invoke") {
            writeJSON(response, 404, {errorCode: "ui_host_endpoint_not_found", error: "unknown UI Host endpoint"});
            return;
        }
        void readRequestJSON(request).then(async (payload) => {
            let invocation;
            try {
                invocation = validateUIHostInvocation(payload);
            } catch (_error) {
                writeJSON(response, 400, {errorCode: "ui_host_invalid_request", error: "invalid UI Host invocation"});
                return;
            }
            const handler = capabilityHandlers[invocation.capability];
            if (!handler) {
                writeJSON(response, 409, {
                    errorCode: "ui_host_capability_unavailable",
                    error: `UI Host capability is unavailable: ${invocation.capability}`,
                });
                return;
            }
            try {
                const result = await handler(invocation.input);
                writeJSON(response, 200, {capability: invocation.capability, result});
            } catch (error) {
                writeJSON(response, 500, {
                    errorCode: "ui_host_capability_failed",
                    error: error instanceof Error ? error.message : String(error),
                });
            }
        }).catch((error) => {
            writeJSON(response, 400, {errorCode: "ui_host_invalid_request", error: error.message});
        });
    });
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("UI Host control server did not expose a TCP address");
    }
    server.unref?.();
    const descriptor = validateUIHostDescriptor({
        ...provisionalDescriptor,
        controlURL: `http://127.0.0.1:${address.port}`,
    });
    let closed = false;
    return {
        descriptor,
        close: () => new Promise((resolve, reject) => {
            if (closed || !server.listening) {
                closed = true;
                resolve();
                return;
            }
            server.close((error) => {
                closed = true;
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        }),
    };
};

const windowID = (window) => Number.isInteger(window?.id) ? window.id : null;

const classifyWindow = (window, workspaces, magiWindows, bootWindows) => {
    const workspace = workspaces.find((item) => item.browserWindow === window);
    if (workspace) {
        return {type: "workspace", workspace};
    }
    if ([...magiWindows.values()].includes(window)) {
        return {type: "magi"};
    }
    if (bootWindows.includes(window)) {
        return {type: "boot"};
    }
    return {type: "other"};
};

const rendererState = (webContents, startup) => {
    if (!webContents || webContents.isDestroyed()) {
        return "destroyed";
    }
    if (typeof webContents.isCrashed === "function" && webContents.isCrashed()) {
        return "crashed";
    }
    if (webContents.isLoading()) {
        return "loading";
    }
    if (startup?.rendererReadyAt) {
        return "ready";
    }
    if (startup?.didFinishLoadAt) {
        return "loaded_not_ready";
    }
    return "created";
};

const inspectElectronWindow = (window, classification) => {
    const webContents = window.webContents;
    const startup = classification.workspace?.startupDiagnostics || null;
    return {
        id: windowID(window),
        type: classification.type,
        title: window.getTitle(),
        url: webContents && !webContents.isDestroyed() ? webContents.getURL() || null : null,
        visible: window.isVisible(),
        focused: window.isFocused(),
        minimized: window.isMinimized(),
        maximized: window.isMaximized(),
        fullScreen: window.isFullScreen(),
        renderer: {
            id: webContents && !webContents.isDestroyed() ? webContents.id : null,
            state: rendererState(webContents, startup),
            loading: webContents && !webContents.isDestroyed() ? webContents.isLoading() : false,
        },
        workspace: classification.workspace ? {
            path: classification.workspace.workspaceDir,
            port: Number(classification.workspace.port),
        } : null,
        startup,
    };
};

const inspectElectronWindows = ({BrowserWindow, workspaces, magiWindows, bootWindows}) => {
    const windows = BrowserWindow.getAllWindows();
    return {
        capturedAt: new Date().toISOString(),
        processId: process.pid,
        windows: windows.map((window) => {
            const classification = classifyWindow(window, workspaces, magiWindows, bootWindows);
            try {
                return inspectElectronWindow(window, classification);
            } catch (error) {
                return {
                    id: windowID(window),
                    type: classification.type,
                    inspectionError: error instanceof Error ? error.message : String(error),
                };
            }
        }),
    };
};

const createElectronWindowInspectHandler = ({BrowserWindow, getWorkspaces, getMagiWindows, getBootWindows}) =>
    async (input) => {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length !== 0) {
            throw new Error("ui.windows.inspect does not accept input fields");
        }
        return inspectElectronWindows({
            BrowserWindow,
            workspaces: getWorkspaces(),
            magiWindows: getMagiWindows(),
            bootWindows: getBootWindows(),
        });
    };

module.exports = {
    UI_HOST_INSPECT_WINDOWS,
    createForgeUIHostControl,
    createElectronWindowInspectHandler,
    inspectElectronWindows,
    isLoopbackAddress,
    timingSafeTokenEqual,
};
