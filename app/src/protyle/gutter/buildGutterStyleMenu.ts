import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";
import { MenuItem } from "../../menus/Menu.Item";
import {updateBatchTransaction} from "../wysiwyg/transaction/update";
import {transaction} from "../wysiwyg/transaction/submit";
import { focusBlock } from "../util/selection";
import { chartRender } from "../render/chartRender";
import { getEchartsInstanceById } from "../../util/siyuanEnvironments/echarts.environment";
import { Constants } from "../../constants";

const genClick = (nodeElements: Element[], protyle: IProtyle, cb: (e: HTMLElement) => void) => {
    updateBatchTransaction(nodeElements, protyle, cb);
    focusBlock(nodeElements[0]);
};

const updateNodeElements = (nodeElements: Element[], protyle: IProtyle, inputElement: HTMLInputElement) => {
    const undoOperations: IOperation[] = [];
    const operations: IOperation[] = [];
    nodeElements.forEach((e) => {
        e.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
        undoOperations.push({
            action: "update",
            id: e.getAttribute("data-node-id"),
            data: e.outerHTML
        });
    });
    inputElement.addEventListener(inputElement.type === "number" ? "blur" : "change", () => {
        nodeElements.forEach((e: HTMLElement) => {
            e.setAttribute(Constants.ATTRIBUTE_EDITING, "true");
            operations.push({
                action: "update",
                id: e.getAttribute("data-node-id"),
                data: e.outerHTML
            });
            // 当节点为 echarts 图表时，调整图表尺寸并重新渲染
            if (e.getAttribute("data-subtype") === "echarts") {
                const echartsEl = e.querySelector("[_echarts_instance_]");
                const instanceAttr = echartsEl?.getAttribute("_echarts_instance_") ?? null;
                const chartInstance = getEchartsInstanceById(instanceAttr);
                chartInstance?.resize();
                chartRender(e);
            }
        });
        transaction(protyle, operations, undoOperations);
        window.siyuan.menus.menu.remove();
        focusBlock(nodeElements[0]);
    });
};

export const buildGutterAlignMenu = (nodeElements: Element[], protyle: IProtyle): IMenu => {
    const disabledRTL = nodeElements.some(e => ["NodeAttributeView", "NodeCodeBlock", "NodeMathBlock"].includes(e.getAttribute("data-type")));
    // 水平超级块（columns 布局）支持垂直对齐，展示 alignTop/Middle/Bottom 与恢复默认垂直对齐菜单项
    const isHorizontalSuperBlock = nodeElements.length === 1 &&
        nodeElements[0].getAttribute("data-type") === "NodeSuperBlock" &&
        nodeElements[0].getAttribute("data-sb-layout") === "col";
    const verticalAlign = isHorizontalSuperBlock ? (nodeElements[0] as HTMLElement).style.alignItems : "";
    const verticalAlignMenu: IMenu[] = isHorizontalSuperBlock ? [{
        id: "alignTop",
        icon: "iconAlignTop",
        label: window.siyuan.languages.alignTop,
        checked: verticalAlign === "flex-start",
        click: () => {
            genClick(nodeElements, protyle, (e: HTMLElement) => {
                e.style.alignItems = "flex-start";
            });
        },
    }, {
        id: "alignMiddle",
        icon: "iconAlignMiddle",
        label: window.siyuan.languages.alignMiddle,
        checked: verticalAlign === "center",
        click: () => {
            genClick(nodeElements, protyle, (e: HTMLElement) => {
                e.style.alignItems = "center";
            });
        },
    }, {
        id: "alignBottom",
        icon: "iconAlignBottom",
        label: window.siyuan.languages.alignBottom,
        checked: verticalAlign === "flex-end",
        click: () => {
            genClick(nodeElements, protyle, (e: HTMLElement) => {
                e.style.alignItems = "flex-end";
            });
        },
    }, {
        id: "useDefaultVerticalAlign",
        label: window.siyuan.languages.useDefaultVerticalAlign,
        checked: verticalAlign === "",
        click: () => {
            genClick(nodeElements, protyle, (e: HTMLElement) => {
                e.style.alignItems = "";
            });
        },
    }, {
        id: "separator_verticalAlign",
        type: "separator",
    }] : [];
    return {
        id: "layout",
        label: siyuanI18n.layout,
        type: "submenu",
        submenu: [{
            id: "alignLeft",
            icon: "iconAlignLeft",
            label: siyuanI18n.alignLeft,
            accelerator: window.siyuan.config.keymap.editor.general.alignLeft.custom,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("av")) {
                        e.style.justifyContent = "";
                    } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                        e.style.margin = "";
                    } else {
                        e.style.textAlign = "left";
                    }
                });
            }
        }, {
            id: "alignCenter",
            icon: "iconAlignCenter",
            label: siyuanI18n.alignCenter,
            accelerator: window.siyuan.config.keymap.editor.general.alignCenter.custom,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("av")) {
                        e.style.justifyContent = "center";
                    } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                        e.style.margin = "0 auto";
                    } else {
                        e.style.textAlign = "center";
                    }
                });
            }
        }, {
            id: "alignRight",
            icon: "iconAlignRight",
            label: siyuanI18n.alignRight,
            accelerator: window.siyuan.config.keymap.editor.general.alignRight.custom,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("av")) {
                        e.style.justifyContent = "flex-end";
                    } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                        e.style.margin = "0 0 0 auto";
                    } else {
                        e.style.textAlign = "right";
                    }
                });
            }
        }, {
            id: "justify",
            icon: "iconMenu",
            label: siyuanI18n.justify,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    e.style.textAlign = "justify";
                });
            }
        }, {
            id: "separator_1",
            type: "separator"
        }, ...verticalAlignMenu, {
            id: "ltr",
            icon: "iconLtr",
            ignore: disabledRTL,
            label: siyuanI18n.ltr,
            accelerator: window.siyuan.config.keymap.editor.general.ltr.custom,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("table")) {
                        e.querySelector("table").style.direction = "ltr";
                    } else if (e.getAttribute("data-type") === "NodeHTMLBlock") {
                        (e.querySelector("protyle-html") as HTMLElement).style.direction = "ltr";
                    } else {
                        e.style.direction = "ltr";
                    }
                });
            }
        }, {
            id: "rtl",
            icon: "iconRtl",
            ignore: disabledRTL,
            label: siyuanI18n.rtl,
            accelerator: window.siyuan.config.keymap.editor.general.rtl.custom,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("table")) {
                        e.querySelector("table").style.direction = "rtl";
                    } else if (e.getAttribute("data-type") === "NodeHTMLBlock") {
                        (e.querySelector("protyle-html") as HTMLElement).style.direction = "rtl";
                    } else {
                        e.style.direction = "rtl";
                    }
                });
            }
        }, {
            id: "separator_2",
            ignore: disabledRTL,
            type: "separator"
        }, {
            id: "clearFontStyle",
            icon: "iconTrashcan",
            label: siyuanI18n.clearFontStyle,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.classList.contains("av")) {
                        e.style.justifyContent = "";
                    } else if (["NodeIFrame", "NodeWidget"].includes(e.getAttribute("data-type"))) {
                        e.style.margin = "";
                    } else {
                        e.style.textAlign = "";
                        e.style.direction = "";
                        if (e.getAttribute("data-type") === "NodeSuperBlock") {
                            e.style.alignItems = "";
                        }
                    }
                });
            }
        }]
    };
};

export const buildGutterWidthsMenu = (nodeElements: Element[], protyle: IProtyle): IMenu | null => {
    if (nodeElements.some((e: HTMLElement) => e.parentElement?.classList.contains("sb"))) {
        return null;
    }
    let rangeElement: HTMLInputElement;
    const firstElement = nodeElements[0] as HTMLElement;
    const styles: IMenu[] = [{
        id: "widthInput",
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${firstElement.style.width.endsWith("px") ? parseInt(firstElement.style.width) : ""}" type="number" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.width}"><span class="fn__flex-center">px</span></div>`,
        bind: (element) => {
            const inputElement = element.querySelector("input");
            inputElement.addEventListener("input", () => {
                nodeElements.forEach((item: HTMLElement) => {
                    item.style.width = inputElement.value + "px";
                    item.style.flex = "none";
                });
                rangeElement.value = "0";
                rangeElement.parentElement.setAttribute("aria-label", inputElement.value + "px");
            });
            updateNodeElements(nodeElements, protyle, inputElement);
        }
    }];
    ["25%", "33%", "50%", "67%", "75%", "100%"].forEach((item) => {
        styles.push({
            id: "width_" + item,
            iconHTML: "",
            label: item,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    e.style.width = item;
                    e.style.flex = "none";
                });
            }
        });
    });
    styles.push({
        id: "separator_1",
        type: "separator"
    });
    const width = firstElement.style.width.endsWith("%") ? parseInt(firstElement.style.width) : 0;
    return {
        id: "width",
        label: siyuanI18n.width,
        submenu: styles.concat([{
            id: "widthDrag",
            iconHTML: "",
            type: "readonly",
            label: `<div style="margin: 4px 0;" aria-label="${firstElement.style.width.endsWith("px") ? firstElement.style.width : (firstElement.style.width || siyuanI18n.default)}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${width}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
            bind: (element) => {
                rangeElement = element.querySelector("input");
                rangeElement.addEventListener("input", () => {
                    nodeElements.forEach((e: HTMLElement) => {
                        e.style.width = rangeElement.value + "%";
                        e.style.flex = "none";
                    });
                    rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}%`);
                });
                updateNodeElements(nodeElements, protyle, rangeElement);
            }
        }, {
            id: "separator_2",
            type: "separator"
        }, {
            id: "default",
            iconHTML: "",
            label: siyuanI18n.default,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.style.width) {
                        e.style.width = "";
                        e.style.flex = "";
                    }
                });
            }
        }]),
    };
};

export const buildGutterHeightsMenu = (nodeElements: Element[], protyle: IProtyle): IMenu | null => {
    const matchHeight = nodeElements.find(item => {
        if (!item.classList.contains("p") && !item.classList.contains("code-block") && !item.classList.contains("render-node")) {
            return true;
        }
    });
    if (matchHeight) {
        return null;
    }
    let rangeElement: HTMLInputElement;
    const firstElement = nodeElements[0] as HTMLElement;
    const styles: IMenu[] = [{
        id: "heightInput",
        iconHTML: "",
        type: "readonly",
        label: `<div class="fn__flex"><input class="b3-text-field fn__flex-1" value="${firstElement.style.height.endsWith("px") ? parseInt(firstElement.style.height) : ""}" type="number" style="margin: 4px 8px 4px 0" placeholder="${siyuanI18n.height}"><span class="fn__flex-center">px</span></div>`,
        bind: (element) => {
            const inputElement = element.querySelector("input");
            inputElement.addEventListener("input", () => {
                nodeElements.forEach((item: HTMLElement) => {
                    item.style.height = inputElement.value + "px";
                    item.style.flex = "none";
                });
                rangeElement.value = "0";
                rangeElement.parentElement.setAttribute("aria-label", inputElement.value + "px");
            });
            updateNodeElements(nodeElements, protyle, inputElement);
        }
    }];
    ["25%", "33%", "50%", "67%", "75%", "100%"].forEach((item) => {
        styles.push({
            id: "height_" + item,
            iconHTML: "",
            label: item,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    e.style.height = item;
                    e.style.flex = "none";
                });
            }
        });
    });
    styles.push({
        type: "separator"
    });
    const height = firstElement.style.height.endsWith("%") ? parseInt(firstElement.style.height) : 0;
    return {
        id: "heightDrag",
        label: siyuanI18n.height,
        submenu: styles.concat([{
            iconHTML: "",
            type: "readonly",
            label: `<div style="margin: 4px 0;" aria-label="${firstElement.style.height.endsWith("px") ? firstElement.style.height : (firstElement.style.height || siyuanI18n.default)}" class="b3-tooltips b3-tooltips__n"><input style="box-sizing: border-box" value="${height}" class="b3-slider fn__block" max="100" min="1" step="1" type="range"></div>`,
            bind: (element) => {
                rangeElement = element.querySelector("input");
                rangeElement.addEventListener("input", () => {
                    nodeElements.forEach((e: HTMLElement) => {
                        e.style.height = rangeElement.value + "%";
                        e.style.flex = "none";
                    });
                    rangeElement.parentElement.setAttribute("aria-label", `${rangeElement.value}%`);
                });
                updateNodeElements(nodeElements, protyle, rangeElement);
            }
        }, {
            type: "separator"
        }, {
            id: "default",
            iconHTML: "",
            label: siyuanI18n.default,
            click: () => {
                genClick(nodeElements, protyle, (e: HTMLElement) => {
                    if (e.style.height) {
                        e.style.height = "";
                        e.style.overflow = "";
                    }
                });
            }
        }]),
    };
};
