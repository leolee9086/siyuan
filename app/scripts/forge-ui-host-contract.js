const UI_HOST_SCHEMA_VERSION = 1;
const UI_HOST_TOKEN_HEADER = "x-s-forge-ui-host-token";
const UI_HOST_INSPECT_WINDOWS = "ui.windows.inspect";
const UI_HOST_MAX_REQUEST_BYTES = 64 * 1024;
const UI_HOST_ID_PATTERN = /^[a-zA-Z0-9_.-]{1,80}$/;
const UI_HOST_KIND_PATTERN = /^[a-z0-9][a-z0-9.-]{0,63}$/;
const UI_HOST_PLATFORM_PATTERN = /^[a-zA-Z0-9_.-]{1,64}$/;
const UI_HOST_CAPABILITY_PATTERN = /^[a-z][a-z0-9.-]{0,95}$/;
const UI_HOST_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const assertPlainObject = (value, message) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new Error(message);
    }
    return value;
};

const assertExactKeys = (value, expectedKeys, message) => {
    const keys = Object.keys(assertPlainObject(value, message)).sort();
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
        throw new Error(message);
    }
};

const normalizeUIHostCapabilities = (capabilities) => {
    if (!Array.isArray(capabilities) || capabilities.length === 0 || capabilities.length > 64) {
        throw new Error("UI Host capabilities are invalid");
    }
    const normalized = [...capabilities];
    if (normalized.some((capability) => typeof capability !== "string" ||
        !UI_HOST_CAPABILITY_PATTERN.test(capability))) {
        throw new Error("UI Host capabilities are invalid");
    }
    const sorted = [...normalized].sort();
    if (new Set(normalized).size !== normalized.length ||
        normalized.some((capability, index) => capability !== sorted[index])) {
        throw new Error("UI Host capabilities must be unique and sorted");
    }
    return normalized;
};

const normalizeUIHostControlURL = (controlURL) => {
    let parsed;
    try {
        parsed = new URL(controlURL);
    } catch (_error) {
        throw new Error("UI Host control URL is invalid");
    }
    if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || !parsed.port ||
        parsed.pathname !== "/" || parsed.username || parsed.password || parsed.search || parsed.hash) {
        throw new Error("UI Host control URL must be an exact IPv4 loopback origin");
    }
    return parsed.origin;
};

const validateUIHostDescriptor = (descriptor) => {
    assertExactKeys(descriptor, [
        "capabilities",
        "controlURL",
        "id",
        "kind",
        "platform",
        "schemaVersion",
        "token",
    ], "UI Host descriptor is invalid");
    if (descriptor.schemaVersion !== UI_HOST_SCHEMA_VERSION ||
        !UI_HOST_ID_PATTERN.test(descriptor.id || "") ||
        !UI_HOST_KIND_PATTERN.test(descriptor.kind || "") ||
        !UI_HOST_PLATFORM_PATTERN.test(descriptor.platform || "") ||
        !UI_HOST_TOKEN_PATTERN.test(descriptor.token || "")) {
        throw new Error("UI Host descriptor is invalid");
    }
    return {
        schemaVersion: UI_HOST_SCHEMA_VERSION,
        id: descriptor.id,
        kind: descriptor.kind,
        platform: descriptor.platform,
        capabilities: normalizeUIHostCapabilities(descriptor.capabilities),
        controlURL: normalizeUIHostControlURL(descriptor.controlURL),
        token: descriptor.token,
    };
};

const validateUIHostStatus = (status, descriptor) => {
    assertExactKeys(status, [
        "capabilities",
        "id",
        "kind",
        "platform",
        "schemaVersion",
        "state",
    ], "UI Host status is invalid");
    const capabilities = normalizeUIHostCapabilities(status.capabilities);
    if (status.schemaVersion !== UI_HOST_SCHEMA_VERSION || status.state !== "online" ||
        status.id !== descriptor.id || status.kind !== descriptor.kind ||
        status.platform !== descriptor.platform ||
        capabilities.length !== descriptor.capabilities.length ||
        capabilities.some((capability, index) => capability !== descriptor.capabilities[index])) {
        throw new Error("UI Host status does not match its descriptor");
    }
    return status;
};

const validateUIHostInvocation = (payload) => {
    const keys = Object.keys(assertPlainObject(payload, "UI Host invocation is invalid")).sort();
    if (keys.length < 1 || keys.length > 2 || keys[0] !== "capability" ||
        (keys.length === 2 && keys[1] !== "input") ||
        !UI_HOST_CAPABILITY_PATTERN.test(payload.capability || "")) {
        throw new Error("UI Host invocation is invalid");
    }
    return {
        capability: payload.capability,
        input: payload.input === undefined ? {} : payload.input,
    };
};

module.exports = {
    UI_HOST_CAPABILITY_PATTERN,
    UI_HOST_ID_PATTERN,
    UI_HOST_INSPECT_WINDOWS,
    UI_HOST_KIND_PATTERN,
    UI_HOST_MAX_REQUEST_BYTES,
    UI_HOST_PLATFORM_PATTERN,
    UI_HOST_SCHEMA_VERSION,
    UI_HOST_TOKEN_HEADER,
    UI_HOST_TOKEN_PATTERN,
    assertExactKeys,
    assertPlainObject,
    normalizeUIHostCapabilities,
    normalizeUIHostControlURL,
    validateUIHostDescriptor,
    validateUIHostInvocation,
    validateUIHostStatus,
};
