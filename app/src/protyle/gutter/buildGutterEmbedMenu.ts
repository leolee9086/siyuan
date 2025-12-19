import { blockRender } from "../render/blockRender";
import { fetchPost } from "../../util/fetch";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

const buildRefreshItem = (protyle: IProtyle, nodeElement: Element): IMenu => {
    return {
        id: "refresh",
        icon: "iconRefresh",
        label: `${siyuanI18n.refresh} SQL`,
        click() {
            nodeElement.removeAttribute("data-render");
            blockRender(protyle, nodeElement);
        }
    };
};

const buildUpdateItem = (protyle: IProtyle, nodeElement: Element): IMenu => {
    return {
        id: "update",
        icon: "iconEdit",
        label: `${siyuanI18n.update} SQL`,
        click() {
            protyle.toolbar.showRender(protyle, nodeElement);
        }
    };
};

const buildBreadcrumbItem = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    const breadcrumb = nodeElement.getAttribute("breadcrumb");
    const isChecked = breadcrumb === "true" || (window.siyuan.config.editor.embedBlockBreadcrumb && breadcrumb !== "false");
    return {
        id: "embedBlockBreadcrumb",
        label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${siyuanI18n.embedBlockBreadcrumb}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${isChecked ? " checked" : ""}></div>`,
        bind(element) {
            element.addEventListener("click", (event) => {
                const target = event.target as HTMLElement;
                const inputElement = element.querySelector("input");
                if (!inputElement) {
                    return;
                }
                if (target.tagName !== "INPUT") {
                    inputElement.checked = !inputElement.checked;
                }
                nodeElement.setAttribute("breadcrumb", inputElement.checked.toString());
                fetchPost("/api/attr/setBlockAttrs", {
                    id,
                    attrs: { breadcrumb: inputElement.checked.toString() }
                });
                nodeElement.removeAttribute("data-render");
                blockRender(protyle, nodeElement);
                window.siyuan.menus.menu.remove();
            });
        }
    };
};

const updateHeadingMode = (protyle: IProtyle, nodeElement: Element, id: string, mode: string) => {
    if (mode) {
        nodeElement.setAttribute("custom-heading-mode", mode);
    } else {
        nodeElement.removeAttribute("custom-heading-mode");
    }
    fetchPost("/api/attr/setBlockAttrs", {
        id,
        attrs: { "custom-heading-mode": mode }
    });
    nodeElement.removeAttribute("data-render");
    blockRender(protyle, nodeElement);
};

const buildHeadingEmbedModeMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    return {
        id: "headingEmbedMode",
        label: siyuanI18n.headingEmbedMode,
        type: "submenu",
        submenu: [{
            id: "showHeadingWithBlocks",
            label: siyuanI18n.showHeadingWithBlocks,
            iconHTML: "",
            checked: nodeElement.getAttribute("custom-heading-mode") === "0",
            click() {
                updateHeadingMode(protyle, nodeElement, id, "0");
            }
        }, {
            id: "showHeadingOnlyTitle",
            label: siyuanI18n.showHeadingOnlyTitle,
            iconHTML: "",
            checked: nodeElement.getAttribute("custom-heading-mode") === "1",
            click() {
                updateHeadingMode(protyle, nodeElement, id, "1");
            }
        }, {
            id: "showHeadingOnlyBlocks",
            label: siyuanI18n.showHeadingOnlyBlocks,
            iconHTML: "",
            checked: nodeElement.getAttribute("custom-heading-mode") === "2",
            click() {
                updateHeadingMode(protyle, nodeElement, id, "2");
            }
        }, {
            id: "default",
            label: siyuanI18n.default,
            iconHTML: "",
            checked: !nodeElement.getAttribute("custom-heading-mode"),
            click() {
                updateHeadingMode(protyle, nodeElement, id, "");
            }
        }]
    };
};

export const buildGutterEmbedMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    return {
        id: "blockEmbed",
        type: "submenu",
        icon: "iconSQL",
        label: siyuanI18n.blockEmbed,
        submenu: [
            buildRefreshItem(protyle, nodeElement),
            buildUpdateItem(protyle, nodeElement),
            {
                type: "separator"
            },
            buildBreadcrumbItem(protyle, nodeElement, id),
            buildHeadingEmbedModeMenu(protyle, nodeElement, id)
        ]
    };
};
