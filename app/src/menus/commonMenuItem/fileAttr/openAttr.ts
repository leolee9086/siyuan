/** 用途：读取块属性；使用范围：编辑器属性入口；解耦评估：经本子域网关直达统一请求实现。 */
import {fetchPost} from "./imports";
/** 用途：呈现完整文件属性对话框；使用范围：属性请求成功回调；解耦评估：同一 File Attribute 子域内直达唯一 UI 所有者。 */
import {openFileAttr} from "./openFileAttr";

/**
 * 从块元素打开完整属性界面；分隔线不具备属性身份，因此保持现有同步短路。
 * @同步豁免: 遗留代码 - 六个编辑器事件入口依赖同步发起回调式请求，改为 async 会无依据地改变返回身份。
 */
export const openAttr = (nodeElement: Element, focusName = "bookmark", protyle: IProtyle) => {
    if (nodeElement.getAttribute("data-type") === "NodeThematicBreak") {
        return;
    }
    const id = nodeElement.getAttribute("data-node-id");
    fetchPost("/api/attr/getBlockAttrs", {id}, (response) => {
        openFileAttr(response.data, focusName, protyle);
    });
};
