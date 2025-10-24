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
<div class="b3-form__icon fn__size200">
    <svg class="b3-form__icon-icon"><use xlink:href="#iconSearch"></use></svg>
    <input placeholder="${window.siyuan.languages.search}" class="b3-text-field fn__block b3-form__icon-input">
</div>
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
        
        // 获取搜索输入框并添加事件监听
        const searchElement = dialog.element.querySelector("input");
        searchElement.focus();
        
        // 当搜索框内容变化时，调用 Vue 组件的 setSearchKey 方法
        searchElement.addEventListener("compositionend", () => {
            const component = vueInstance.$refs.recentDocsComponent as InstanceType<typeof RecentDocs>;
            if (component && component.setSearchKey) {
                component.setSearchKey(searchElement.value);
            }
        });
        
        searchElement.addEventListener("input", (event: InputEvent) => {
            if (event.isComposing) {
                return;
            }
            const component = vueInstance.$refs.recentDocsComponent as InstanceType<typeof RecentDocs>;
            if (component && component.setSearchKey) {
                component.setSearchKey(searchElement.value);
            }
        });
        
        dialog.element.setAttribute("data-key", Constants.DIALOG_RECENTDOCS);
        dialog.element.addEventListener("click", (event) => {
            const liElement = hasClosestByClassName(event.target as HTMLElement, "b3-list-item");
            if (liElement) {
                dialog.element.querySelector(".b3-list-item--focus")?.classList.remove("b3-list-item--focus");
                liElement.classList.add("b3-list-item--focus");
                window.dispatchEvent(new KeyboardEvent("keydown", {key: "Enter"}));
                event.stopPropagation();
                event.preventDefault();
            }
        });
    });
};
