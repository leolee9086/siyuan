/**
 * CalibURRouter Bug 暴露测试：模式重叠检测
 * 
 * 根据 design.md 的设计预期：
 * > 如果尝试切割一个与已切割模式有交集的模式，类型系统报错
 * > 互不相交：Sᵢ ∩ Sⱼ = ∅ （i ≠ j）
 * 
 * 这个测试验证：当两个模式有重叠时，库应该在运行时报错
 */

import { describe, it, expect } from "vitest";
import { type } from "arktype";
import { calibur } from "../src/index.js";

describe("Bug 暴露：模式重叠检测", () => {
    it("当 split 的模式与已有模式完全重叠时应该报错", () => {
        // 场景：先定义 { 按键: 'Enter' }，再定义相同的模式
        // 预期：第二个 split 应该报错，因为模式完全相同
        // 实际：不会报错，第二个模式永远不会被匹配

        expect(() => {
            calibur.universe(type({ 按键: "string" }))
                .split(type({ 按键: "'Enter'" }), () => "第一个")
                // @ts-expect-error
                .split(type({ 按键: "'Enter'" }), () => "第二个") // 完全重叠！
                .remain(() => "默认")
                .build();
        }).toThrow(/重叠|overlap|已存在|duplicate/i);
    });

    it("当 split 的模式是已有模式的子集时应该报错", () => {
        // 场景：先定义 { 按键: 'Enter' }，再定义 { 按键: 'Enter', ctrl: true }
        // 更具体的模式是更宽泛模式的子集
        // 预期：第二个 split 应该报错或警告，因为它永远不会被匹配

        expect(() => {
            calibur.universe(type({ 按键: "string", ctrl: "boolean" }))
                .split(type({ 按键: "'Enter'" }), () => "宽泛模式")
                // @ts-expect-error
                .split(type({ 按键: "'Enter'", ctrl: "true" }), () => "更具体但永远不会匹配") // 子集！
                .remain((state) => "默认")
                .build();
        }).toThrow(/重叠|overlap|子集|subset|unreachable/i);
    });

    it("当 split 的模式与已有模式有部分交集时应该报错", () => {
        // 场景：
        // - 第一个模式: { 按键: 'Enter' | 'Tab' }
        // - 第二个模式: { 按键: 'Tab' | 'Space' }
        // 两者在 'Tab' 上有交集
        // 预期：第二个 split 应该报错

        expect(() => {
            calibur.universe(type({ 按键: "string" }))
                .split(type({ 按键: "'Enter' | 'Tab'" }), () => "Enter或Tab")
                // @ts-expect-error
                .split(type({ 按键: "'Tab' | 'Space'" }), () => "Tab或Space") // 有交集！
                .remain(() => "默认")
                .build();
        }).toThrow(/重叠|overlap|交集|intersection/i);
    });

    it("不重叠的模式应该正常工作", () => {
        // 对照组：确保不重叠的模式不会报错

        const dispatch = calibur.universe(type({ 按键: "string", ctrl: "boolean" }))
            .split(type({ 按键: "'Enter'" }), () => "回车")
            .split(type({ 按键: "'Tab'" }), () => "制表符") // 不重叠
            .split(type({ 按键: "'Space'" }), () => "空格") // 不重叠
            .remain(() => "默认")
            .build();

        expect(dispatch({ 按键: "Enter", ctrl: false })).toBe("回车");
        expect(dispatch({ 按键: "Tab", ctrl: false })).toBe("制表符");
        expect(dispatch({ 按键: "Space", ctrl: false })).toBe("空格");
        expect(dispatch({ 按键: "a", ctrl: false })).toBe("默认");
    });
});

describe("Bug 暴露：模式优先级陷阱（已修复）", () => {
    it("先宽后窄的定义顺序现在会正确报错", () => {
        // 修复后的行为：由于模式重叠检测，这段代码在 build 之前就会抛出错误
        // 用户需要使用嵌套分发器来处理这种情况

        expect(() => {
            calibur.universe(type({ 按键: "string", ctrl: "boolean" }))
                .split(type({ 按键: "'Enter'" }), () => "宽泛的Enter")
                // @ts-expect-error
                .split(type({ 按键: "'Enter'", ctrl: "true" }), (state) => "具体的Ctrl+Enter")
                .remain(() => "默认")
                .build();
        }).toThrow(/重叠|overlap/i);
    });

    it("正确的做法：使用嵌套分发器处理子集关系", () => {
        // 正确的方式：先定义具体模式，在处理器中处理子情况
        // 或者使用嵌套分发器

        const dispatch = calibur.universe(type({ 按键: "string", ctrl: "boolean" }))
            .split(
                type({ 按键: "'Enter'" }),
                (state) => state.ctrl ? "具体的Ctrl+Enter" : "普通Enter"
            )
            .split(type({ 按键: "'Tab'" }), (state) => "Tab")
            .remain(() => "默认")
            .build();

        expect(dispatch({ 按键: "Enter", ctrl: true })).toBe("具体的Ctrl+Enter");
        expect(dispatch({ 按键: "Enter", ctrl: false })).toBe("普通Enter");
        expect(dispatch({ 按键: "Tab", ctrl: false })).toBe("Tab");
    });
});
