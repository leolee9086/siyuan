/** 用途：把 provider 声明式连接字段转换成 session 请求；使用范围：配置对话框与测试。 */
import type {
    FileBrowserProviderDescriptor,
    FileBrowserProviderSessionField,
    FileBrowserProviderSessionOpenRequest,
} from "./FileBrowser.types";

export type FileBrowserProviderSessionFormValues = Record<string, string | boolean>;

export function fileBrowserProviderFieldIdentity(field: FileBrowserProviderSessionField) {
    return `${field.target}:${field.key}`;
}

export function createFileBrowserProviderSessionFormValues(descriptor: FileBrowserProviderDescriptor) {
    const values: FileBrowserProviderSessionFormValues = {};
    for (const field of descriptor.sessionConfig?.fields ?? []) {
        values[fileBrowserProviderFieldIdentity(field)] = field.input === "checkbox" ?
            field.defaultValue === "true" : (field.defaultValue ?? "");
    }
    return values;
}

function normalizedFieldValue(field: FileBrowserProviderSessionField, value: string | boolean | undefined) {
    if (field.input === "checkbox") {
        return value === true;
    }
    const text = typeof value === "string" ? value : "";
    return field.input === "password" ? text : text.trim();
}

function hasFieldValue(value: string | boolean) {
    return typeof value === "boolean" ? value : value.length > 0;
}

function endpointSessionLabel(endpoint: string, fallback: string) {
    try {
        const url = new URL(endpoint);
        const path = url.pathname.replace(/^\/+|\/+$/g, "");
        return path ? `${url.host}/${decodeURIComponent(path)}` : url.host;
    } catch {
        return fallback;
    }
}

/** 构造一次连接请求；凭据与 options 按 target 分开，未知字段不会进入请求。 */
export function buildFileBrowserProviderSessionRequest(
    descriptor: FileBrowserProviderDescriptor,
    values: FileBrowserProviderSessionFormValues,
    readOnly: boolean,
    insecureHTTPConfirmed: boolean,
) {
    const config = descriptor.sessionConfig;
    if (descriptor.sessionMode !== "configured" || !config) {
        throw new Error("文件 provider 没有可用的连接配置");
    }
    const resolved = new Map<string, string | boolean>();
    for (const field of config.fields) {
        const value = normalizedFieldValue(field, values[fileBrowserProviderFieldIdentity(field)]);
        resolved.set(fileBrowserProviderFieldIdentity(field), value);
        if (field.required && !hasFieldValue(value)) {
            throw new Error(`请填写${field.label}`);
        }
    }
    for (const field of config.fields) {
        const value = resolved.get(fileBrowserProviderFieldIdentity(field)) ?? "";
        if (!hasFieldValue(value)) {
            continue;
        }
        for (const dependency of field.requiredWith ?? []) {
            const required = resolved.get(`${field.target}:${dependency}`) ?? "";
            if (!hasFieldValue(required)) {
                const label = config.fields.find(candidate =>
                    candidate.target === field.target && candidate.key === dependency)?.label ?? dependency;
                throw new Error(`${field.label}需要同时填写${label}`);
            }
        }
    }

    let endpoint = "";
    const credentials: Record<string, unknown> = {};
    const options: Record<string, unknown> = {};
    for (const field of config.fields) {
        const value = resolved.get(fileBrowserProviderFieldIdentity(field)) ?? "";
        if (field.target === "endpoint") {
            endpoint = String(value);
        } else if (field.target === "credential") {
            if (hasFieldValue(value)) {
                credentials[field.key] = value;
            }
        } else if (field.input === "checkbox" || hasFieldValue(value)) {
            options[field.key] = value;
        }
    }

    let endpointURL: URL;
    try {
        endpointURL = new URL(endpoint);
    } catch {
        throw new Error("连接地址格式错误");
    }
    if (config.endpointTransport === "https-or-confirmed-private-http" && endpointURL.protocol === "http:" &&
        !insecureHTTPConfirmed) {
        throw new Error("请确认本次连接将通过未加密 HTTP 传输凭据");
    }
    const request: FileBrowserProviderSessionOpenRequest = {
        provider: descriptor.id,
        endpoint,
        ...(Object.keys(credentials).length > 0 ? {credentials} : {}),
        ...(Object.keys(options).length > 0 ? {options} : {}),
        ...(config.readOnly ? {readOnly} : {}),
        ...(endpointURL.protocol === "http:" && insecureHTTPConfirmed ? {insecureHTTPConfirmed: true} : {}),
    };
    return {
        request,
        label: endpointSessionLabel(endpoint, descriptor.sessionLabel ?? descriptor.displayName),
    };
}
