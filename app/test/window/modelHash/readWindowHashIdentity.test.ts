import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {readWindowHashIdentity} from "../../../src/window/modelHash/readWindowHashIdentity";

describe("window hash model capability", () => {
    it("accepts each declared identity kind", () => {
        assert.deepEqual(readWindowHashIdentity({
            windowHashIdentity: {kind: "document-root", value: "root-id"},
        }), {kind: "document-root", value: "root-id"});
        assert.deepEqual(readWindowHashIdentity({
            windowHashIdentity: {kind: "asset-path", value: "assets/file.pdf"},
        }), {kind: "asset-path", value: "assets/file.pdf"});
    });

    it("rejects incomplete and undeclared identities", () => {
        assert.equal(readWindowHashIdentity({windowHashIdentity: {kind: "document-root"}}), undefined);
        assert.equal(readWindowHashIdentity({
            windowHashIdentity: {kind: "other", value: "value"},
        }), undefined);
        assert.equal(readWindowHashIdentity(null), undefined);
    });

    it("reads the current value from a getter", () => {
        let value = "first";
        const model = {
            get windowHashIdentity() {
                return {kind: "asset-path" as const, value};
            },
        };
        assert.deepEqual(readWindowHashIdentity(model), {kind: "asset-path", value: "first"});
        value = "second";
        assert.deepEqual(readWindowHashIdentity(model), {kind: "asset-path", value: "second"});
    });
});
