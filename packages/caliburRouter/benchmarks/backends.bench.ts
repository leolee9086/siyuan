import { bench, describe } from "vitest";
import { type } from "arktype";
import { calibur } from "../src/index.js";
import { effectCalibur, effectState } from "../src/effect.js";
import { zodCalibur, zodState } from "../src/zod.js";

const arktypeUniverse = type({ mode: "'edit' | 'readonly' | 'demo'", panel: "'tools' | 'none'" });
const arktypeRouter = calibur.universe(arktypeUniverse)
    .split(type({ panel: "'tools'" }), () => "tools")
    .split(type({ mode: "'readonly' | 'demo'", panel: "'none'" }), () => "non-edit")
    .split(type({ mode: "'edit'", panel: "'none'" }), () => "edit")
    .build();

const zodUniverse = zodState.object({
    mode: zodState.enumerated("edit", "readonly", "demo"),
    panel: zodState.enumerated("tools", "none"),
});
const zodRouter = zodCalibur.universe(zodUniverse)
    .split(zodState.object({ panel: zodState.literal("tools") }), () => "tools")
    .split(zodState.object({ mode: zodState.enumerated("readonly", "demo"), panel: zodState.literal("none") }),
        () => "non-edit")
    .split(zodState.object({ mode: zodState.literal("edit"), panel: zodState.literal("none") }), () => "edit")
    .build();

const effectUniverse = effectState.object({
    mode: effectState.enumerated("edit", "readonly", "demo"),
    panel: effectState.enumerated("tools", "none"),
});
const effectRouter = effectCalibur.universe(effectUniverse)
    .split(effectState.object({ panel: effectState.literal("tools") }), () => "tools")
    .split(effectState.object({ mode: effectState.enumerated("readonly", "demo"),
        panel: effectState.literal("none") }), () => "non-edit")
    .split(effectState.object({ mode: effectState.literal("edit"), panel: effectState.literal("none") }), () => "edit")
    .build();

const input = { mode: "edit" as const, panel: "none" as const };

describe("热路径分发", () => {
    bench("ArkType", () => arktypeRouter(input));
    bench("Zod", () => zodRouter(input));
    bench("Effect Schema", () => effectRouter(input));
});

describe("三分支路由构建", () => {
    bench("ArkType", () => calibur.universe(arktypeUniverse)
        .split(type({ panel: "'tools'" }), () => "tools")
        .split(type({ mode: "'readonly' | 'demo'", panel: "'none'" }), () => "non-edit")
        .split(type({ mode: "'edit'", panel: "'none'" }), () => "edit")
        .build());

    bench("Zod", () => zodCalibur.universe(zodUniverse)
        .split(zodState.object({ panel: zodState.literal("tools") }), () => "tools")
        .split(zodState.object({ mode: zodState.enumerated("readonly", "demo"),
            panel: zodState.literal("none") }), () => "non-edit")
        .split(zodState.object({ mode: zodState.literal("edit"), panel: zodState.literal("none") }), () => "edit")
        .build());

    bench("Effect Schema", () => effectCalibur.universe(effectUniverse)
        .split(effectState.object({ panel: effectState.literal("tools") }), () => "tools")
        .split(effectState.object({ mode: effectState.enumerated("readonly", "demo"),
            panel: effectState.literal("none") }), () => "non-edit")
        .split(effectState.object({ mode: effectState.literal("edit"),
            panel: effectState.literal("none") }), () => "edit")
        .build());
});
