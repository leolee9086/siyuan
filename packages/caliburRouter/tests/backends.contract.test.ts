import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import * as Schema from "effect/Schema";
import { arktypeBackend } from "../src/adapters/arktype.js";
import type { 状态空间模式 } from "../src/core/types.js";
import { effectBackend, effectCalibur, effectState } from "../src/effect.js";
import { zodBackend, zodCalibur, zodState } from "../src/zod.js";

describe("ArkType 调用方边界", () => {
    it("对缺少公开运行时能力的模式显式报错", () => {
        const malformed = {infer: undefined} as 状态空间模式;
        expect(() => arktypeBackend.assertPattern(malformed)).toThrow(/缺少运行时能力/);
    });

    it("对缺少跨 scope 绑定能力的模式显式报错", () => {
        const malformed = Object.assign(() => true, {
            infer: undefined,
            description: "malformed",
            json: {},
            and: () => malformed,
            or: () => malformed,
            extends: () => false,
            get: () => malformed,
            distribute: () => [malformed],
            $: {},
        }) as 状态空间模式;

        expect(() => arktypeBackend.assertPattern(malformed))
            .toThrow(/\$\.internal\.bindReference/);
    });
});

describe("Zod 形式化状态后端", () => {
    it("从原生 Schema 导入并无损导出", () => {
        const nativeUniverse = z.object({
            mode: z.enum(["edit", "readonly"]),
            context: z.object({ focused: z.boolean() }),
        });
        const universe = zodState.fromSchema(nativeUniverse);
        const readonlyPattern = zodState.fromSchema(z.object({ mode: z.literal("readonly") }));
        type Universe = typeof universe.infer;

        expectTypeOf<Universe>().toEqualTypeOf<{
            mode: "edit" | "readonly";
            context: { focused: boolean };
        }>();
        expect(zodState.toSchema(universe)).toBe(nativeUniverse);

        const dispatch = zodCalibur.universe(universe)
            .split(readonlyPattern, () => "readonly" as const)
            .remain((state) => {
                expectTypeOf(state.mode).toEqualTypeOf<"edit">();
                return "edit" as const;
            })
            .build();
        expect(dispatch({ mode: "edit", context: { focused: true } })).toBe("edit");
    });

    it("原生转换拒绝不可证明的 Zod 能力", () => {
        expect(() => zodState.fromSchema(z.string().refine((value) => value.length > 0))).toThrow(/checks/);
        expect(() => zodState.fromSchema(z.string().transform((value) => value.length))).toThrow(/pipe/);
        expect(() => zodState.fromSchema(z.object({ value: z.string().optional() }))).toThrow(/optional/);
        expect(() => zodState.fromSchema(z.array(z.string()))).toThrow(/array/);
        expect(() => zodState.fromSchema(z.strictObject({ value: z.string() }))).toThrow(/catchall/);
    });

    it("保持层次状态收窄并在完整覆盖后耗尽", () => {
        const universe = zodState.object({
            mode: zodState.enumerated("edit", "readonly", "demo"),
            panel: zodState.enumerated("search", "menu", "hint", "slash", "none"),
        });

        const builder = zodCalibur.universe(universe)
            .split(
                zodState.object({ panel: zodState.enumerated("search", "menu", "hint", "slash") }),
                (state) => {
                    expectTypeOf(state.mode).toEqualTypeOf<"edit" | "readonly" | "demo">();
                    expectTypeOf(state.panel).toEqualTypeOf<"search" | "menu" | "hint" | "slash">();
                    return "panel" as const;
                },
            )
            .split(
                zodState.object({
                    mode: zodState.enumerated("readonly", "demo"),
                    panel: zodState.literal("none"),
                }),
                () => "non-edit" as const,
            )
            .split(
                zodState.object({ mode: zodState.literal("edit"), panel: zodState.literal("none") }),
                () => "edit" as const,
            );

        expectTypeOf(builder).not.toHaveProperty("remain");
        const dispatch = builder.build();
        expect(dispatch({ mode: "demo", panel: "menu" })).toBe("panel");
        expect(dispatch({ mode: "readonly", panel: "none" })).toBe("non-edit");
        expect(dispatch({ mode: "edit", panel: "none" })).toBe("edit");
    });

    it("阻断重叠模式并拒绝任意 Zod Schema", () => {
        expect(() => zodCalibur.universe(z.object({ mode: z.string() }) as never))
            .toThrow(/形式化状态构造器/);
        expect(() => zodCalibur.universe(zodState.object({ mode: zodState.string() }))
            .split(zodState.object({ mode: zodState.literal("edit") }), () => 1)
            // @ts-expect-error 此处故意验证运行时重叠保护。
            .split(zodState.object({ mode: zodState.literal("edit") }), () => 2))
            .toThrow(/重叠/);
    });
});

describe("Effect Schema 形式化状态后端", () => {
    it("从原生 Schema 导入并无损导出", () => {
        const nativeUniverse = Schema.Struct({
            mode: Schema.Literal("edit", "readonly"),
            context: Schema.Struct({ focused: Schema.Boolean }),
        });
        const universe = effectState.fromSchema(nativeUniverse);
        const readonlyPattern = effectState.fromSchema(Schema.Struct({ mode: Schema.Literal("readonly") }));
        type Universe = typeof universe.infer;

        expectTypeOf<Universe>().toEqualTypeOf<{
            readonly mode: "edit" | "readonly";
            readonly context: { readonly focused: boolean };
        }>();
        expect(effectState.toSchema(universe)).toBe(nativeUniverse);

        const dispatch = effectCalibur.universe(universe)
            .split(readonlyPattern, () => "readonly" as const)
            .remain((state) => {
                expectTypeOf(state.mode).toEqualTypeOf<"edit">();
                return "edit" as const;
            })
            .build();
        expect(dispatch({ mode: "edit", context: { focused: true } })).toBe("edit");
    });

    it("原生转换拒绝不可证明的 Effect Schema 能力", () => {
        expect(() => effectState.fromSchema(Schema.String.pipe(Schema.minLength(1)))).toThrow(/Refinement/);
        expect(() => effectState.fromSchema(Schema.NumberFromString)).toThrow(/Transformation/);
        expect(() => effectState.fromSchema(Schema.Struct({ value: Schema.optional(Schema.String) })))
            .toThrow(/optional/);
        expect(() => effectState.fromSchema(Schema.Array(Schema.String))).toThrow(/TupleType/);
        expect(() => effectState.fromSchema(Schema.Number)).toThrow(/NumberKeyword/);
    });

    it("保持层次状态收窄并在完整覆盖后耗尽", () => {
        const universe = effectState.object({
            mode: effectState.enumerated("edit", "readonly", "demo"),
            panel: effectState.enumerated("search", "menu", "hint", "slash", "none"),
        });

        const builder = effectCalibur.universe(universe)
            .split(
                effectState.object({ panel: effectState.enumerated("search", "menu", "hint", "slash") }),
                (state) => {
                    expectTypeOf(state.mode).toEqualTypeOf<"edit" | "readonly" | "demo">();
                    expectTypeOf(state.panel).toEqualTypeOf<"search" | "menu" | "hint" | "slash">();
                    return "panel" as const;
                },
            )
            .split(
                effectState.object({
                    mode: effectState.enumerated("readonly", "demo"),
                    panel: effectState.literal("none"),
                }),
                () => "non-edit" as const,
            )
            .split(
                effectState.object({ mode: effectState.literal("edit"), panel: effectState.literal("none") }),
                () => "edit" as const,
            );

        expectTypeOf(builder).not.toHaveProperty("remain");
        const dispatch = builder.build();
        expect(dispatch({ mode: "demo", panel: "menu" })).toBe("panel");
        expect(dispatch({ mode: "readonly", panel: "none" })).toBe("non-edit");
        expect(dispatch({ mode: "edit", panel: "none" })).toBe("edit");
    });

    it("阻断重叠模式", () => {
        expect(() => effectCalibur.universe(effectState.object({ mode: effectState.string() }))
            .split(effectState.object({ mode: effectState.literal("edit") }), () => 1)
            // @ts-expect-error 此处故意验证运行时重叠保护。
            .split(effectState.object({ mode: effectState.literal("edit") }), () => 2))
            .toThrow(/重叠/);
    });
});

describe("形式化后端公共契约", () => {
    it("基础域、有限值和对象投影具有相同集合语义", () => {
        const cases = [
            {
                backend: zodBackend,
                string: zodState.string(),
                edit: zodState.literal("edit"),
                universe: zodState.object({
                    mode: zodState.enumerated("edit", "readonly"),
                    enabled: zodState.boolean(),
                }),
                editMode: zodState.object({ mode: zodState.literal("edit") }),
                readonlyMode: zodState.object({ mode: zodState.literal("readonly") }),
            },
            {
                backend: effectBackend,
                string: effectState.string(),
                edit: effectState.literal("edit"),
                universe: effectState.object({
                    mode: effectState.enumerated("edit", "readonly"),
                    enabled: effectState.boolean(),
                }),
                editMode: effectState.object({ mode: effectState.literal("edit") }),
                readonlyMode: effectState.object({ mode: effectState.literal("readonly") }),
            },
        ];

        for (const state of cases) {
            expect(state.backend.isSubset(state.edit, state.string)).toBe(true);
            expect(state.backend.overlaps(state.editMode, state.readonlyMode)).toBe(false);
            expect(state.backend.covers(state.universe, [state.editMode, state.readonlyMode])).toBe(true);
            expect(state.backend.match(state.universe, { mode: "edit", enabled: true })).not.toBeNull();
            expect(state.backend.match(state.universe, { mode: "other", enabled: true })).toBeNull();
        }
    });

    it("拒绝跨后端嵌套分发器", () => {
        const child = effectCalibur.universe(effectState.object({ mode: effectState.literal("edit") }))
            .remain(() => "effect")
            .build();

        expect(() => zodCalibur.universe(zodState.object({ mode: zodState.string() }))
            .split(zodState.object({ mode: zodState.literal("edit") }), child, () => "zod"))
            .toThrow(/不同的 Schema 后端/);
    });

    it("两个 number 构造器都使用有限 JSON number 语义", () => {
        expect(zodBackend.match(zodState.number(), Number.NaN)).toBeNull();
        expect(effectBackend.match(effectState.number(), Number.NaN)).toBeNull();
        expect(() => zodState.literal(Number.POSITIVE_INFINITY)).toThrow(/有限 JSON number/);
        expect(() => effectState.literal(Number.POSITIVE_INFINITY)).toThrow(/有限 JSON number/);
    });
});
