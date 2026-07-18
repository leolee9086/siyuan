import { reactive, readonly } from "vue";
import { getSafeSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const MAGI_IDENTITY_API_ROOT = "/api/s-forge/magi/v1/identity";
export const MAGI_IDENTITY_REQUIRED_EVENT = "magi:identity-required";
export const MAGI_IDENTITY_SESSION_CHANGED_EVENT = "magi:identity-session-changed";
export const MAGI_WRITE_AVATAR_EVENT = "magi:write-avatar";

export type MagiRouteClass = "guardian" | "avatar-only";
export type MagiRequestChannel =
    | "magi-main-ui"
    | "tool-claude-code"
    | "tool-openai-sdk"
    | "tool-claude-sdk"
    | "tool-custom"
    | "system-cron";

export interface MagiChannelBinding {
    channelId: string;
    accountId: string;
    userId: string;
}

export interface MagiIdentityView {
    identityId: string;
    displayName: string;
    nickname?: string;
    routeClass: MagiRouteClass;
    enabled: boolean;
    createdAt: number;
    updatedAt: number;
    tokenExpiresSeconds?: number;
    usageCount?: number;
    channelBindings?: MagiChannelBinding[];
}

export interface MagiArmorSession {
    armorToken: string;
    expiresAt: number;
    identityId: string;
    displayName: string;
    routeClass: MagiRouteClass;
    channel: MagiRequestChannel;
    nickname: string;
}

export interface MagiIdentityStats {
    totalIdentities: number;
    enabledCount: number;
    totalUsage: number;
    identities: Array<{
        identityId: string;
        displayName: string;
        routeClass: string;
        enabled: boolean;
        usageCount: number;
        createdAt: number;
    }>;
}

interface MagiIdentitySessionState {
    identities: MagiIdentityView[];
    loading: boolean;
    activeSession: MagiArmorSession | null;
    lastError: string | null;
}

const magiIdentitySessionState = reactive<MagiIdentitySessionState>({
    identities: [],
    loading: false,
    activeSession: null,
    lastError: null,
});
let identitySessionExpiryTimer = 0;

const MAGI_IDENTITY_SYNC_CHANNEL = "siyuan:magi-identity-session";
const identitySessionSyncSender = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
let identitySessionSyncChannel: BroadcastChannel | null = null;
let identityAccessRequestedUntil = 0;

type MagiIdentitySyncMessage = {
    type: "request" | "session" | "identity-required";
    sender: string;
    session?: MagiArmorSession | null;
};

function normalizeSyncedMagiArmorSession(value: unknown): MagiArmorSession | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const armorToken = String(Reflect.get(value, "armorToken") ?? "").trim();
    const identityId = String(Reflect.get(value, "identityId") ?? "").trim();
    const displayName = String(Reflect.get(value, "displayName") ?? identityId).trim();
    const nickname = String(Reflect.get(value, "nickname") ?? "").trim();
    const routeClass = String(Reflect.get(value, "routeClass") ?? "").trim();
    const channel = String(Reflect.get(value, "channel") ?? "").trim();
    const expiresAt = Number(Reflect.get(value, "expiresAt") ?? 0);
    const validChannels: MagiRequestChannel[] = [
        "magi-main-ui",
        "tool-claude-code",
        "tool-openai-sdk",
        "tool-claude-sdk",
        "tool-custom",
        "system-cron",
    ];
    if (!armorToken || !identityId || !nickname || expiresAt <= Date.now()) {
        return null;
    }
    if (routeClass !== "guardian" && routeClass !== "avatar-only") {
        return null;
    }
    if (!validChannels.includes(channel as MagiRequestChannel)) {
        return null;
    }
    return {
        armorToken,
        identityId,
        displayName: displayName || identityId,
        nickname,
        routeClass,
        channel: channel as MagiRequestChannel,
        expiresAt,
    };
}

function resolveWorkspaceAPIToken(): string {
    try {
        const token = getSafeSiyuanConfig()?.api?.token;
        return String(token ?? "").trim();
    } catch {
        return "";
    }
}

function buildIdentityRequestHeaders(withJsonBody: boolean): Record<string, string> {
    const token = resolveWorkspaceAPIToken();
    const headers: Record<string, string> = {};
    if (withJsonBody) {
        headers["Content-Type"] = "application/json";
    }
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

function ensureIdentityResponseOK(
    response: Response,
    payload: unknown,
): void {
    if (response.ok) {
        return;
    }
    const errorText = typeof payload === "object" && payload !== null
        ? String(Reflect.get(payload, "error") ?? Reflect.get(payload, "msg") ?? `HTTP ${response.status}`)
        : `HTTP ${response.status}`;
    throw new Error(errorText);
}

function normalizeIdentityView(raw: unknown): MagiIdentityView | null {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const identityId = String(Reflect.get(raw, "identityId") ?? "").trim();
    const displayName = String(Reflect.get(raw, "displayName") ?? identityId).trim();
    const nickname = String(Reflect.get(raw, "nickname") ?? "").trim();
    const routeClass = String(Reflect.get(raw, "routeClass") ?? "").trim();
    const enabled = Boolean(Reflect.get(raw, "enabled"));
    const createdAt = Number(Reflect.get(raw, "createdAt") ?? 0);
    const updatedAt = Number(Reflect.get(raw, "updatedAt") ?? 0);
    const tokenExpiresSeconds = Number(Reflect.get(raw, "tokenExpiresSeconds") ?? 0);
    const usageCount = Number(Reflect.get(raw, "usageCount") ?? 0);
    if (!identityId || (routeClass !== "guardian" && routeClass !== "avatar-only")) {
        return null;
    }
	return {
		identityId,
		displayName: displayName || identityId,
		nickname: nickname || undefined,
		routeClass,
		enabled,
		createdAt,
		updatedAt,
		tokenExpiresSeconds: tokenExpiresSeconds > 0 ? tokenExpiresSeconds : undefined,
		usageCount: usageCount > 0 ? usageCount : undefined,
		channelBindings: normalizeChannelBindings(raw),
	};
}

function normalizeChannelBindings(raw: unknown): MagiChannelBinding[] | undefined {
	const rawBindings = Array.isArray(Reflect.get(raw as object, "channelBindings"))
		? Reflect.get(raw as object, "channelBindings") as unknown[]
		: [];
	const bindings: MagiChannelBinding[] = [];
	for (const rawB of rawBindings) {
		if (!rawB || typeof rawB !== "object") {
continue;
}
		const channelId = String(Reflect.get(rawB, "channelId") ?? "").trim();
		const accountId = String(Reflect.get(rawB, "accountId") ?? "").trim();
		const userId = String(Reflect.get(rawB, "userId") ?? "").trim();
		if (channelId && accountId && userId) {
			bindings.push({ channelId, accountId, userId });
		}
	}
	return bindings.length > 0 ? bindings : undefined;
}

function normalizeLoginSession(raw: unknown): MagiArmorSession {
    const identityObj = typeof raw === "object" && raw !== null
        ? Reflect.get(raw, "identity")
        : null;
    const identityId = String(
        (typeof identityObj === "object" && identityObj !== null
            ? Reflect.get(identityObj, "identity_id")
            : "") ?? "",
    ).trim();
    const displayName = String(
        (typeof identityObj === "object" && identityObj !== null
            ? Reflect.get(identityObj, "display_name")
            : identityId) ?? identityId,
    ).trim();
    const routeClass = String(
        (typeof identityObj === "object" && identityObj !== null
            ? Reflect.get(identityObj, "route_class")
            : "") ?? "",
    ).trim();
    const armorToken = String(
        (typeof raw === "object" && raw !== null
            ? Reflect.get(raw, "armor_token")
            : "") ?? "",
    ).trim();
    const channel = String(
        (typeof raw === "object" && raw !== null
            ? Reflect.get(raw, "channel")
            : "") ?? "",
    ).trim();
    const nickname = String(
        (typeof raw === "object" && raw !== null
            ? Reflect.get(raw, "nickname")
            : "") ?? "",
    ).trim();
    const expiresAt = Number(
        (typeof raw === "object" && raw !== null
            ? Reflect.get(raw, "expires_at")
            : 0) ?? 0,
    );

    if (!identityId || !armorToken || !channel || !nickname || !expiresAt) {
        throw new Error("invalid MAGI login response");
    }
    if (routeClass !== "guardian" && routeClass !== "avatar-only") {
        throw new Error("invalid route class in MAGI login response");
    }
    return {
        armorToken,
        expiresAt,
        identityId,
        displayName: displayName || identityId,
        routeClass,
        channel: channel as MagiRequestChannel,
        nickname,
    };
}

export async function listMagiIdentities(): Promise<MagiIdentityView[]> {
    const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/list`, {
        method: "POST",
        credentials: "include",
        headers: buildIdentityRequestHeaders(false),
    });
    const payload = await response.json().catch(() => ({}));
    ensureIdentityResponseOK(response, payload);
    const rawList = Array.isArray(Reflect.get(payload, "identities"))
        ? Reflect.get(payload, "identities") as unknown[]
        : [];
    const identities: MagiIdentityView[] = [];
    for (const raw of rawList) {
        const identity = normalizeIdentityView(raw);
        if (identity) {
            identities.push(identity);
        }
    }
    identities.sort((a, b) => a.identityId.localeCompare(b.identityId));
    return identities;
}

export async function refreshMagiIdentities(): Promise<void> {
    magiIdentitySessionState.loading = true;
    magiIdentitySessionState.lastError = null;
    try {
        magiIdentitySessionState.identities = await listMagiIdentities();
    } catch (error) {
        magiIdentitySessionState.lastError = error instanceof Error ? error.message : String(error);
        throw error;
    } finally {
        magiIdentitySessionState.loading = false;
    }
}

export async function fetchMagiIdentityStats(): Promise<MagiIdentityStats> {
    const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/stats`, {
        method: "POST",
        credentials: "include",
        headers: buildIdentityRequestHeaders(false),
    });
    const payload = await response.json().catch(() => ({}));
    ensureIdentityResponseOK(response, payload);
    return payload as MagiIdentityStats;
}

export async function upsertMagiIdentity(input: {
    identityId: string;
    displayName: string;
    nickname?: string;
    password?: string;
    routeClass: MagiRouteClass;
    enabled: boolean;
    tokenExpiresSeconds?: number;
    channelBindings?: MagiChannelBinding[];
}): Promise<void> {
    const body: Record<string, unknown> = {
        identity_id: input.identityId,
        display_name: input.displayName,
        password: input.password ?? "",
        route_class: input.routeClass,
        enabled: input.enabled,
    };
    if (input.nickname) {
        body.nickname = input.nickname;
    }
    if (input.tokenExpiresSeconds && input.tokenExpiresSeconds > 0) {
        body.token_expires_seconds = input.tokenExpiresSeconds;
    }
    if (input.channelBindings && input.channelBindings.length > 0) {
        body.channel_bindings = input.channelBindings.map(b => ({
            channelId: b.channelId,
            accountId: b.accountId,
            userId: b.userId,
        }));
    }
    const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/upsert`, {
        method: "POST",
        credentials: "include",
        headers: buildIdentityRequestHeaders(true),
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    ensureIdentityResponseOK(response, payload);
    await refreshMagiIdentities();
}

export async function removeMagiIdentity(identityId: string): Promise<void> {
    const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/remove`, {
        method: "POST",
        credentials: "include",
        headers: buildIdentityRequestHeaders(true),
        body: JSON.stringify({ identity_id: identityId }),
    });
    const payload = await response.json().catch(() => ({}));
    ensureIdentityResponseOK(response, payload);
    await refreshMagiIdentities();
    if (magiIdentitySessionState.activeSession?.identityId === identityId) {
        clearActiveMagiArmorSession();
    }
}

export async function loginMagiIdentity(input: {
    identityId: string;
    password: string;
    nickname: string;
    channel: MagiRequestChannel;
    activate?: boolean;
    expiresInSeconds?: number;
}): Promise<MagiArmorSession> {
    const body: Record<string, unknown> = {
        identity_id: input.identityId,
        password: input.password,
        nickname: input.nickname,
        channel: input.channel,
    };
    if (input.expiresInSeconds && input.expiresInSeconds > 0) {
        body.expires_in_seconds = input.expiresInSeconds;
    }
    const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/login`, {
        method: "POST",
        credentials: "include",
        headers: buildIdentityRequestHeaders(true),
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    ensureIdentityResponseOK(response, payload);
    const session = normalizeLoginSession(payload);
    if (input.activate !== false) {
        setActiveMagiArmorSession(session);
    }
    return session;
}

function emitIdentitySessionChanged(): void {
    window.dispatchEvent(new CustomEvent(MAGI_IDENTITY_SESSION_CHANGED_EVENT));
}

function clearIdentitySessionExpiryTimer(): void {
    if (identitySessionExpiryTimer) {
        window.clearTimeout(identitySessionExpiryTimer);
        identitySessionExpiryTimer = 0;
    }
}

function publishMagiIdentitySession(session: MagiArmorSession | null): void {
    identitySessionSyncChannel?.postMessage({
        type: "session",
        sender: identitySessionSyncSender,
        session,
    } satisfies MagiIdentitySyncMessage);
}

function publishMagiIdentityAccessRequest(): void {
    identitySessionSyncChannel?.postMessage({
        type: "identity-required",
        sender: identitySessionSyncSender,
    } satisfies MagiIdentitySyncMessage);
}

function applyActiveMagiArmorSession(session: MagiArmorSession | null, publish: boolean): void {
    clearIdentitySessionExpiryTimer();
    magiIdentitySessionState.activeSession = session;
    if (session) {
        const delay = Math.max(0, session.expiresAt - Date.now());
        identitySessionExpiryTimer = window.setTimeout(() => clearActiveMagiArmorSession(), delay);
    }
    emitIdentitySessionChanged();
    if (publish) {
        publishMagiIdentitySession(session);
    }
}

export function setActiveMagiArmorSession(session: MagiArmorSession | null): void {
    applyActiveMagiArmorSession(session, true);
}

export function clearActiveMagiArmorSession(): void {
    clearIdentitySessionExpiryTimer();
    if (!magiIdentitySessionState.activeSession) {
        return;
    }
    applyActiveMagiArmorSession(null, true);
}

export function getActiveMagiArmorSession(): MagiArmorSession | null {
    const activeSession = magiIdentitySessionState.activeSession;
    if (!activeSession) {
        return null;
    }
    if (activeSession.expiresAt <= Date.now()) {
        clearActiveMagiArmorSession();
        return null;
    }
    return activeSession;
}

export function getActiveMagiArmorToken(): string {
    return getActiveMagiArmorSession()?.armorToken ?? "";
}

export function requestMagiIdentityAccess(): void {
    identityAccessRequestedUntil = Date.now() + 15_000;
    window.dispatchEvent(new CustomEvent(MAGI_IDENTITY_REQUIRED_EVENT));
    publishMagiIdentityAccessRequest();
}

function initializeMagiIdentitySessionSync(): void {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") {
        return;
    }
    try {
        identitySessionSyncChannel = new BroadcastChannel(MAGI_IDENTITY_SYNC_CHANNEL);
        identitySessionSyncChannel.onmessage = (event: MessageEvent<MagiIdentitySyncMessage>) => {
            const message = event.data;
            if (!message || message.sender === identitySessionSyncSender) {
                return;
            }
            if (message.type === "request") {
                const session = getActiveMagiArmorSession();
                if (session) {
                    publishMagiIdentitySession(session);
                }
                if (identityAccessRequestedUntil > Date.now()) {
                    publishMagiIdentityAccessRequest();
                }
                return;
            }
            if (message.type === "identity-required") {
                window.dispatchEvent(new CustomEvent(MAGI_IDENTITY_REQUIRED_EVENT));
                return;
            }
            if (message.type !== "session") {
                return;
            }
            if (message.session === null) {
                if (magiIdentitySessionState.activeSession) {
                    applyActiveMagiArmorSession(null, false);
                }
                return;
            }
            const session = normalizeSyncedMagiArmorSession(message.session);
            if (session) {
                applyActiveMagiArmorSession(session, false);
            }
        };
        identitySessionSyncChannel.postMessage({
            type: "request",
            sender: identitySessionSyncSender,
        } satisfies MagiIdentitySyncMessage);
    } catch {
        identitySessionSyncChannel = null;
    }
}

initializeMagiIdentitySessionSync();

export async function issueAvatarToken(input: {
    identityId: string;
    channel: MagiRequestChannel;
    expiresInSeconds?: number;
    documentId?: string;
}): Promise<MagiArmorSession> {
    const body: Record<string, unknown> = {
        identity_id: input.identityId,
        channel: input.channel,
    };
    if (input.expiresInSeconds && input.expiresInSeconds > 0) {
        body.expires_in_seconds = input.expiresInSeconds;
    }
    if (input.documentId) {
        body.document_id = input.documentId;
    }
    const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/issue-avatar-token`, {
        method: "POST",
        credentials: "include",
        headers: buildIdentityRequestHeaders(true),
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    ensureIdentityResponseOK(response, payload);
    return normalizeLoginSession(payload);
}

export async function bindChannelIdentity(identityId: string, bindings: MagiChannelBinding[]): Promise<void> {
	const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/channel-bind`, {
		method: "POST",
		credentials: "include",
		headers: buildIdentityRequestHeaders(true),
		body: JSON.stringify({ identity_id: identityId, bindings }),
	});
	const payload = await response.json().catch(() => ({}));
	ensureIdentityResponseOK(response, payload);
	await refreshMagiIdentities();
}

export async function unbindChannelIdentity(identityId: string, binding: MagiChannelBinding): Promise<void> {
	const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/channel-unbind`, {
		method: "POST",
		credentials: "include",
		headers: buildIdentityRequestHeaders(true),
		body: JSON.stringify({ identity_id: identityId, binding }),
	});
	const payload = await response.json().catch(() => ({}));
	ensureIdentityResponseOK(response, payload);
	await refreshMagiIdentities();
}

export interface MagiBindCodeResult {
	bindCode: string;
	expiresAt: number;
	ttlSeconds: number;
}

export async function issueChannelBindCode(identityId: string): Promise<MagiBindCodeResult> {
	const response = await fetch(`${MAGI_IDENTITY_API_ROOT}/issue-bind-code`, {
		method: "POST",
		credentials: "include",
		headers: buildIdentityRequestHeaders(true),
		body: JSON.stringify({ identity_id: identityId }),
	});
	const payload = await response.json().catch(() => ({}));
	ensureIdentityResponseOK(response, payload);
	return {
		bindCode: String(payload.bindCode || ""),
		expiresAt: Number(payload.expiresAt || 0),
		ttlSeconds: Number(payload.ttlSeconds || 0),
	};
}

export function useMagiIdentitySessionState() {
    return readonly(magiIdentitySessionState);
}
