import { getSafeSiyuanConfig } from "../../util/siyuanEnvironments/getSiyuanConfig.environment";

const MAGI_CHANNEL_API_ROOT = "/api/s-forge/magi/v1/channel";

function resolveWorkspaceAPIToken(): string {
    try {
        return String(getSafeSiyuanConfig()?.api?.token ?? "").trim();
    } catch {
        return "";
    }
}

function buildHeaders(): Record<string, string> {
    const token = resolveWorkspaceAPIToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${MAGI_CHANNEL_API_ROOT}${path}`, {
        method,
        credentials: "include",
        headers: buildHeaders(),
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
        const text = await response.text().catch(() => `HTTP ${response.status}`);
        throw new Error(text);
    }
    return response.json();
}

export interface ChannelStatusView {
    id: string;
    connected: boolean;
    accountId: string;
    userCount: number;
    lastMessageAt: string;
    error: string;
}

export interface FullChannelConfigView {
    enabled: boolean;
    defaultTrust: string;
    defaultRisk: string;
    perAccount: Record<string, AccountConfigView>;
}

export interface AccountConfigView {
    defaultTrust?: string;
    defaultRisk?: string;
    allowList: string[];
    blockList: string[];
    perUser: Record<string, UserOverrideView>;
}

export interface UserOverrideView {
    trustBase?: string;
    riskLevel?: string;
    blocked: boolean;
    nickname: string;
}

export interface ChannelTrustConfigView {
    version: number;
    channels: Record<string, FullChannelConfigView>;
}

export interface ChannelListResponse {
    channels: ChannelStatusView[];
}

export interface CreateChannelResponse {
    channelId: string;
    sessionKey: string;
    qrImgUrl: string;
}

export interface PollLoginResponse {
    status: string;
}

export interface AccountView {
    accountId: string;
    userId?: string;
    savedAt?: string;
}

export interface AccountListResponse {
    accounts: AccountView[];
}

export async function listChannels(): Promise<ChannelListResponse> {
    return request<ChannelListResponse>("GET", "/list");
}

export async function listAccounts(): Promise<AccountListResponse> {
    return request<AccountListResponse>("GET", "/accounts");
}

export async function getTrustConfig(): Promise<ChannelTrustConfigView> {
    return request<ChannelTrustConfigView>("GET", "/trust-config");
}

export async function updateTrustConfig(cfg: ChannelTrustConfigView): Promise<void> {
    return request("PUT", "/trust-config", cfg);
}

export async function createChannel(channelType: string): Promise<CreateChannelResponse> {
    return request<CreateChannelResponse>("POST", "/create", { channelType });
}

export async function pollLoginStatus(sessionKey: string): Promise<PollLoginResponse> {
    return request<PollLoginResponse>("GET", `/poll-login?sessionKey=${encodeURIComponent(sessionKey)}`);
}

export async function reloginChannel(accountId: string): Promise<CreateChannelResponse> {
    return request<CreateChannelResponse>("POST", "/relogin", { accountId });
}
