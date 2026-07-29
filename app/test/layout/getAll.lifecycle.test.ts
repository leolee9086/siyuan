import {beforeEach, describe, expect, it, vi} from "vitest";
import {editorModelBrand} from "../../src/editor/model/editorDomain.types";

interface LayoutEnvironmentFixture {
    layout?: {
        layout: {
            children: Array<{
                element: HTMLElement;
                headersElement: HTMLElement;
                children: Array<{
                    headElement: HTMLElement;
                    model?: object;
                }>;
            }>;
        };
    };
}

const environment = vi.hoisted<LayoutEnvironmentFixture>(() => ({}));

vi.mock("../../src/util/siyuanEnvironments/getSiyuanConfig.environment", () => ({
    getSafeSiyuanLayout: () => environment.layout,
    getSafeSiyuanConfig: () => undefined,
    getSiyuanBlockPanels: () => [],
}));

vi.mock("../../src/util/siyuanEnvironments/siyuanDialogs.environment", () => ({
    getSiyuanDialogs: () => [],
}));

describe("getAllModels layout lifecycle", () => {
    beforeEach(() => {
        const pendingTab = {
            headElement: document.createElement("li"),
        };
        pendingTab.headElement.dataset.initdata = JSON.stringify({instance: "Editor"});
        const editorModel = {
            [editorModelBrand]: "Editor" as const,
        };
        environment.layout = {
            layout: {
                children: [{
                    element: document.createElement("div"),
                    headersElement: document.createElement("ul"),
                    children: [
                        pendingTab,
                        {
                            headElement: document.createElement("li"),
                            model: editorModel,
                        },
                    ],
                }],
            },
        };
    });

    it("skips tabs whose delayed model has not been mounted yet", async () => {
        const {getAllModels} = await import("../../src/layout/getAll");

        expect(() => getAllModels()).not.toThrow();
        expect(getAllModels().editor).toHaveLength(1);
    });
});
