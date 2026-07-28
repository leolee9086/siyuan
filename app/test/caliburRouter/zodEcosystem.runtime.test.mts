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
