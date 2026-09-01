import {beforeEach, describe, expect, it, vi} from "vitest";

const runtime = vi.hoisted(() => ({
    fetchPost: vi.fn(),
}));

vi.mock("../../src/util/network/fetch", () => ({
    fetchPost: runtime.fetchPost,
}));

import {installAppConfiguration} from "../../src/boot/installAppConfiguration";
import {getSiyuanConfig} from "../../src/util/siyuanEnvironments/getSiyuanConfig.environment";

describe("App configuration bootstrap", () => {
    beforeEach(() => {
        window.siyuan = {
            notebooks: [],
        } as unknown as Window["siyuan"];
        runtime.fetchPost.mockReset();
    });

    it("allows the application bootstrap to own the initial notebook refresh", () => {
        const config = {fileTree: {boxDocEnabled: false}} as Config.IConf;

        expect(installAppConfiguration(config, false, {startNotebookRefresh: false})).toBe(config);
        expect(runtime.fetchPost).not.toHaveBeenCalled();
        expect(window.siyuan.config).toBe(config);
        expect(window.siyuan.isPublish).toBe(false);
    });

    it("installs getConf before a synchronously returned notebook response reads it", () => {
        const config = {fileTree: {boxDocEnabled: false}} as Config.IConf;
        const notebooks = [{id: "notebook-id", name: "Notebook"}] as INotebook[];
        let configObservedByRequest: Config.IConf | undefined;

        runtime.fetchPost.mockImplementation((_url, _data, callback) => {
            configObservedByRequest = getSiyuanConfig();
            callback({
                code: 0,
                msg: "",
                data: {notebooks, boxDocEnabled: true},
            } as IWebSocketData);
        });

        expect(installAppConfiguration(config, false)).toBe(config);
        expect(configObservedByRequest).toBe(config);
        expect(window.siyuan.config.fileTree.boxDocEnabled).toBe(true);
        expect(window.siyuan.notebooks).toEqual(notebooks);
        expect(window.siyuan.isPublish).toBe(false);
    });
});
