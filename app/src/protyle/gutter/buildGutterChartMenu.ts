/**
 * 构建图表(echarts/mindmap)相关菜单
 */
import { updateTransaction } from "../wysiwyg/transaction";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { getEchartsInstanceById } from "../../util/siyuanEnvironments/echarts.environment";

interface IGutterChartMenuContext {
    protyle: IProtyle;
    nodeElement: Element;
    id: string;
}

/** 处理图表高度变化 */
function 处理图表高度变化(
    event: Event,
    nodeElement: Element,
    protyle: IProtyle,
    getCurrentHtml: () => string,
    setCurrentHtml: (html: string) => void
) {
    const inputElement = event.target as HTMLInputElement;
    const newHeight = (inputElement.value || "420") + "px";
    (nodeElement as HTMLElement).style.height = newHeight;
    updateTransaction(protyle, nodeElement, getCurrentHtml());
    setCurrentHtml(nodeElement.outerHTML);
    event.stopPropagation();

    const renderElement = nodeElement.querySelector('[contenteditable="false"]') as HTMLElement | null;
    if (!renderElement) {
        return;
    }

    renderElement.style.height = newHeight;
    const instanceId = renderElement.getAttribute("_echarts_instance_") || "";
    const chartInstance = getEchartsInstanceById(instanceId);
    if (!chartInstance) {
        return;
    }
    chartInstance.resize();
}

/**
 * 构建图表菜单(用于echarts/mindmap类型的代码块)
 */
export function buildGutterChartMenu(context: IGutterChartMenuContext) {
    const { protyle, nodeElement } = context;

    const height = (nodeElement as HTMLElement).style.height;
    let html = nodeElement.outerHTML;

    return {
        id: "chart",
        label: siyuanI18n.chart,
        icon: "iconCode",
        submenu: [
            {
                id: "height",
                iconHTML: "",
                type: "readonly",
                label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${height ? parseInt(height) : "420"}" step="1" min="148" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.height}"><span class="fn__flex-center">px</span></div>`,
                bind: (element: HTMLElement) => {
                    const inputElement = element.querySelector("input");
                    // @内联回调
                    inputElement?.addEventListener("change", (event) => {
                        处理图表高度变化(
                            event,
                            nodeElement,
                            protyle,
                            () => html,
                            (newHtml) => {
                                html = newHtml;
                            }
                        );
                    });
                }
            },
            {
                id: "update",
                label: siyuanI18n.update,
                icon: "iconEdit",
                click() {
                    protyle.toolbar?.showRender(protyle, nodeElement);
                }
            }
        ]
    };
}
