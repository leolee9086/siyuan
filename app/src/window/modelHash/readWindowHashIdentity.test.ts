/** 用途：注册纯 `node:test` 测试套件；使用范围：本文件最外层套件；解耦评估：经同域网关集中声明测试基础设施，不进入业务实现。 */
import {describe} from "./imports";
/** 用途：注册纯 Node 测试项；使用范围：本文件三个契约用例；解耦评估：经同域网关集中声明测试基础设施，不进入业务实现。 */
import {it} from "./imports";
/** 用途：严格比较读取结果；使用范围：本文件断言；解耦评估：经同域网关集中声明测试基础设施，不进入业务实现。 */
import {assert} from "./imports";
/** 用途：验证窗口身份读取与结构校验；使用范围：本文件契约测试；解耦评估：直接测试领域实现最能固定公开语义。 */
import {readWindowHashIdentity} from "./readWindowHashIdentity";

/** 验证契约声明的两类身份都能被读取。 */
function acceptsDeclaredIdentityKinds() {
    assert.deepEqual(readWindowHashIdentity({
        windowHashIdentity: {kind: "document-root", value: "root-id"},
    }), {kind: "document-root", value: "root-id"});
    assert.deepEqual(readWindowHashIdentity({
        windowHashIdentity: {kind: "asset-path", value: "assets/file.pdf"},
    }), {kind: "asset-path", value: "assets/file.pdf"});
}

/** 验证残缺、未知或空输入不会被当作窗口恢复身份。 */
function rejectsInvalidIdentities() {
    assert.equal(readWindowHashIdentity({windowHashIdentity: {kind: "document-root"}}), undefined);
    assert.equal(readWindowHashIdentity({
        windowHashIdentity: {kind: "other", value: "value"},
    }), undefined);
    assert.equal(readWindowHashIdentity(null), undefined);
}

/** 验证读取器每次访问模型 getter，以取得更新后的身份。 */
function readsCurrentGetterValue() {
    let value = "first";
    const model = {
        /** 返回测试当前设置的动态资源路径。 */
        get windowHashIdentity() {
            return {kind: "asset-path" as const, value};
        },
    };
    assert.deepEqual(readWindowHashIdentity(model), {kind: "asset-path", value: "first"});
    value = "second";
    assert.deepEqual(readWindowHashIdentity(model), {kind: "asset-path", value: "second"});
}

/** 注册窗口 hash 模型能力的全部契约测试。 */
function registerWindowHashModelTests() {
    it("accepts each declared identity kind", acceptsDeclaredIdentityKinds);
    it("rejects incomplete and undeclared identities", rejectsInvalidIdentities);
    it("reads the current value from a getter", readsCurrentGetterValue);
}

describe("window hash model capability", registerWindowHashModelTests);
