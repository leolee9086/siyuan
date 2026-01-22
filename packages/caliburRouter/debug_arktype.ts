/**
 * 调试脚本：验证具体模式的交集检测
 */
import { type, Type } from "arktype";

function 是子集(a: Type, b: Type): boolean {
    return a.extends(b) === true;
}

function 有交集(a: Type, b: Type): boolean {
    try {
        const 交集 = a.and(b);
        const 是never = 是子集(交集, type("never"));
        console.log(`  交集是否为never: ${是never}`);
        return !是never;
    } catch (e) {
        console.log(`  计算交集时出错:`, e);
        return false;
    }
}

console.log("=== 验证测试中失败的模式 ===\n");

// Hint面板导航模式
const Hint面板模式 = type({
    按键: "'ArrowUp' | 'ArrowDown'",
    面板: { hint: "true" },
    输入法激活: "false",
    编辑器禁用: "false"
});

// 属性视图面板模式  
const 属性视图模式 = type({
    面板: { 属性视图: "true", hint: "false" },
    输入法激活: "false",
    编辑器禁用: "false"
});

console.log("Hint面板模式 vs 属性视图模式:");
console.log("  Hint模式要求 hint: true");
console.log("  属性视图模式要求 hint: false");
console.log("  从集合论角度应该无交集（hint 互斥）");
const result1 = 有交集(Hint面板模式, 属性视图模式);
console.log(`  实际结果: ${result1 ? "有交集" : "无交集"}`);
console.log();

// 更简单的测试
const A = type({ hint: "true" });
const B = type({ hint: "false" });
console.log("简单测试: { hint: true } vs { hint: false }");
const result2 = 有交集(A, B);
console.log(`  实际结果: ${result2 ? "有交集" : "无交集"}`);
