import {beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("../../../src/protyle/render/av/blockAttr", () => ({
    renderAVAttribute: vi.fn(),
}));

import {AVAttributePanel} from "../../../src/protyle/render/av/attributePanel";

describe("AVAttributePanel header", () => {
    beforeEach(() => {
        Object.defineProperty(window, "siyuan", {
            configurable: true,
            value: {
                config: {
                    editor: {
                        databaseAttrHideEmpty: false,
                        databaseAttrUseTabs: false,
                        databaseAttrViewMode: 0,
                    },
                },
                languages: {
                    database: "Database",
                },
            },
        });
    });

    it("uses the collapse icon as the only header icon and keeps the full title directly in the label", () => {
        const panel = new AVAttributePanel({} as IProtyle);
        const headerElement = panel.element.querySelector<HTMLElement>(".protyle-db-attr__header");
        const labelElement = headerElement?.querySelector<HTMLElement>(".block__logo");

        expect(headerElement).not.toBeNull();
        expect(labelElement?.textContent).toBe("Database");
        expect(labelElement?.querySelector(".block__logoicon")).toBeNull();
        expect(labelElement?.querySelector("span")).toBeNull();
    });
});
