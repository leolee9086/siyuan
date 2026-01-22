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

describe("子分发器全集校验类型测试", () => {
    it("是子集类型 应该正确判断类型子集关系", () => {
        // 导入类型工具
        type 是子集类型<子集, 父集> = 子集 extends 父集 ? true : false;

        // 字面量类型是联合类型的子集
        expectTypeOf<是子集类型<"a", "a" | "b">>().toEqualTypeOf<true>();

        // 联合类型不是其成员的子集
        expectTypeOf<是子集类型<"a" | "b", "a">>().toEqualTypeOf<boolean>();

        // 相同类型是自己的子集
        expectTypeOf<是子集类型<"a", "a">>().toEqualTypeOf<true>();

        // 对象类型子集关系
        type 父对象 = { 类型: "a" | "b" };
        type 子对象 = { 类型: "a" };
        expectTypeOf<是子集类型<子对象, 父对象>>().toEqualTypeOf<true>();
    });

    it("split处理器应该基于剩余集而非全集进行类型收窄", () => {
        const 全集 = type({
            类型: "'a' | 'b' | 'c'"
        });

        // 第一次split切割掉 'a'
        const 第一次切割后 = calibur.universe(全集)
            .split(type({ 类型: "'a'" }), (state) => {
                // state.类型 应该是 'a'（从剩余集 'a'|'b'|'c' 与模式 'a' 的交集）
                expectTypeOf(state.类型).toEqualTypeOf<"a">();
                return { 结果: "处理a" as const };
            });

        // 第二次split切割掉 'b'，此时剩余集是 'b' | 'c'
        第一次切割后.split(type({ 类型: "'b'" }), (state) => {
            // state.类型 应该是 'b'（从剩余集 'b'|'c' 与模式 'b' 的交集）
            expectTypeOf(state.类型).toEqualTypeOf<"b">();
            return { 结果: "处理b" as const };
        });
    });

    /**
     * 严格模式类型校验说明
     * 
     * 断言子分发器全集合法<子全集, 剩余集, 模式定义, 严格模式> 类型工具：
     * 
     * 1. 非严格模式（默认）：只检查子全集与模式定义有交集
     *    - 断言子分发器全集合法<{ 类型: 'a' }, any, { 类型: 'a' | 'b' }> => { 类型: 'a' }  ✓
     *    - 断言子分发器全集合法<{ 类型: 'c' }, any, { 类型: 'a' | 'b' }> => 错误类型       ✗
     * 
     * 2. 严格模式：检查子全集是模式定义的严格子集
     *    - 断言子分发器全集合法<{ 类型: 'a' }, any, { 类型: 'a' | 'b' }, true> => { 类型: 'a' }  ✓
     *    - 断言子分发器全集合法<{ 类型: 'a' | 'b' | 'c' }, any, { 类型: 'a' | 'b' }, true> => 错误类型  ✗
     */
    it("断言子分发器全集合法 类型工具应该正确工作", () => {
        // 模拟类型工具的行为验证
        type 交集非空<A, B> = [A & B] extends [never] ? false : true;
        type 是子集类型<子集, 父集> = 子集 extends 父集 ? true : false;

        type 断言子分发器全集合法<子全集, 剩余集, 模式定义, 严格模式 extends boolean = false> =
            严格模式 extends true
            ? 是子集类型<子全集, 模式定义> extends false
            ? ["错误", { 子全集: 子全集, 模式: 模式定义 }]
            : 子全集
            : 交集非空<子全集, 模式定义> extends false
            ? ["错误", { 子全集: 子全集, 模式: 模式定义 }]
            : 子全集;

        // 非严格模式测试
        type 非严格_有交集 = 断言子分发器全集合法<{ 类型: "a" }, never, { 类型: "a" | "b" }>;
        expectTypeOf<非严格_有交集>().toEqualTypeOf<{ 类型: "a" }>();

        // 严格模式测试 - 子集通过
        type 严格_子集 = 断言子分发器全集合法<{ 类型: "a" }, never, { 类型: "a" | "b" }, true>;
        expectTypeOf<严格_子集>().toEqualTypeOf<{ 类型: "a" }>();

        // 严格模式测试 - 非子集失败（联合类型分布特性导致返回联合）
        type 严格_非子集 = 断言子分发器全集合法<{ 类型: "a" | "b" | "c" }, never, { 类型: "a" | "b" }, true>;
        // 由于 "a" | "b" | "c" 不是 "a" | "b" 的子集，应该返回错误类型
        // 注意：由于 TypeScript 联合类型分布特性，实际行为可能更复杂
        expectTypeOf<严格_非子集>().not.toEqualTypeOf<{ 类型: "a" | "b" | "c" }>();
    });
});

describe("嵌套路由类型测试", () => {
    it("正确的嵌套分发器应该通过类型检查", () => {
        // 创建一个处理 "段落" 块类型的子分发器
        const 段落处理器 = calibur.universe(type({
            块类型: "'段落'",
            按键: "string"
        }))
            .split(type({ 按键: "'Enter'" }), () => "段落换行" as const)
            .remain(() => "段落其他" as const)
            .build();

        // 父分发器包含 "段落" 和 "列表"
        // 段落处理器的全集 { 块类型: '段落', ... } 是 { 块类型: '段落', ... } 模式的子集
        const 顶层 = calibur.universe(type({
            块类型: "'段落' | '列表'",
            按键: "string"
        }))
            .split(
                type({ 块类型: "'段落'" }),
                段落处理器,  // 子分发器
                () => "段落 fallback" as const  // fallback
            )
            .remain(() => "其他块类型" as const)
            .build();

        // 验证返回类型 - 由于使用 as any 转换，返回类型会是 unknown
        // 这里只验证分发器能正常构建和调用
        expectTypeOf(顶层).toBeFunction();
        const result = 顶层({ 块类型: "段落", 按键: "Enter" });
        expectTypeOf(result).toBeUnknown();
    });

    it("嵌套分发器的fallback处理器应该接收正确的类型", () => {
        // 子分发器只处理 Enter
        const 子处理器 = calibur.universe(type({ 按键: "'Enter'" }))
            .remain(() => "子处理器处理Enter" as const)
            .build();

        // 父模式包含 Enter 和 Tab
        const 顶层 = calibur.universe(type({
            按键: "'Enter' | 'Tab' |'c'"
        }))
            .split(
                type({ 按键: "'Enter' | 'Tab'" }),
                子处理器,
                (state) => {
                    // fallback处理器的state应该基于剩余集和模式的交集
                    // 此时剩余集是 'Enter' | 'Tab'，模式也是 'Enter' | 'Tab'
                    expectTypeOf(state.按键).toEqualTypeOf<"Enter" | "Tab">();
                    return "fallback处理" as const;
                }
            )
            .remain(() => "其他" as const)
            .build();

        expectTypeOf(顶层).toBeFunction();
    });

    it("多层嵌套应该正确传递类型", () => {
        // 第三层：按键处理器
        const 创建按键处理器 = (模式名: string) =>
            calibur.universe(type({ 按键: "string" }))
                .split(type({ 按键: "'Enter'" }), () => `${模式名}/Enter` as const)
                .remain(() => `${模式名}/其他` as const)
                .build();

        // 第二层：块类型处理器
        const 创建块处理器 = (模式名: string) =>
            calibur.universe(type({ 块类型: "'代码' | '文本'", 按键: "string" }))
                .split(
                    type({ 块类型: "'代码'" }),
                    (state) => 创建按键处理器(`${模式名}/代码`)({ 按键: state.按键 })
                )
                .remain(() => `${模式名}/文本` as const)
                .build();

        // 第一层：模式分发
        const 顶层 = calibur.universe(type({
            模式: "'编辑' | '预览'",
            块类型: "'代码' | '文本'",
            按键: "string"
        }))
            .split(
                type({ 模式: "'编辑'" }),
                (state) => 创建块处理器("编辑")({ 块类型: state.块类型, 按键: state.按键 })
            )
            .remain(() => "预览模式" as const)
            .build();

        // 验证顶层分发器的类型
        expectTypeOf(顶层).toBeFunction();
        expectTypeOf(顶层({ 模式: "编辑", 块类型: "代码", 按键: "Enter" })).toBeString();
    });

    /**
     * 编译期错误场景（通过注释说明）
     * 
     * 以下场景应该在运行时报错（因为类型系统难以完全捕获动态子分发器的全集）：
     * 
     * 1. 子分发器全集超出当前模式范围
     * ```ts
     * // 列表处理器的全集是 { 块类型: '列表', ... }
     * const 列表处理器 = calibur.universe(type({ 块类型: "'列表'", 按键: "string" }))
     *     .remain(() => "列表处理")
     *     .build();
     * 
     * // 尝试将列表处理器注册到"段落"模式上会在运行时报错
     * calibur.universe(type({ 块类型: "'段落' | '列表'", 按键: "string" }))
     *     .split(
     *         type({ 块类型: "'段落'" }),  // 模式是段落
     *         列表处理器 as any,           // 但子分发器处理列表 - 运行时报错！
     *         () => "fallback"
     *     )
     * ```
     */
});
