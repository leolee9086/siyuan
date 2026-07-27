import {describe, it} from "node:test";
import {strict as assert} from "node:assert";
import type {AppFacade} from "../../src/app/AppFacade.types";
import type {InNotePluginManager} from "../../src/inNotePlugin/manager/InNotePluginManager";
import {inNotePluginManagerBrand, isInNotePluginManagerDomain} from "../../src/inNotePlugin/manager/inNotePluginManager.types";
import type {InNotePluginManagerDomain} from "../../src/inNotePlugin/manager/inNotePluginManager.types";
import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";

type ManagerContract = PublicInstanceLooksLike<
    typeof InNotePluginManager,
    InNotePluginManagerDomain<AppFacade>
>;

const managerContract: ManagerContract = true;

describe("InNotePluginManager domain contract", () => {
    it("matches the complete public class surface in both directions", () => {
        assert.equal(managerContract, true);
    });

    it("classifies only the stable manager identity", () => {
        assert.equal(isInNotePluginManagerDomain({[inNotePluginManagerBrand]: "InNotePluginManager"}), true);
        assert.equal(isInNotePluginManagerDomain({init: async () => undefined}), false);
    });
});
