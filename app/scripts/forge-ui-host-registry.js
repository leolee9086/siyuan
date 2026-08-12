const {
    UI_HOST_ID_PATTERN,
    UI_HOST_TOKEN_HEADER,
    validateUIHostDescriptor,
    validateUIHostInvocation,
    validateUIHostStatus,
} = require("./forge-ui-host-contract");

const UI_HOST_RESPONSE_MAX_BYTES = 2 * 1024 * 1024;
const UI_HOST_REQUEST_TIMEOUT_MS = 3_000;

class UIHostControlError extends Error {
    constructor(errorCode, message, statusCode = 500, cause) {
        super(message, cause ? {cause} : undefined);
        this.name = "UIHostControlError";
        this.errorCode = errorCode;
        this.statusCode = statusCode;
    }
}

const readResponseJSON = async (response) => {
    const body = await response.text();
    if (Buffer.byteLength(body) > UI_HOST_RESPONSE_MAX_BYTES) {
        throw new Error("UI Host response is too large");
    }
    try {
        return JSON.parse(body || "{}");
    } catch (error) {
        throw new Error(`UI Host returned invalid JSON: ${error.message}`);
    }
};

const publicUIHostStatus = (record) => ({
    schemaVersion: record.descriptor.schemaVersion,
    id: record.descriptor.id,
    kind: record.descriptor.kind,
    platform: record.descriptor.platform,
    capabilities: [...record.descriptor.capabilities],
    state: record.state,
    registeredAt: record.registeredAt,
    lastSeenAt: record.lastSeenAt,
    lastError: record.lastError,
});

class UIHostRegistry {
    constructor({fetchImpl, now, onChange}) {
        this.fetchImpl = fetchImpl;
        this.now = now;
        this.onChange = onChange;
        this.hosts = new Map();
    }

    status() {
        return [...this.hosts.values()].map(publicUIHostStatus);
    }

    changed() {
        this.onChange?.();
    }

    async request(descriptor, route, init = {}) {
        let response;
        try {
            response = await this.fetchImpl(`${descriptor.controlURL}${route}`, {
                ...init,
                headers: {
                    [UI_HOST_TOKEN_HEADER]: descriptor.token,
                    ...init.headers,
                },
                signal: init.signal || AbortSignal.timeout(UI_HOST_REQUEST_TIMEOUT_MS),
            });
        } catch (error) {
            throw new UIHostControlError(
                "ui_host_offline",
                `UI Host is offline: ${descriptor.id}: ${error.message}`,
                503,
                error,
            );
        }
        try {
            return {response, payload: await readResponseJSON(response)};
        } catch (error) {
            throw new UIHostControlError(
                "ui_host_invalid_response",
                `UI Host returned an invalid response: ${descriptor.id}: ${error.message}`,
                502,
                error,
            );
        }
    }

    markOnline(record) {
        record.state = "online";
        record.lastSeenAt = this.now().toISOString();
        record.lastError = null;
    }

    markOffline(record, error) {
        record.state = "offline";
        record.lastError = error.message;
    }

    async probe(record) {
        try {
            const {response, payload} = await this.request(record.descriptor, "/status");
            if (!response.ok) {
                throw new UIHostControlError(
                    "ui_host_offline",
                    `UI Host status failed with HTTP ${response.status}: ${record.descriptor.id}`,
                    503,
                );
            }
            validateUIHostStatus(payload, record.descriptor);
            this.markOnline(record);
        } catch (error) {
            const failure = error instanceof UIHostControlError ? error : new UIHostControlError(
                "ui_host_offline",
                `UI Host status is invalid: ${record.descriptor.id}: ${error.message}`,
                503,
                error,
            );
            this.markOffline(record, failure);
        }
        return publicUIHostStatus(record);
    }

    async register(descriptor) {
        const validated = validateUIHostDescriptor(descriptor);
        const record = {
            descriptor: validated,
            registeredAt: this.now().toISOString(),
            lastSeenAt: null,
            lastError: null,
            state: "offline",
        };
        this.hosts.set(validated.id, record);
        const status = await this.probe(record);
        this.changed();
        return status;
    }

    async list() {
        const hosts = await Promise.all([...this.hosts.values()].map((record) => this.probe(record)));
        this.changed();
        return {hosts};
    }

    async invoke(request) {
        const keys = request && typeof request === "object" && !Array.isArray(request) ? Object.keys(request).sort() : [];
        if (keys.length < 2 || keys.length > 3 || keys[0] !== "capability" || keys[1] !== "hostId" ||
            (keys.length === 3 && keys[2] !== "input") || !UI_HOST_ID_PATTERN.test(request.hostId || "")) {
            throw new UIHostControlError("ui_host_invalid_request", "UI Host invocation request is invalid", 400);
        }
        const invocation = validateUIHostInvocation({capability: request.capability, input: request.input});
        if (this.hosts.size === 0) {
            throw new UIHostControlError("ui_host_absent", "No UI Host is registered", 409);
        }
        const record = this.hosts.get(request.hostId);
        if (!record) {
            throw new UIHostControlError("ui_host_not_found", `UI Host is not registered: ${request.hostId}`, 404);
        }
        if (!record.descriptor.capabilities.includes(invocation.capability)) {
            throw new UIHostControlError(
                "ui_host_capability_unavailable",
                `UI Host capability is unavailable: ${invocation.capability}`,
                409,
            );
        }
        let response;
        let payload;
        try {
            ({response, payload} = await this.request(record.descriptor, "/invoke", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(invocation),
            }));
        } catch (error) {
            this.markOffline(record, error);
            this.changed();
            throw error;
        }
        if (!response.ok) {
            const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : "ui_host_capability_failed";
            const message = typeof payload.error === "string" ? payload.error :
                `UI Host invocation failed with HTTP ${response.status}`;
            throw new UIHostControlError(errorCode, message, response.status);
        }
        if (!payload || payload.capability !== invocation.capability || !("result" in payload)) {
            throw new UIHostControlError("ui_host_invalid_response", "UI Host returned an invalid invocation response", 502);
        }
        this.markOnline(record);
        this.changed();
        return payload;
    }
}

const writeUIHostError = (response, error) => {
    const failure = error instanceof UIHostControlError ? error : new UIHostControlError(
        "ui_host_invalid_request",
        error instanceof Error ? error.message : String(error),
        400,
        error,
    );
    response.statusCode = failure.statusCode;
    response.end(JSON.stringify({errorCode: failure.errorCode, error: failure.message}));
};

module.exports = {
    UIHostControlError,
    UIHostRegistry,
    publicUIHostStatus,
    writeUIHostError,
};
