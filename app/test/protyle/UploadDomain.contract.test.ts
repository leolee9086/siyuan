import assert from "node:assert/strict";
import {describe, it} from "node:test";

import type {PublicInstanceLooksLike} from "../../src/util/types/LooksLike.types";
import type {Upload} from "../../src/protyle/upload";
import type {UploadDomain} from "../../src/protyle/upload/upload.types";

type UploadContract = PublicInstanceLooksLike<typeof Upload, UploadDomain>;
const uploadContract: UploadContract = true;

describe("Upload domain contract", () => {
    it("matches the complete public class surface", () => {
        assert.equal(uploadContract, true);
    });
});
