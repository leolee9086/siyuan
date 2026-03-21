import { openFile } from "../editor/util";
import { getAllModels } from "../layout/getAll";
import { siyuanI18n } from "../util/siyuanEnvironments/i18n.getI18n.environment";
import {
    BAZAAR_HUB_SET_SOURCE_EVENT,
    BAZAAR_HUB_TAB_TYPE,
    BAZAAR_PUBLISH_TAB_TYPE,
    BAZAAR_SOURCE_TAB_TYPE,
} from "./constants";
import type { App } from "../index";

const resolveApp = (app?: App): App | undefined => {
    if (app) {
        return app;
    }
    return (window.siyuan?.ws as { app?: App } | undefined)?.app;
};

const readCustomData = (data: unknown): Record<string, unknown> => {
    if (!data || typeof data !== "object") {
        return {};
    }
    return data as Record<string, unknown>;
};

const getLocalOrigin = (): string => {
    if (window.location?.origin) {
        return window.location.origin.replace(/\/+$/, "");
    }
    const serverAddrs = window.siyuan?.config?.serverAddrs || [];
    const first = serverAddrs[0] || "";
    return first.replace(/\/+$/, "");
};

export const getLocalBazaarSourcePageURL = (): string => {
    return `${getLocalOrigin()}/api/s-forge/bazaar/public/source`;
};

export const openBazaarHubTab = async (options?: { app?: App; sourceID?: string }): Promise<void> => {
    const app = resolveApp(options?.app);
    if (!app) {
        return;
    }
    const sourceID = (options?.sourceID || "").trim();
    const existingModel = getAllModels().custom.find((item) => item.type === BAZAAR_HUB_TAB_TYPE);
    if (existingModel?.parent?.headElement) {
        existingModel.parent.parent.switchTab(existingModel.parent.headElement);
        existingModel.parent.parent.showHeading();
        if (sourceID) {
            existingModel.element.dispatchEvent(new CustomEvent(BAZAAR_HUB_SET_SOURCE_EVENT, {
                detail: { sourceID },
            }));
        }
        return;
    }

    await openFile({
        app,
        custom: {
            title: `${siyuanI18n.bazaar} Hub`,
            icon: "iconBazaar",
            id: BAZAAR_HUB_TAB_TYPE,
            data: { sourceID },
        },
    });
};

export const openBazaarPublishTab = async (options?: { app?: App }): Promise<void> => {
    const app = resolveApp(options?.app);
    if (!app) {
        return;
    }
    const existingModel = getAllModels().custom.find((item) => item.type === BAZAAR_PUBLISH_TAB_TYPE);
    if (existingModel?.parent?.headElement) {
        existingModel.parent.parent.switchTab(existingModel.parent.headElement);
        existingModel.parent.parent.showHeading();
        return;
    }
    await openFile({
        app,
        custom: {
            title: `${siyuanI18n.publish} · ${siyuanI18n.bazaar}`,
            icon: "iconUpload",
            id: BAZAAR_PUBLISH_TAB_TYPE,
        },
    });
};

export const openBazaarSourceTab = async (options: {
    app?: App;
    source: Pick<Config.IBazaarSource, "id" | "name" | "url"> & { openInTab?: boolean };
}): Promise<void> => {
    const app = resolveApp(options.app);
    if (!app) {
        return;
    }
    if (options.source.openInTab === false) {
        return;
    }
    const sourceID = (options.source.id || "").trim();
    const existingModel = getAllModels().custom.find((item) => {
        if (item.type !== BAZAAR_SOURCE_TAB_TYPE) {
            return false;
        }
        const data = readCustomData(item.data);
        return String(data.sourceID || "") === sourceID;
    });
    if (existingModel?.parent?.headElement) {
        existingModel.parent.parent.switchTab(existingModel.parent.headElement);
        existingModel.parent.parent.showHeading();
        return;
    }

    await openFile({
        app,
        custom: {
            title: options.source.name || options.source.url || "Bazaar Source",
            icon: "iconLink",
            id: BAZAAR_SOURCE_TAB_TYPE,
            data: {
                sourceID: options.source.id,
                sourceName: options.source.name,
                sourceURL: options.source.url,
            },
        },
    });
};

export const openLocalBazaarSourceTab = async (options?: { app?: App }): Promise<void> => {
    await openBazaarSourceTab({
        app: options?.app,
        source: {
            id: "local-publish-source",
            name: "本地集市源",
            url: getLocalBazaarSourcePageURL(),
            openInTab: true,
        },
    });
};
