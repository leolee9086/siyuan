import {fetchPost} from "../util/fetch";
import {createApp} from "vue";
import {Dialog} from "../dialog";
import {Constants} from "../constants";
import {focusByRange} from "../protyle/util/selection";
import {hasClosestByClassName} from "../protyle/util/hasClosest";
import {hideElements} from "../protyle/ui/hideElements";
import RecentDocs from "../components/recentDocs.vue";
export const openRecentDocs = () => {
    const openRecentDocsDialog = window.siyuan.dialogs.find(item => {
        if (item.element.getAttribute("data-key") === Constants.DIALOG_RECENTDOCS) {
            return true;
        }
    });
    if (openRecentDocsDialog) {
        hideElements(["dialog"]);
        return;
    }
    fetchPost("/api/storage/getRecentDocs", {}, (response) => {
        let range: Range;
        if (getSelection().rangeCount > 0) {
            range = getSelection().getRangeAt(0);
        }
        const dialog = new Dialog({
            positionId: Constants.DIALOG_RECENTDOCS,
            title: `<div class="fn__flex">
<div class="fn__flex-center">${window.siyuan.languages.recentDocs}</div>
<div class="fn__flex-1"></div>
</div>`,
            content: "",
            height: "80vh",
            destroyCallback: () => {
                if (range && range.getBoundingClientRect().height !== 0) {
                    focusByRange(range);
                }
            }
        });
        
        // 创建一个容器元素用于挂载 Vue 应用
        const container = document.createElement("div");
        dialog.element.querySelector(".b3-dialog__body").appendChild(container);
        
        // 创建 Vue 应用实例并挂载
        const vueInstance = createApp({
            components: {
                RecentDocs
            },
            setup() {
                const recentDocs = response.data;
                
                const handleDocSelected = (doc: { rootID: string, icon: string, title: string }) => {
                    fetchPost("/api/filetree/openDoc", {
                        id: doc.rootID,
                        action: [0, 1]
                    });
                };
                
                return {
                    recentDocs,
                    handleDocSelected
                };
            },
            template: `<RecentDocs :recent-docs="recentDocs" @doc-selected="handleDocSelected" ref="recentDocsComponent" />`
        }).mount(container);
        
        // 聚焦搜索框（现在由组件内部处理）
        const component = vueInstance.$refs.recentDocsComponent as InstanceType<typeof RecentDocs>;
        if (component && component.focusSearchInput) {
            component.focusSearchInput();
        }
        
        dialog.element.setAttribute("data-key", Constants.DIALOG_RECENTDOCS);
    });
};
