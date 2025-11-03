import { addScript } from "../util/addScript";
import { Constants } from "../../constants";
import { genIconHTML } from "./util";
import { hasClosestByClassName } from "../util/hasClosest";
import { looseJsonParse } from "../../util/code/looseJsonParse";

const ABCJS_PARAMS_KEY = "%%params";

// Read the abcjsParams from the content if it exists.
// The params *must* be the first line of the content in the form:
// %%params JSON
const getAbcParams = async (abcString: string): Promise<any> => {
    let params = {
        responsive: "resize",
    };
    const firstLine = abcString.substring(0, abcString.indexOf("\n"));
    if (firstLine.startsWith(ABCJS_PARAMS_KEY)) {
        try {
            let result = await looseJsonParse(firstLine.substring(ABCJS_PARAMS_KEY.length));
            if (result.responsive) {
                params = result
            }
        } catch (e) {
            console.error(`Failed to parse ABCJS params: ${e}`);
        }
    }
    return params;
};

// 渲染单个ABC元素
const renderSingleAbcElement = async (element: Element, wysiwygElement: HTMLElement ) => {
    if (element.getAttribute("data-render") === "true") {
        return;
    }
    if (!element.firstElementChild?.classList.contains("protyle-icons")) {
        element.insertAdjacentHTML("afterbegin", genIconHTML(wysiwygElement ));
    }
    const renderElement = element.firstElementChild?.nextElementSibling;
    if (renderElement) {
        renderElement.innerHTML = `<span style="position: absolute;left:0;top:0;width: 1px;">${Constants.ZWSP}</span><div contenteditable="false"></div>`;
        const dataContent = element.getAttribute("data-content");
        if (dataContent) {
            const abcString = Lute.UnEscapeHTMLStr(dataContent);
            const lastElement = renderElement.lastElementChild;
            if (lastElement) {
                window.ABCJS.renderAbc(lastElement, abcString, await getAbcParams(abcString));
            }
        }
    }
    element.setAttribute("data-render", "true");
};

export const abcRender = async (element: Element, cdn = Constants.PROTYLE_CDN) => {
    let abcElements: Element[] = [];
    if (element.getAttribute("data-subtype") === "abc") {
        // 编辑器内代码块编辑渲染
        abcElements = [element];
    } else {
        abcElements = Array.from(element.querySelectorAll('[data-subtype="abc"]'));
    }
    if (abcElements.length === 0) {
        return;
    }
    if (abcElements.length > 0) {
        await addScript(`${cdn}/js/abcjs/abcjs-basic-min.js?v=6.5.0`, "protyleAbcjsScript");
        const wysiwygElement = hasClosestByClassName(element, "protyle-wysiwyg", true);
        for await (const e of abcElements) {
          wysiwygElement&&  await renderSingleAbcElement(e, wysiwygElement );
        }
    }
};
