import {hideElements} from "../ui/hideElements";
import {isSupportCSSHL} from "../render/searchMarkRender";
import {getAIEditorDestroy} from "../../ai/editorLifecycle.port";
import {cancelAssetUploads} from "../upload/pluginEvent";
import {unmountBreadcrumbButtons} from "../../plugin/breadcrumbButton";

export const destroy = (protyle: IProtyle) => {
    if (!protyle) {
        return;
    }
    cancelAssetUploads(protyle);
    unmountBreadcrumbButtons(protyle);
    hideElements(["util"], protyle, true);
    getAIEditorDestroy()(protyle);
    protyle.hint?.destroy();
    protyle.preview?.destroy();
    if (isSupportCSSHL()) {
        protyle.highlight.markHL.clear();
        protyle.highlight.mark.clear();
        protyle.highlight.ranges = [];
        protyle.highlight.rangeIndex = 0;
    }
    protyle.observer?.disconnect();
    protyle.observerLoad?.disconnect();
    protyle.element.classList.remove("protyle");
    protyle.element.removeAttribute("style");
    if (protyle.wysiwyg) {
        protyle.wysiwyg.destroy();
        protyle.wysiwyg.tableControl?.destroy();
        protyle.wysiwyg.lastHTMLs = {};
    }
    if (protyle.undo) {
        protyle.undo.clear();
    }
    const websocketModel = protyle.ws;
    // 导出、静态或尚未连接的 Protyle 没有 WebSocket；已存在的连接沿用原关闭与延迟重试语义。
    if (websocketModel) {
        try {
            websocketModel.send("closews", {});
        } catch (e) {
            setTimeout(() => {
                websocketModel.send("closews", {});
            }, 10240);
        }
    }
    protyle.app.plugins.forEach(item => {
        item.eventBus.emit("destroy-protyle", {
            protyle,
        });
    });
};
