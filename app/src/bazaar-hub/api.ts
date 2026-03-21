import { fetchSyncPost } from "../util/network/fetch";
import type {
    IBazaarInstallFromSourceResult,
    IBazaarPublishedIndex,
    IBazaarPublishResult,
    IBazaarPublishWorkspace,
    IBazaarSecurityStats,
    IBazaarWorkspaceBundle,
} from "./types";

const ensureOK = <T>(response: IWebSocketData, fallbackMsg: string): T => {
    if (!response || typeof response.code !== "number") {
        throw new Error(fallbackMsg);
    }
    if (response.code !== 0) {
        throw new Error(response.msg || fallbackMsg);
    }
    return response.data as T;
};

export const getBazaarWorkspaceBundle = async (): Promise<IBazaarWorkspaceBundle> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/getPublishWorkspace", {});
    return ensureOK<IBazaarWorkspaceBundle>(response, "load bazaar publish workspace failed");
};

export const setBazaarPublishConfig = async (payload: {
    publish?: Config.IBazaarPublish;
    security?: Config.IBazaarSecurity;
    hub?: Config.IBazaarHubPreference;
}): Promise<IBazaarPublishWorkspace> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/setPublishConfig", payload);
    return ensureOK<IBazaarPublishWorkspace>(response, "save bazaar publish config failed");
};

export const upsertBazaarSource = async (source: Partial<Config.IBazaarSource>): Promise<Config.IBazaarSource> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/upsertSource", source);
    const data = ensureOK<{ source: Config.IBazaarSource }>(response, "save bazaar source failed");
    return data.source;
};

export const removeBazaarSource = async (sourceID: string): Promise<void> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/removeSource", { sourceID });
    ensureOK(response, "remove bazaar source failed");
};

export const testBazaarSource = async (payload: { sourceID?: string; url?: string; token?: string }): Promise<number> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/testSource", payload);
    const data = ensureOK<{ packageCount: number }>(response, "test bazaar source failed");
    return data.packageCount || 0;
};

export const getBazaarSourcePackages = async (sourceID: string): Promise<IBazaarPublishedIndex> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/getSourcePackages", { sourceID });
    return ensureOK<IBazaarPublishedIndex>(response, "load source packages failed");
};

export const publishBazaarPackage = async (packageType: string, packageName: string): Promise<IBazaarPublishResult> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/publishPackage", {
        packageType,
        packageName,
    });
    return ensureOK<IBazaarPublishResult>(response, "publish package failed");
};

export const installBazaarPackageFromSource = async (payload: {
    sourceID: string;
    packageType: string;
    packageName: string;
    version: string;
    mode: number;
    frontend?: string;
    keyword?: string;
}): Promise<IBazaarInstallFromSourceResult> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/installPackageFromSource", payload);
    return ensureOK<IBazaarInstallFromSourceResult>(response, "install package from source failed");
};

export const getBazaarSecurityStats = async (): Promise<IBazaarSecurityStats> => {
    const response = await fetchSyncPost("/api/s-forge/bazaar/securityStats", {});
    return ensureOK<IBazaarSecurityStats>(response, "load bazaar security stats failed");
};
