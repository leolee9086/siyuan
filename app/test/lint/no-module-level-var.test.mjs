import assert from "node:assert/strict";
import test from "node:test";
import tsParser from "@typescript-eslint/parser";
import {Linter} from "eslint";
import {noModuleLevelVarPlugin} from "../../0_lints/no-module-level-var.mjs";

function lintModule(code) {
    const linter = new Linter({configType: "flat"});
    return linter.verify(code, [{
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {ecmaVersion: "latest", sourceType: "module"},
        },
        plugins: {"no-module-level-var": noModuleLevelVarPlugin},
        rules: {"no-module-level-var/no-module-level-var": "error"},
    }], {filename: "module-level-symbol.ts"});
}

test("不可变 Symbol 身份键允许位于模块级", () => {
    const messages = lintModule(`
        const localBrand = Symbol("LocalBrand");
        const sharedBrand = Symbol.for("SharedBrand");
    `);
    assert.deepEqual(messages, []);
});

test("冻结的纯 Symbol 身份映射允许位于模块级", () => {
    const messages = lintModule(`
        export const Symbols = Object.freeze({
            LOCAL: Symbol("Local"),
            SHARED: Symbol.for("Shared"),
        } as const);
    `);
    assert.deepEqual(messages, []);
});

test("冻结映射混入非 Symbol 值时仍被拒绝", () => {
    const messages = lintModule(`
        const state = Object.freeze({
            KEY: Symbol.for("Key"),
            values: [],
        } as const);
    `);
    assert.deepEqual(messages.map((message) => message.ruleId), ["no-module-level-var/no-module-level-var"]);
});

test("可变模块级容器仍然需要显式处理", () => {
    const messages = lintModule("const registry = new Map();\n");
    assert.deepEqual(messages.map((message) => message.ruleId), ["no-module-level-var/no-module-level-var"]);
});
