import { describe, expect, test } from "vitest";
import { type as packageType, scope as packageScope } from "arktype";
import { type as consumerType, scope as consumerScope } from "arktype-consumer";
import { calibur } from "../src/index.js";
import { 是子集, 有交集 } from "../src/utils/setOps.js";

describe("ArkType 跨安装与跨 scope 适配", () => {
    test("不要求包侧与消费者侧固定同一版本", () => {
        const universe = packageType({ mode: "'edit' | 'readonly'" });
        const edit = consumerType({ mode: "'edit'" });
        const readonly = consumerType({ mode: "'readonly'" });

        expect(是子集(edit, universe)).toBe(true);
        expect(有交集(edit, readonly)).toBe(false);

        const dispatch = calibur.universe(universe)
            .split(edit, () => "edit")
            .split(readonly, () => "readonly")
            .build();

        expect(dispatch({ mode: "edit" })).toBe("edit");
        expect(dispatch({ mode: "readonly" })).toBe("readonly");
    });

    test("独立 scope 的嵌套路由在绑定后保持层次化分发", () => {
        const parentUniverse = packageScope({
            State: {
                mode: "'edit' | 'readonly'",
                panel: "'tools' | 'none'",
            },
        }).resolve("State");
        const childUniverse = consumerScope({
            State: { mode: "'edit'", panel: "'tools' | 'none'" },
        }).resolve("State");
        const child = calibur.universe(childUniverse)
            .split(consumerType({ panel: "'tools'" }), () => "tools")
            .remain(() => "none")
            .build();

        const dispatch = calibur.universe(parentUniverse)
            .split(
                packageType({ mode: "'edit'" }),
                child,
                () => "edit-none",
            )
            .remain(() => "readonly")
            .build();

        expect(dispatch({ mode: "edit", panel: "tools" })).toBe("tools");
        expect(dispatch({ mode: "edit", panel: "none" })).toBe("none");
        expect(dispatch({ mode: "readonly", panel: "none" })).toBe("readonly");
    });
});
