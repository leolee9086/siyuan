export interface IBazaarPublishedItem {
    packageType: string;
    packageName: string;
    version: string;
    artifactId: string;
    publishedAt: number;
    checksumSHA: string;
    displayName: string;
    description: string;
    author: string;
    officialName: boolean;
    downloadPath: string;
}

export interface IBazaarPublishedIndex {
    updatedAt: number;
    packages: IBazaarPublishedItem[];
}

export interface IBazaarInstalledPackage {
    name: string;
    version: string;
    author: string;
    preferredName: string;
    preferredDesc: string;
}

export interface IBazaarPublishWorkspace {
    sources: Config.IBazaarSource[];
    publish: Config.IBazaarPublish;
    security: Config.IBazaarSecurity;
    hub: Config.IBazaarHubPreference;
    installed: Record<string, IBazaarInstalledPackage[]>;
}

export interface IBazaarWorkspaceBundle {
    workspace: IBazaarPublishWorkspace;
    published: IBazaarPublishedIndex;
}

export interface IBazaarPublishResult {
    record: Config.IBazaarPublishRecord;
    warning: string;
}

export interface IBazaarInstallFromSourceResult {
    packageType: string;
    packageName: string;
}

export interface IBazaarSecurityClientStats {
    ip: string;
    accepted: number;
    rejected: number;
    lastSeen: number;
}

export interface IBazaarSecurityStats {
    totalAccepted: number;
    totalRejected: number;
    clients: IBazaarSecurityClientStats[];
}
