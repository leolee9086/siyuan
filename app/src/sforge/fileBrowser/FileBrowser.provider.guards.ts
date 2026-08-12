/** 用途：外部文件 provider 响应校验；使用范围：provider 仓储边界。 */
import {isFileBrowserPreviewKind, isRecord} from "./FileBrowser.guards";
import type {
    FileBrowserProviderDescriptor,
    FileBrowserProviderDirectoryPage,
    FileBrowserProviderEntry,
    FileBrowserProviderEntryAddress,
    FileBrowserProviderEntryStat,
    FileBrowserProviderPageRequest,
    FileBrowserProviderResource,
    FileBrowserProviderResourceAddress,
    FileBrowserProviderResourcePage,
    FileBrowserProviderRevision,
    FileBrowserProviderSession,
    FileBrowserProviderSessionAddress,
    FileBrowserProviderSessionConfig,
    FileBrowserProviderSessionField,
    FileBrowserProviderSource,
} from "./FileBrowser.types";

function nonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function finiteNonNegativeInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function stringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(item => nonEmptyString(item));
}

function optionalStringMap(value: unknown): value is Record<string, string> | undefined {
    return value === undefined || (isRecord(value) && Object.values(value).every(item => typeof item === "string"));
}

function providerSource(value: unknown): value is FileBrowserProviderSource {
    return isRecord(value) && nonEmptyString(value.name) && nonEmptyString(value.kind) &&
        optionalStringMap(value.metadata) && value.id === undefined && value.fingerprint === undefined;
}

function providerSessionField(value: unknown): value is FileBrowserProviderSessionField {
    if (!isRecord(value) || !nonEmptyString(value.key) || !nonEmptyString(value.label) ||
        (value.target !== "endpoint" && value.target !== "credential" && value.target !== "option") ||
        (value.input !== "text" && value.input !== "password" && value.input !== "url" && value.input !== "checkbox") ||
        (value.required !== undefined && typeof value.required !== "boolean") ||
        (value.requiredWith !== undefined && !stringArray(value.requiredWith)) ||
        (value.placeholder !== undefined && typeof value.placeholder !== "string") ||
        (value.defaultValue !== undefined && typeof value.defaultValue !== "string") ||
        (value.autocomplete !== undefined && typeof value.autocomplete !== "string")) {
        return false;
    }
    return value.target !== "endpoint" || value.key === "endpoint";
}

function providerSessionConfig(value: unknown): value is FileBrowserProviderSessionConfig {
    if (!isRecord(value) || !Array.isArray(value.fields) || value.fields.length === 0 ||
        !value.fields.every(providerSessionField) ||
        (value.readOnly !== undefined && typeof value.readOnly !== "boolean") ||
        (value.endpointTransport !== undefined &&
            value.endpointTransport !== "https-or-confirmed-private-http")) {
        return false;
    }
    const identities = value.fields.map(field => `${field.target}\u0000${field.key}`);
    if (new Set(identities).size !== identities.length) {
        return false;
    }
    const keysByTarget = new Map<string, Set<string>>();
    for (const field of value.fields) {
        const keys = keysByTarget.get(field.target) ?? new Set<string>();
        keys.add(field.key);
        keysByTarget.set(field.target, keys);
    }
    return value.fields.every(field => (field.requiredWith ?? []).every(key =>
        key !== field.key && keysByTarget.get(field.target)?.has(key) === true));
}

function providerDescriptor(value: unknown): value is FileBrowserProviderDescriptor {
    return isRecord(value) && nonEmptyString(value.id) && nonEmptyString(value.displayName) &&
        nonEmptyString(value.kind) && stringArray(value.capabilities) &&
        (value.sessionMode === "none" || value.sessionMode === "automatic" || value.sessionMode === "configured") &&
        (value.sessionMode === "none" ? value.sessionLabel === undefined && value.sessionConfig === undefined :
            nonEmptyString(value.sessionLabel)) &&
        (value.sessionMode === "configured" ? providerSessionConfig(value.sessionConfig) :
            value.sessionConfig === undefined);
}

function sameSession(
    value: Pick<FileBrowserProviderSessionAddress, "provider" | "session">,
    expected: Pick<FileBrowserProviderSessionAddress, "provider" | "session">,
) {
    return value.provider === expected.provider && value.session === expected.session;
}

function sameResource(
    value: Pick<FileBrowserProviderResourceAddress, "provider" | "session" | "resource">,
    expected: Pick<FileBrowserProviderResourceAddress, "provider" | "session" | "resource">,
) {
    return sameSession(value, expected) && value.resource === expected.resource;
}

export function parseFileBrowserProviderDescriptors(value: unknown): FileBrowserProviderDescriptor[] {
    if (!Array.isArray(value) || !value.every(providerDescriptor)) {
        throw new Error("文件 provider 列表响应格式错误");
    }
    const ids = new Set(value.map(item => item.id));
    if (ids.size !== value.length) {
        throw new Error("文件 provider 列表包含重复 ID");
    }
    return value;
}

export function parseFileBrowserProviderSession(
    value: unknown,
    expectedProvider: string,
): FileBrowserProviderSession {
    if (!isRecord(value) || value.provider !== expectedProvider || !nonEmptyString(value.session) ||
        typeof value.readOnly !== "boolean" || !providerDescriptor(value.descriptor) ||
        value.descriptor.id !== expectedProvider) {
        throw new Error("文件 provider 会话响应格式错误");
    }
    return {
        address: {kind: "provider-session", provider: value.provider, session: value.session},
        label: value.descriptor.sessionLabel ?? value.descriptor.displayName,
        readOnly: value.readOnly,
        descriptor: value.descriptor,
    };
}

function parseProviderResource(value: unknown, session: FileBrowserProviderSessionAddress): FileBrowserProviderResource {
    if (!isRecord(value) || value.provider !== session.provider || value.session !== session.session ||
        !nonEmptyString(value.id) || !nonEmptyString(value.name) || !nonEmptyString(value.kind) ||
        typeof value.readOnly !== "boolean" || !stringArray(value.capabilities) || !providerSource(value.source) ||
        (value.aliases !== undefined && (!Array.isArray(value.aliases) || !value.aliases.every(alias =>
            isRecord(alias) && nonEmptyString(alias.kind) && nonEmptyString(alias.label))))) {
        throw new Error("文件 provider 资源响应格式错误");
    }
    return {
        id: value.id,
        name: value.name,
        kind: value.kind,
        readOnly: value.readOnly,
        capabilities: value.capabilities,
        source: value.source,
        address: {
            kind: "provider-resource",
            provider: session.provider,
            session: session.session,
            resource: value.id,
        },
        ...(value.aliases === undefined ? {} : {aliases: value.aliases}),
    };
}

function validatePage(value: Record<string, unknown>, page: FileBrowserProviderPageRequest, label: string) {
    if (!finiteNonNegativeInteger(value.limit) || typeof value.hasMore !== "boolean" ||
        (value.nextCursor !== undefined && typeof value.nextCursor !== "string") ||
        (value.hasMore && !nonEmptyString(value.nextCursor)) ||
        (page.limit > 0 && value.limit !== page.limit)) {
        throw new Error(`${label}分页响应格式错误`);
    }
}

export function parseFileBrowserProviderResourcePage(
    value: unknown,
    session: FileBrowserProviderSessionAddress,
    request: FileBrowserProviderPageRequest,
): FileBrowserProviderResourcePage {
    if (!isRecord(value) || !Array.isArray(value.resources) ||
        (value.total !== undefined && !finiteNonNegativeInteger(value.total))) {
        throw new Error("文件 provider 资源分页响应格式错误");
    }
    validatePage(value, request, "文件 provider 资源");
    const resources = value.resources.map(item => parseProviderResource(item, session));
    if (new Set(resources.map(item => item.id)).size !== resources.length) {
        throw new Error("文件 provider 资源分页包含重复 ID");
    }
    return {
        resources,
        ...(value.total === undefined ? {} : {total: value.total}),
        limit: value.limit as number,
        ...(nonEmptyString(value.nextCursor) ? {nextCursor: value.nextCursor} : {}),
        hasMore: value.hasMore as boolean,
    };
}

function providerRevision(value: unknown): value is FileBrowserProviderRevision {
    return isRecord(value) &&
        (value.etag === undefined || typeof value.etag === "string") &&
        (value.versionID === undefined || typeof value.versionID === "string") &&
        (value.modifiedAt === undefined || typeof value.modifiedAt === "string") &&
        (value.size === undefined || finiteNonNegativeInteger(value.size));
}

function validateContentURL(value: string, address: FileBrowserProviderEntryAddress) {
    const url = new URL(value, "http://sforge.local");
    const expected = new Map([
        ["provider", address.provider], ["session", address.session],
        ["resource", address.resource], ["token", address.token],
    ]);
    if (url.origin !== "http://sforge.local" || url.pathname !== "/api/s-forge/file-browser/provider/content" ||
        [...url.searchParams.keys()].length !== expected.size ||
        [...expected].some(([key, expectedValue]) => url.searchParams.getAll(key).length !== 1 ||
            url.searchParams.get(key) !== expectedValue)) {
        throw new Error("文件 provider 内容地址与条目地址不一致");
    }
}

function parseProviderEntry(
    value: unknown,
    parent: FileBrowserProviderResourceAddress | FileBrowserProviderEntryAddress,
): FileBrowserProviderEntry {
    const validKind = (kind: unknown) => kind === "file" || kind === "directory" || kind === "object" || kind === "bucket";
    if (!isRecord(value) || !nonEmptyString(value.id) || !nonEmptyString(value.name) || !validKind(value.kind) ||
        typeof value.isDir !== "boolean" || !finiteNonNegativeInteger(value.size) ||
        !finiteNonNegativeInteger(value.modified) || !finiteNonNegativeInteger(value.created) ||
        (value.extension !== undefined && typeof value.extension !== "string") ||
        (value.mediaType !== undefined && typeof value.mediaType !== "string") || !providerRevision(value.revision) ||
        !optionalStringMap(value.metadata) || !isRecord(value.address) ||
        value.address.provider !== parent.provider || !nonEmptyString(value.address.token) ||
        value.address.name !== value.name || !isFileBrowserPreviewKind(value.previewKind) ||
        (value.isDir !== (value.kind === "directory" || value.kind === "bucket")) ||
        (value.isDir !== (value.previewKind === "directory")) ||
        (value.contentURL !== undefined && typeof value.contentURL !== "string") ||
        (!value.isDir && !nonEmptyString(value.contentURL))) {
        throw new Error("文件 provider 条目响应格式错误");
    }
    const address: FileBrowserProviderEntryAddress = {
        kind: "provider-entry",
        provider: parent.provider,
        session: parent.session,
        resource: parent.resource,
        token: value.address.token,
    };
    if (!value.isDir) {
        validateContentURL(value.contentURL as string, address);
    }
    return {
        id: value.id,
        name: value.name,
        kind: value.kind,
        isDir: value.isDir,
        size: value.size,
        modified: value.modified,
        created: value.created,
        ...(value.extension === undefined ? {} : {extension: value.extension}),
        ...(value.mediaType === undefined ? {} : {mediaType: value.mediaType}),
        revision: value.revision,
        ...(value.metadata === undefined ? {} : {metadata: value.metadata}),
        address,
        previewKind: value.previewKind,
        ...(value.contentURL === undefined ? {} : {contentURL: value.contentURL}),
    };
}

export function parseFileBrowserProviderDirectoryPage(
    value: unknown,
    parent: FileBrowserProviderResourceAddress | FileBrowserProviderEntryAddress,
    request: FileBrowserProviderPageRequest,
): FileBrowserProviderDirectoryPage {
    if (!isRecord(value) || !Array.isArray(value.entries) || !finiteNonNegativeInteger(value.total) ||
        typeof value.totalKnown !== "boolean") {
        throw new Error("文件 provider 目录分页响应格式错误");
    }
    validatePage(value, request, "文件 provider 目录");
    const entries = value.entries.map(item => parseProviderEntry(item, parent));
    if (new Set(entries.map(item => item.address.token)).size !== entries.length) {
        throw new Error("文件 provider 目录分页包含重复条目地址");
    }
    return {
        parent,
        entries,
        total: value.total,
        totalKnown: value.totalKnown,
        limit: value.limit as number,
        ...(nonEmptyString(value.nextCursor) ? {nextCursor: value.nextCursor} : {}),
        hasMore: value.hasMore as boolean,
    };
}

export function parseFileBrowserProviderEntryStat(
    value: unknown,
    address: FileBrowserProviderEntryAddress,
): FileBrowserProviderEntryStat {
    const entry = parseProviderEntry(value, address);
    if (entry.address.token !== address.token || !isRecord(value) || !nonEmptyString(value.revisionValue)) {
        throw new Error("文件 provider 条目统计响应与请求地址不一致");
    }
    return {...entry, revisionValue: value.revisionValue};
}

export function assertClosedProviderSession(value: unknown, address: FileBrowserProviderSessionAddress) {
    if (!isRecord(value) || value.closed !== true || !sameSession({
        provider: String(value.provider ?? ""), session: String(value.session ?? ""),
    }, address)) {
        throw new Error("关闭文件 provider 会话响应格式错误");
    }
}

export function assertProviderParentAddress(
    child: FileBrowserProviderEntryAddress,
    parent: FileBrowserProviderResourceAddress | FileBrowserProviderEntryAddress,
) {
    if (!sameResource(child, parent)) {
        throw new Error("文件 provider 条目跨越了请求资源边界");
    }
}
