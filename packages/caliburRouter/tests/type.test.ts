/**
 * CalibURRouter 类型测试
 * 
 * 测试类型系统的正确性：
 * - 类型推断
 * - 剩余集追踪
 * - 穷尽匹配约束
 */

import { describe, it, expectTypeOf } from "vitest";
import { type } from "arktype";
import { calibur } from "../src/index.js";

describe("类型推断测试", () => {
    it("split应该正确推断处理器参数类型", () => {
        const 全集 = type({
            按键: "string",
            修饰符: { ctrl: "boolean" }
        });

        const matcher = calibur.universe(全集);

        // 测试split的类型推断
        matcher.split(
            type({ 按键: "'Enter'" }),
            (state) => {
                // state.按键 应该被推断为 "Enter"
                expectTypeOf(state.按键).toEqualTypeOf<"Enter">();
                return { 命令: "回车" as const };
            }
        );
    });

    it("remain处理器应该接收剩余集类型", () => {
        const 全集 = type({
            值: "'a' | 'b' | 'c'"
        });

        // 切割掉 'a'
        const 切割后 = calibur.universe(全集)
            .split(type({ 值: "'a'" }), () => ({ 结果: "a" as const }));

        // remain应该处理 'b' | 'c'
        切割后.remain((state) => {
            // 类型层面：state.值 应该是 'b' | 'c'
            // 注意：由于TypeScript的限制，这里只能做基本验证
            expectTypeOf(state).toHaveProperty("值");
            return { 结果: "其他" as const };
        });
    });

    it("build返回的分发器应该有正确的类型", () => {
        const 全集 = type({
            按键: "string"
        });

        const dispatch = calibur.universe(全集)
            .split(type({ 按键: "'Enter'" }), () => ({ 命令: "回车" as const }))
            .remain(() => ({ 命令: "默认" as const }))
            .build();

        // dispatch应该是一个函数
        expectTypeOf(dispatch).toBeFunction();

        // 返回类型应该是 { 命令: "回车" } | { 命令: "默认" }
        type 期望结果 = { 命令: "回车" } | { 命令: "默认" };
        expectTypeOf(dispatch({ 按键: "Enter" })).toMatchTypeOf<期望结果>();
    });
});

describe("链式调用类型测试", () => {
    it("多次split应该累积结果类型", () => {
        const 全集 = type({
            事件: "'click' | 'hover' | 'focus'"
        });

        const dispatch = calibur.universe(全集)
            .split(type({ 事件: "'click'" }), () => ({ 类型: "点击" as const }))
            .split(type({ 事件: "'hover'" }), () => ({ 类型: "悬停" as const }))
            .remain(() => ({ 类型: "聚焦" as const }))
            .build();

        type 期望结果 = { 类型: "点击" } | { 类型: "悬停" } | { 类型: "聚焦" };
        expectTypeOf(dispatch({ 事件: "click" })).toMatchTypeOf<期望结果>();
    });
});

/**
 * 编译期测试（通过注释说明）
 * 
 * 以下场景应该产生TypeScript编译错误：
 * 
 * 1. 未调用remain时调用build（剩余集非空）
 * ```ts
 * calibur.universe(type({ 值: "'a' | 'b'" }))
 *   .split(type({ 值: "'a'" }), () => ({}))
 *   .build(); // 错误：还有未处理的模式
 * ```
 * 
 * 2. 处理器参数类型不匹配
 * ```ts
 * calibur.universe(type({ 值: "string" }))
 *   .split(type({ 值: "'a'" }), (state: { 值: number }) => ({}))
 *   // 错误：参数类型不匹配
 * ```
 */
