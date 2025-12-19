import { blockRender } from "../render/blockRender";
import { fetchPost } from "../../util/fetch";
import { siyuanI18n } from "../../util/siyuanEnvironments/i18n.getI18n.environment";

export const buildGutterEmbedMenu = (protyle: IProtyle, nodeElement: Element, id: string): IMenu => {
    const breadcrumb = nodeElement.getAttribute("breadcrumb");
    return {
        id: "blockEmbed",
        type: "submenu",
        icon: "iconSQL",
        label: siyuanI18n.blockEmbed,
        submenu: [{
            id: "refresh",
            icon: "iconRefresh",
            label: `${siyuanI18n.refresh} SQL`,
            click() {
                nodeElement.removeAttribute("data-render");
                blockRender(protyle, nodeElement);
            }
        }, {
            id: "update",
            icon: "iconEdit",
            label: `${siyuanI18n.update} SQL`,
            click() {
                protyle.toolbar.showRender(protyle, nodeElement);
            }
        }, {
            type: "separator"
        }, {
            id: "embedBlockBreadcrumb",
            label: `<div class="fn__flex" style="margin-bottom: 4px"><span>${siyuanI18n.embedBlockBreadcrumb}</span><span class="fn__space fn__flex-1"></span>
<input type="checkbox" class="b3-switch fn__flex-center"${breadcrumb === "true" ? " checked" : ((window.siyuan.config.editor.embedBlockBreadcrumb && breadcrumb !== "false") ? " checked" : "")}></div>`,
            bind(element) {
                element.addEventListener("click", (event: MouseEvent & { target: HTMLElement }) => {
                    const inputElement = element.querySelector("input");
                    if (event.target.tagName !== "INPUT") {
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
        }, {
            id: "headingEmbedMode",
            label: siyuanI18n.headingEmbedMode,
            type: "submenu",
            submenu: [{
                id: "showHeadingWithBlocks",
                label: siyuanI18n.showHeadingWithBlocks,
                iconHTML: "",
                checked: nodeElement.getAttribute("custom-heading-mode") === "0",
                click() {
                    nodeElement.setAttribute("custom-heading-mode", "0");
                    fetchPost("/api/attr/setBlockAttrs", {
                        id,
                        attrs: { "custom-heading-mode": "0" }
                    });
                    nodeElement.removeAttribute("data-render");
                    blockRender(protyle, nodeElement);
                }
            }, {
                id: "showHeadingOnlyTitle",
                label: siyuanI18n.showHeadingOnlyTitle,
                iconHTML: "",
                checked: nodeElement.getAttribute("custom-heading-mode") === "1",
                click() {
                    nodeElement.setAttribute("custom-heading-mode", "1");
                    fetchPost("/api/attr/setBlockAttrs", {
                        id,
                        attrs: { "custom-heading-mode": "1" }
                    });
                    nodeElement.removeAttribute("data-render");
                    blockRender(protyle, nodeElement);
                }
            }, {
                id: "showHeadingOnlyBlocks",
                label: siyuanI18n.showHeadingOnlyBlocks,
                iconHTML: "",
                checked: nodeElement.getAttribute("custom-heading-mode") === "2",
                click() {
                    nodeElement.setAttribute("custom-heading-mode", "2");
                    fetchPost("/api/attr/setBlockAttrs", {
                        id,
                        attrs: { "custom-heading-mode": "2" }
                    });
                    nodeElement.removeAttribute("data-render");
                    blockRender(protyle, nodeElement);
                }
            }, {
                id: "default",
                label: siyuanI18n.default,
                iconHTML: "",
                checked: !nodeElement.getAttribute("custom-heading-mode"),
                click() {
                    nodeElement.removeAttribute("custom-heading-mode");
                    fetchPost("/api/attr/setBlockAttrs", {
                        id,
                        attrs: { "custom-heading-mode": "" }
                    });
                    nodeElement.removeAttribute("data-render");
                    blockRender(protyle, nodeElement);
                }
            }]
        }]
    };
};
