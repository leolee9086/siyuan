import {describe, it} from "node:test";
import * as assert from "node:assert/strict";
import {
    getAssetName,
    getDisplayName,
    pathPosix,
} from "../../../src/util/file/path/operations";

/** 验证显示名保留 basename 和 `.sy` 两个独立开关的既有语义。 */
function preservesDisplayNameOptions() {
    assert.equal(getDisplayName("folder/document.sy"), "document.sy");
    assert.equal(getDisplayName("folder/document.sy", true, true), "document");
    assert.equal(getDisplayName("folder/document.sy", false, true), "folder/document");
}

/** 验证资源显示名去除扩展名和标准时间戳后缀。 */
function removesAssetSuffixes() {
    assert.equal(getAssetName("assets/image-20260725010203-abcdefg.png"), "image");
}

/** 验证浏览器构建使用稳定的 POSIX 分隔符。 */
function exposesPosixOperations() {
    assert.equal(pathPosix().join("folder", "document.sy"), "folder/document.sy");
}

/** 注册纯路径领域的全部契约测试。 */
function registerPathOperationTests() {
    it("preserves display name options", preservesDisplayNameOptions);
    it("removes asset suffixes", removesAssetSuffixes);
    it("exposes POSIX operations", exposesPosixOperations);
}

describe("file path operations", registerPathOperationTests);
