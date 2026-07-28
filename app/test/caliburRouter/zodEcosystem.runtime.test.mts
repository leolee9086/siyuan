import assert from "node:assert/strict";
import test from "node:test";
import {z} from "zod";
import {zodState} from "calibur-router/zod";

test("CaliburRouter 封装应用创建的 Zod Schema 并按对象身份解包", () => {
    const schema = z.object({
        mode: z.enum(["edit", "readonly"]),
        focused: z.boolean(),
    });

    const pattern = zodState.fromSchema(schema);

    assert.equal(zodState.toSchema(pattern), schema);
});

test("CaliburRouter 拒绝会改变处理器输入值的 Zod coerce", () => {
    assert.throws(
        () => zodState.fromSchema(z.coerce.number()),
        /schema 包含 coerce/,
    );
    assert.throws(
        () => zodState.fromSchema(z.object({value: z.coerce.string()})),
        /schema\.value 包含 coerce/,
    );
});
