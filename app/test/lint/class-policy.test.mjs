import assert from "node:assert/strict";
import test from "node:test";
import tsParser from "@typescript-eslint/parser";
import { Linter } from "eslint";
import { noClassPlugin } from "../../0_lints/no-class.mjs";
import { restrictionsPlugin } from "../../0_lints/restrictions.mjs";

const exemption = `// @允许类: ${"存在该类是为了验证显式架构豁免仍然有效，类只负责封装实例状态和公开行为，内部计算保持为模块级函数。".repeat(14)}`;

/**
 * 对一段 TypeScript 应用 class 存在性与类形状约束。
 *
 * @param {string} code 待检查源码
 * @returns {import("eslint").LintMessage[]} lint 消息
 */
function lintClassPolicy(code) {
    const linter = new Linter({ configType: "flat" });
    return linter.verify(code, [{
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: { ecmaVersion: "latest", sourceType: "module" },
        },
        plugins: {
            "no-class": noClassPlugin,
            restrictions: restrictionsPlugin,
        },
        rules: {
            "no-class/no-class": "error",
            "restrictions/no-private-method": "error",
            "restrictions/no-hash-private-method": "error",
        },
    }], { filename: "class-policy.ts" });
}

test("普通类默认被禁止", () => {
    const messages = lintClassPolicy("class Example {}\n");
    assert.deepEqual(messages.map((message) => message.ruleId), ["no-class/no-class"]);
});

test("抽象类也必须显式豁免", () => {
    const messages = lintClassPolicy("abstract class Example {}\n");
    assert.deepEqual(messages.map((message) => message.ruleId), ["no-class/no-class"]);
});

test("充分的豁免理由允许类保存私有状态", () => {
    const code = `${exemption}\nclass Example {\n    private value = 1;\n    #other = 2;\n    read() { return this.value + this.#other; }\n}\n`;
    assert.deepEqual(lintClassPolicy(code), []);
});

test("类豁免不允许 TypeScript 私有方法", () => {
    const code = `${exemption}\nclass Example {\n    private calculate() { return 1; }\n}\n`;
    const messages = lintClassPolicy(code);
    assert.deepEqual(messages.map((message) => message.ruleId), ["restrictions/no-private-method"]);
});

test("类豁免不允许井号私有方法", () => {
    const code = `${exemption}\nclass Example {\n    #calculate() { return 1; }\n}\n`;
    const messages = lintClassPolicy(code);
    assert.deepEqual(messages.map((message) => message.ruleId), ["restrictions/no-hash-private-method"]);
});
