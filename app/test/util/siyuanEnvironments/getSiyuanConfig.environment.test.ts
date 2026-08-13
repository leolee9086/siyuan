import {beforeEach, describe, expect, it} from "vitest";

import {getSiyuanConfig} from "../../../src/util/siyuanEnvironments/getSiyuanConfig.environment";

describe("application configuration environment", () => {
    beforeEach(() => {
        window.siyuan = {} as Window["siyuan"];
    });

    it("reports the unfinished getConf bootstrap stage as an Error", () => {
        expect(() => getSiyuanConfig()).toThrowError(
            "App 启动配置尚未完成：window.siyuan.config 未由 /api/system/getConf 注入",
        );
    });

    it("returns the configuration injected by getConf", () => {
        const config = {fileTree: {boxDocEnabled: false}} as Config.IConf;
        window.siyuan.config = config;

        expect(getSiyuanConfig()).toBe(config);
    });
});
