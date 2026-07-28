import {type} from "arktype";
import {z} from "zod";
import {calibur} from "calibur-router";
import {effectCalibur, effectState} from "calibur-router/effect";
import {zodCalibur, zodState} from "calibur-router/zod";

const nativeZodSchema = z.object({
    mode: z.enum(["edit", "readonly"]),
    focused: z.boolean(),
});

export const portableNativeZodPattern = zodState.fromSchema(nativeZodSchema);
export const portableNativeZodRoundTrip = zodState.toSchema(portableNativeZodPattern);
export const portableNativeZodProjection = portableNativeZodRoundTrip.pick({mode: true});

export const portableArkTypeRouter = calibur
    .universe(type({
        mode: "'edit' | 'readonly'",
        context: {focused: "boolean"},
    }))
    .split(type({mode: "'edit'"}), state => state.context.focused)
    .remain(state => state.mode)
    .build();

export const portableZodRouter = zodCalibur
    .universe(zodState.object({
        mode: zodState.enumerated("edit", "readonly"),
        context: zodState.object({focused: zodState.boolean()}),
    }))
    .split(
        zodState.object({mode: zodState.literal("edit")}),
        state => state.context.focused,
    )
    .remain(state => state.mode)
    .build();

export const portableEffectRouter = effectCalibur
    .universe(effectState.object({
        mode: effectState.enumerated("edit", "readonly"),
        context: effectState.object({focused: effectState.boolean()}),
    }))
    .split(
        effectState.object({mode: effectState.literal("edit")}),
        state => state.context.focused,
    )
    .remain(state => state.mode)
    .build();

export const portableZodUnion = zodState.union(
    zodState.object({kind: zodState.literal("left")}),
    zodState.object({kind: zodState.literal("right")}),
);

export const portableEffectUnion = effectState.union(
    effectState.object({kind: effectState.literal("left")}),
    effectState.object({kind: effectState.literal("right")}),
);
