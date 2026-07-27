import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";
import type * as LocalApp from "../../src/index";
import type * as MobileApp from "../../src/mobile/index";
import type * as LocalEventBus from "../../src/plugin/EventBus";
import type * as LocalPlugin from "../../src/plugin";
import type {Asset} from "../../src/asset";
import type {IWindowHashModel} from "../../src/window/modelHash/modelHash.types";
import type * as Siyuan from "siyuan";
import {createAppFacade} from "../../src/app/AppFacade.types";
import type {AppFacade} from "../../src/app/AppFacade.types";
import type {InstanceLooksLike, IsAssignable} from "../../src/util/types/LooksLike.types";
import type {SiyuanPluginRuntimeContract} from "../compatibility/SiyuanEcosystem.contract.types";
import {createInNotePluginManagerFixture} from "../inNotePlugin/InNotePluginManager.fixture";

type AppFacadeContract = InstanceLooksLike<
    typeof LocalApp.App,
    AppFacade<Siyuan.Plugin, LocalEventBus.EventBus>
>;
type MobileAppFacadeContract = InstanceLooksLike<
    typeof MobileApp.App,
    AppFacade<Siyuan.Plugin, LocalEventBus.EventBus>
>;
type PluginCompatibility = IsAssignable<LocalPlugin.Plugin, SiyuanPluginRuntimeContract>;
type EventBusCompatibility = IsAssignable<LocalEventBus.EventBus, Siyuan.EventBus>;
type PluginDockIngressCompatibility = IsAssignable<Siyuan.IPluginDockTab, IPluginDockTab>;
type AssetWindowHashCompatibility = IsAssignable<Asset, IWindowHashModel>;

const appFacadeContract: AppFacadeContract = true;
const mobileAppFacadeContract: MobileAppFacadeContract = true;
const pluginCompatibility: PluginCompatibility = true;
const eventBusCompatibility: EventBusCompatibility = true;
const pluginDockIngressCompatibility: PluginDockIngressCompatibility = true;
const assetWindowHashCompatibility: AssetWindowHashCompatibility = true;

// These witnesses make an upstream compatibility regression identify the concrete member in tsc output.
const asUpstreamPluginRuntime = (plugin: LocalPlugin.Plugin): SiyuanPluginRuntimeContract => plugin;
const asUpstreamEventBus = (eventBus: LocalEventBus.EventBus): Siyuan.EventBus => eventBus;

const testFacade = createAppFacade<object, object>({
    plugins: [],
    appId: "test-app",
    eventBus: {},
    inNotePluginManager: createInNotePluginManagerFixture(),
    pluginHost: {
        reloadData: () => undefined,
        addDock: () => undefined,
    },
    createProtyle: () => {
        throw new Error("Contract fixture does not create Protyle instances");
    },
    createDocument: async () => undefined,
    handleUnavailableDocument: () => undefined,
    toggleFullscreen: () => undefined,
    openTab: () => undefined,
    openAsset: () => undefined,
    openBlock: () => undefined,
    openDatabaseRow: () => undefined,
    processSiYuanUri: () => false,
});
const brandedFacade: AppFacade<object, object> = testFacade;

const collectTypeScriptFiles = (root: string): string[] => {
    const files: string[] = [];
    for (const entry of readdirSync(root)) {
        const file = join(root, entry);
        if (statSync(file).isDirectory()) {
            files.push(...collectTypeScriptFiles(file));
        } else if (/\.tsx?$/.test(entry)) {
            files.push(file);
        }
    }
    return files;
};

const concreteAppImportViolations = () => {
    const sourceRoot = fileURLToPath(new URL("../../src", import.meta.url));
    const vueAdapterFiles = new Set([
        "dialog/dialogHelpers.lifecycle.ts",
        "dialog/index.ts",
        "protyle/gutter/menus/aiImageHelpers.ts",
        "util/vue/mount.ts",
    ]);
    const importPattern = /^\s*import\s+(?:type\s+)?\{[^}]*\bApp\b[^}]*\}\s+from\s+["']([^"']+)["'];?\s*$/gm;
    return collectTypeScriptFiles(sourceRoot).flatMap((file) => {
        const relativeFile = relative(sourceRoot, file).replaceAll("\\", "/");
        if (vueAdapterFiles.has(relativeFile)) {
            return [];
        }
        return [...readFileSync(file, "utf8").matchAll(importPattern)]
            .filter((match) => match[1] !== "vue")
            .map(() => relativeFile);
    });
};

describe("AppFacade contracts", () => {
    it("keeps the complete concrete application public surface equal to the branded facade", () => {
        assert.equal(appFacadeContract, true);
        assert.equal(mobileAppFacadeContract, true);
        assert.equal(pluginCompatibility, true);
        assert.equal(eventBusCompatibility, true);
        assert.equal(pluginDockIngressCompatibility, true);
        assert.equal(typeof asUpstreamPluginRuntime, "function");
        assert.equal(typeof asUpstreamEventBus, "function");
        assert.equal(assetWindowHashCompatibility, true);
    });

    it("brands the existing application surface without changing its identity", () => {
        assert.equal(brandedFacade, testFacade);
        assert.equal(testFacade.appId, "test-app");
    });

    it("keeps concrete App imports out of production modules", () => {
        assert.deepEqual(concreteAppImportViolations(), []);
    });
});
