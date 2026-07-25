import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {fileURLToPath} from "node:url";
import {readdirSync, readFileSync, statSync} from "node:fs";
import {join, relative} from "node:path";
import type * as LocalApp from "../../src/index";
import type * as LocalEventBus from "../../src/plugin/EventBus";
import type * as LocalPlugin from "../../src/plugin";
import type {Asset} from "../../src/asset";
import type {Files} from "../../src/layout/dock/Files";
import type {IWindowHashModel} from "../../src/window/modelHash/modelHash.types";
import type {FilesEventHost} from "../../src/layout/dock/Files/eventHandlers.types";
import type {FilesDragContext} from "../../src/layout/dock/Files/dnd.types";
import type * as Siyuan from "siyuan";
import {createAppFacade} from "../../src/app/AppFacade.types";
import type {AppFacade, AppFacadeShape} from "../../src/app/AppFacade.types";
import type {IsAssignable} from "../../src/util/types/LooksLike.types";

type AppFacadeContract = IsAssignable<LocalApp.App, AppFacadeShape<Siyuan.Plugin, LocalEventBus.EventBus>>;
type PluginCompatibility = IsAssignable<LocalPlugin.Plugin, Siyuan.Plugin>;
type EventBusCompatibility = IsAssignable<LocalEventBus.EventBus, Siyuan.EventBus>;
type AssetWindowHashCompatibility = IsAssignable<Asset, IWindowHashModel>;
type FilesEventHostCompatibility = IsAssignable<Files, FilesEventHost>;
type FilesDragContextCompatibility = IsAssignable<Files, FilesDragContext>;

const appFacadeContract: AppFacadeContract = true;
const pluginCompatibility: PluginCompatibility = true;
const eventBusCompatibility: EventBusCompatibility = true;
const assetWindowHashCompatibility: AssetWindowHashCompatibility = true;
const filesEventHostCompatibility: FilesEventHostCompatibility = true;
const filesDragContextCompatibility: FilesDragContextCompatibility = true;

const testFacade = createAppFacade({
    plugins: [],
    appId: "test-app",
    eventBus: {},
    pluginHost: {
        reloadData: () => undefined,
        addDock: () => undefined,
    },
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
    it("keeps the concrete application public surface assignable to the abstract shape", () => {
        assert.equal(appFacadeContract, true);
        assert.equal(pluginCompatibility, true);
        assert.equal(eventBusCompatibility, true);
        assert.equal(assetWindowHashCompatibility, true);
        assert.equal(filesEventHostCompatibility, true);
        assert.equal(filesDragContextCompatibility, true);
    });

    it("brands the existing application surface without changing its identity", () => {
        assert.equal(brandedFacade, testFacade);
        assert.equal(testFacade.appId, "test-app");
    });

    it("keeps concrete App imports out of production modules", () => {
        assert.deepEqual(concreteAppImportViolations(), []);
    });
});
