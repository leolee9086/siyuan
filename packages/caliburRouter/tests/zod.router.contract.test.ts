import { describe, expect, expectTypeOf, it } from "vitest";
import { zodCalibur, zodState } from "../src/zod.js";

describe("Zod 路由完整契约", () => {
    it("单分支与 remain 正确分发", () => {
        const dispatch = zodCalibur.universe(zodState.object({
            event: zodState.enumerated("click", "hover"),
            enabled: zodState.boolean(),
        }))
            .split(zodState.object({ event: zodState.literal("click") }), () => "click" as const)
            .remain((state) => {
                expectTypeOf(state.event).toEqualTypeOf<"hover">();
                expectTypeOf(state.enabled).toEqualTypeOf<boolean>();
                return "hover" as const;
            })
            .build();

        expect(dispatch({ event: "click", enabled: true })).toBe("click");
        expect(dispatch({ event: "hover", enabled: false })).toBe("hover");
    });

    it("多次切割后保持精确剩余集", () => {
        zodCalibur.universe(zodState.object({ event: zodState.enumerated("a", "b", "c") }))
            .split(zodState.object({ event: zodState.literal("a") }), () => "a")
            .split(zodState.object({ event: zodState.literal("b") }), () => "b")
            .remain((state) => {
                expectTypeOf(state).toEqualTypeOf<{ event: "c" }>();
                return state.event;
            });
    });

    it("递归收窄嵌套对象剩余集", () => {
        zodCalibur.universe(zodState.object({
            context: zodState.object({
                mode: zodState.enumerated("edit", "read"),
                focus: zodState.boolean(),
            }),
            key: zodState.string(),
        }))
            .split(
                zodState.object({ context: zodState.object({ mode: zodState.literal("edit") }) }),
                (state) => {
                    expectTypeOf(state.context.mode).toEqualTypeOf<"edit">();
                    expectTypeOf(state.context.focus).toEqualTypeOf<boolean>();
                    return "edit";
                },
            )
            .remain((state) => {
                expectTypeOf(state.context.mode).toEqualTypeOf<"read">();
                expectTypeOf(state.key).toEqualTypeOf<string>();
                return "read";
            });
    });

    it("完整覆盖同时触发编译期与运行时耗尽", () => {
        const builder = zodCalibur.universe(zodState.object({ kind: zodState.enumerated("a", "b") }))
            .split(zodState.object({ kind: zodState.literal("a") }), () => "a")
            .split(zodState.object({ kind: zodState.literal("b") }), () => "b");

        expectTypeOf(builder).not.toHaveProperty("remain");
        expect(() => {
            // @ts-expect-error 完整覆盖后只允许 build。
            builder.remain(() => "unreachable");
        }).toThrow(/剩余集为空/);
    });

    it("编译期与运行时都阻断重叠模式", () => {
        expect(() => zodCalibur.universe(zodState.object({ key: zodState.string() }))
            .split(zodState.object({ key: zodState.enumerated("Enter", "Tab") }), () => 1)
            // @ts-expect-error Tab 与前一个模式重叠。
            .split(zodState.object({ key: zodState.enumerated("Tab", "Space") }), () => 2))
            .toThrow(/重叠/);
    });

    it("嵌套分发器和父 fallback 按各自状态空间分发", () => {
        const child = zodCalibur.universe(zodState.object({
            block: zodState.literal("code"),
            key: zodState.literal("Enter"),
        }))
            .remain(() => "code-enter" as const)
            .build();

        const parent = zodCalibur.universe(zodState.object({
            block: zodState.enumerated("code", "text"),
            key: zodState.string(),
        }))
            .split(
                zodState.object({ block: zodState.literal("code") }),
                child,
                (state) => {
                    expectTypeOf(state.block).toEqualTypeOf<"code">();
                    return "code-other" as const;
                },
            )
            .remain(() => "text" as const)
            .build();

        expect(parent({ block: "code", key: "Enter" })).toBe("code-enter");
        expect(parent({ block: "code", key: "Tab" })).toBe("code-other");
        expect(parent({ block: "text", key: "Enter" })).toBe("text");
    });

    it("阻断非法子全集和缺失 fallback", () => {
        const child = zodCalibur.universe(zodState.object({ block: zodState.literal("text") }))
            .remain(() => "text")
            .build();
        const parent = zodCalibur.universe(zodState.object({
            block: zodState.enumerated("code", "text"),
        }));

        expect(() => parent.split(
            zodState.object({ block: zodState.literal("code") }),
            // @ts-expect-error 子全集与父模式不相交。
            child,
            () => "fallback",
        )).toThrow(/不是当前模式的子集/);

        const validChild = zodCalibur.universe(zodState.object({ block: zodState.literal("code") }))
            .remain(() => "code")
            .build();
        expect(() => parent.split(
            zodState.object({ block: zodState.literal("code") }),
            // @ts-expect-error 嵌套分发器必须声明父 fallback。
            validChild,
        )).toThrow(/必须提供第三参数 fallback/);
    });

    it("三层嵌套路由保持运行结果", () => {
        const keyRouter = zodCalibur.universe(zodState.object({ key: zodState.literal("Enter") }))
            .remain(() => "enter" as const)
            .build();
        const blockRouter = zodCalibur.universe(zodState.object({
            mode: zodState.literal("edit"),
            block: zodState.literal("code"),
            key: zodState.string(),
        }))
            .split(zodState.object({ key: zodState.literal("Enter") }), keyRouter, () => "key-fallback" as const)
            .remain(() => "code-other" as const)
            .build();
        const modeRouter = zodCalibur.universe(zodState.object({
            mode: zodState.enumerated("edit", "read"),
            block: zodState.enumerated("code", "text"),
            key: zodState.string(),
        }))
            .split(zodState.object({ mode: zodState.literal("edit"), block: zodState.literal("code") }),
                blockRouter, () => "block-fallback" as const)
            .remain(() => "other-mode" as const)
            .build();

        expect(modeRouter({ mode: "edit", block: "code", key: "Enter" })).toBe("enter");
        expect(modeRouter({ mode: "edit", block: "code", key: "Tab" })).toBe("code-other");
        expect(modeRouter({ mode: "read", block: "text", key: "Enter" })).toBe("other-mode");
    });
});
