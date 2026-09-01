import {describe, expect, it} from "vitest";
import {getRelationHTML} from "../../src/asset/anno/anno.getRelationHTML";
import {getRectElementsByNodeId} from "../../src/asset/anno/anno.guard";
import {showHighlight} from "../../src/asset/anno/anno.showHighlight";

const maliciousID = `annotation"]><img src=x onerror="alert(1)">`;

const createPdf = () => {
    const textLayer = document.createElement("div");
    textLayer.append(document.createElement("span"));
    const page = {
        textLayer: {div: textLayer},
        viewport: {
            clone: () => ({
                convertToViewportRectangle: (rect: number[]) => [rect[0], rect[1], rect[2], rect[3]],
            }),
        },
    };
    return {
        pdfViewer: {
            getPageView: () => page,
        },
    };
};

describe("PDF annotation security (GHSA-fqpw-c3pj-w8g9)", () => {
    it("matches a literal annotation ID without parsing it as a selector", () => {
        const root = document.createElement("div");
        const rect = document.createElement("div");
        rect.setAttribute("data-node-id", maliciousID);
        root.append(rect);

        expect(getRectElementsByNodeId(root, maliciousID)).toEqual([rect]);
    });

    it("does not create markup from a persisted annotation ID or content", () => {
        const pdf = createPdf();
        const result = showHighlight({
            color: "red",
            content: `<img src=x onerror="alert(1)">`,
            coords: [[0, 0, 20, 20]],
            id: maliciousID,
            index: 0,
            mode: "text",
            type: "text",
        }, pdf);

        expect(result.getAttribute("data-node-id")).toBe(maliciousID);
        expect(result.getAttribute("data-content")).toBe(`<img src=x onerror="alert(1)">`);
        expect(result.querySelector("img")).toBeNull();
    });

    it("escapes persisted relation IDs in both HTML contexts", () => {
        const relationHTML = getRelationHTML([maliciousID]);

        expect(relationHTML).not.toContain(`<img src=x onerror="alert(1)">`);
        expect(relationHTML).toContain("&quot;");
        expect(relationHTML).toContain("&lt;img");
    });
});
