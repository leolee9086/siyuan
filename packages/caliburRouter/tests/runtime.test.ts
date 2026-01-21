/**
 * CalibURRouter 运行时测试
 * 
 * 测试运行时分发逻辑的正确性
 */

import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { calibur, 匹配, 是子集, 有交集 } from "../src/index.js";

describe("calibur.universe 基础功能", () => {
    it("应该创建匹配器构建器", () => {
        const matcher = calibur.universe(type({
            按键: "string"
        }));

        expect(matcher).toBeDefined();
        expect(typeof matcher.split).toBe("function");
        expect(typeof matcher.remain).toBe("function");
    });

    it("单个split + remain应该正确分发", () => {
        const dispatch = calibur.universe(type({
            按键: "string"
        }))
            .split(type({ 按键: "'Enter'" }), () => ({ 命令: "回车" }))
            .remain(() => ({ 命令: "默认" }))
            .build();

        expect(dispatch({ 按键: "Enter" })).toEqual({ 命令: "回车" });
        expect(dispatch({ 按键: "Tab" })).toEqual({ 命令: "默认" });
        expect(dispatch({ 按键: "a" })).toEqual({ 命令: "默认" });
    });

    it("多个split应该按顺序匹配", () => {
        const dispatch = calibur.universe(type({
            按键: "string",
            修饰符: { ctrl: "boolean" }
        }))
            .split(
                type({ 按键: "'Enter'", 修饰符: { ctrl: "true" } }),
                () => ({ 命令: "Ctrl+回车" })
            )
            .split(
                type({ 按键: "'Enter'" }),
                () => ({ 命令: "回车" })
            )
            .split(
                type({ 按键: "'Tab'" }),
                () => ({ 命令: "制表符" })
            )
            .remain(() => ({ 命令: "默认" }))
            .build();

        // Ctrl+Enter 应该匹配第一个（更具体）
        expect(dispatch({ 按键: "Enter", 修饰符: { ctrl: true } }))
            .toEqual({ 命令: "Ctrl+回车" });

        // 普通Enter应该匹配第二个
        expect(dispatch({ 按键: "Enter", 修饰符: { ctrl: false } }))
            .toEqual({ 命令: "回车" });

        // Tab应该匹配第三个
        expect(dispatch({ 按键: "Tab", 修饰符: { ctrl: false } }))
            .toEqual({ 命令: "制表符" });

        // 其他应该匹配remain
        expect(dispatch({ 按键: "a", 修饰符: { ctrl: false } }))
            .toEqual({ 命令: "默认" });
    });
});

describe("键盘事件分发场景", () => {
    it("应该处理复杂的键盘事件状态空间", () => {
        const 键盘事件 = type({
            按键: "string",
            修饰符: {
                ctrl: "boolean",
                shift: "boolean",
                alt: "boolean"
            },
            块类型: "'段落' | '代码块' | '列表'"
        });

        const dispatch = calibur.universe(键盘事件)
            // Tab在列表中 = 缩进
            .split(
                type({ 按键: "'Tab'", 块类型: "'列表'" }),
                () => ({ 命令: "列表缩进" })
            )
            // Shift+Tab在列表中 = 减缩进
            .split(
                type({ 按键: "'Tab'", 修饰符: { shift: "true" }, 块类型: "'列表'" }),
                () => ({ 命令: "列表减缩进" })
            )
            // Enter在代码块中 = 换行（不分段）
            .split(
                type({ 按键: "'Enter'", 块类型: "'代码块'" }),
                () => ({ 命令: "代码块换行" })
            )
            // 默认Enter = 分段
            .split(
                type({ 按键: "'Enter'" }),
                () => ({ 命令: "分段" })
            )
            .remain(() => ({ 命令: "无操作" }))
            .build();

        // 列表中Tab = 缩进
        expect(dispatch({
            按键: "Tab",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "列表"
        })).toEqual({ 命令: "列表缩进" });

        // 代码块中Enter = 换行
        expect(dispatch({
            按键: "Enter",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "代码块"
        })).toEqual({ 命令: "代码块换行" });

        // 段落中Enter = 分段
        expect(dispatch({
            按键: "Enter",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "段落"
        })).toEqual({ 命令: "分段" });

        // 其他 = 无操作
        expect(dispatch({
            按键: "a",
            修饰符: { ctrl: false, shift: false, alt: false },
            块类型: "段落"
        })).toEqual({ 命令: "无操作" });
    });
});

describe("集合运算工具函数", () => {
    it("匹配应该正确验证输入", () => {
        const 模式 = type({ 名称: "string", 年龄: "number" });

        expect(匹配(模式, { 名称: "张三", 年龄: 25 }))
            .toEqual({ 名称: "张三", 年龄: 25 });

        expect(匹配(模式, { 名称: "张三" })).toBeNull();
        expect(匹配(模式, { 名称: 123, 年龄: 25 })).toBeNull();
        expect(匹配(模式, "invalid")).toBeNull();
    });

    it("是子集应该正确判断子集关系", () => {
        const 字符串A = type("'a'");
        const 字符串AB = type("'a' | 'b'");
        const 字符串 = type("string");

        expect(是子集(字符串A, 字符串AB)).toBe(true);  // 'a' ⊆ 'a'|'b'
        expect(是子集(字符串A, 字符串)).toBe(true);    // 'a' ⊆ string
        expect(是子集(字符串AB, 字符串A)).toBe(false); // 'a'|'b' ⊄ 'a'
        expect(是子集(字符串, 字符串A)).toBe(false);   // string ⊄ 'a'
    });

    it("有交集应该正确判断交集", () => {
        const AB = type("'a' | 'b'");
        const BC = type("'b' | 'c'");
        const CD = type("'c' | 'd'");

        expect(有交集(AB, BC)).toBe(true);  // 交集为 'b'
        expect(有交集(AB, CD)).toBe(false); // 无交集
    });
});

describe("处理器返回值", () => {
    it("处理器应该可以返回任意类型", () => {
        const dispatch = calibur.universe(type({ 类型: "'A' | 'B'" }))
            .split(type({ 类型: "'A'" }), () => 42)
            .split(type({ 类型: "'B'" }), () => "hello")
            .remain(() => null)
            .build();

        expect(dispatch({ 类型: "A" })).toBe(42);
        expect(dispatch({ 类型: "B" })).toBe("hello");
    });

    it("处理器应该接收匹配的状态", () => {
        const 用户状态 = type({
            用户: { 名称: "string", 等级: "number" }
        });

        const dispatch = calibur.universe(用户状态)
            .split(
                // 模式需要包含完整属性以正确推断类型
                type({ 用户: { 名称: "string", 等级: "number > 10" } }),
                (state) => `高级用户: ${state.用户.名称}`
            )
            .remain(
                // 使用类型断言，因为remain的参数类型在类型层面是剩余集
                (state: { 用户: { 名称: string; 等级: number } }) => `普通用户: ${state.用户.名称}`
            )
            .build();

        expect(dispatch({ 用户: { 名称: "张三", 等级: 15 } }))
            .toBe("高级用户: 张三");

        expect(dispatch({ 用户: { 名称: "李四", 等级: 5 } }))
            .toBe("普通用户: 李四");
    });
});
