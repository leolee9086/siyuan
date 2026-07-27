/** 用途：读取空标题协议键；使用范围：响应映射；解耦评估：经本域网关直达稳定声明。 */
import {Constants} from "./imports";
/** 用途：请求文档信息；使用范围：文件点击分支；解耦评估：经本域网关保持现有回调协议。 */
import {fetchPost} from "./imports";
/** 用途：读取快捷键配置；使用范围：菜单描述；解耦评估：经本域网关保持缺失配置时显式失败。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取重命名文案；使用范围：菜单描述；解耦评估：经本域网关保持缺失语言表时显式失败。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：判断加密笔记本；使用范围：请求参数构建；解耦评估：经本域网关读取当前笔记本状态。 */
import {isEncryptedBox} from "./imports";
/** 用途：构建菜单 DOM；使用范围：工厂同步返回；解耦评估：经本域网关使用菜单领域唯一实现。 */
import {MenuItem} from "./imports";
/** 用途：执行重命名；使用范围：两类点击分支；解耦评估：经本域网关直达既有命令。 */
import {rename} from "./imports";

/**
 * 作用：同步创建文件或笔记本的重命名菜单项。
 * 意图：集中保留文档标题读取、加密笔记本上下文和既有重命名命令顺序。
 * 调用时机：文件树构建单项菜单时调用，点击后才执行请求或重命名。
 * @同步豁免: UI构建 - 必须在菜单 popup 前同步返回 DOM 元素，改为异步会改变现有 append 顺序。
 */
export const renameMenu = (options: {
    path: string
    notebookId: string
    name: string,
    type: "notebook" | "file"
    docId?: string | null
}) => {
    return new MenuItem({
        id: "rename",
        accelerator: getSiyuanConfig().keymap.editor.general.rename.custom,
        icon: "iconEdit",
        label: getSiyuanLanguages().rename,
        /** 笔记本或无文档 ID 的条目直接重命名；文档则先读取真实标题属性。 */
        click: () => {
            // 只有具备文档 ID 的文件需要读取标题及空标题标记。
            if (options.type !== "file" || !options.docId) {
                rename(options);
                return;
            }
            const docInfoParam: IObject = {
                id: options.docId
            };
            // 加密笔记本的文档信息位于独立上下文，请求必须携带 notebook。
            if (isEncryptedBox(options.notebookId)) {
                docInfoParam.notebook = options.notebookId;
            }
            /** 请求结束后在同一回调阶段执行重命名。 */
            fetchPost("/api/block/getDocInfo", docInfoParam, (response) => rename(resolveRenameOptions(options, response)));
        }
    }).element;
};

/** 将文档信息响应映射为既有重命名命令参数；仅在文件重命名请求完成后计算。 */
const resolveRenameOptions = (options: Parameters<typeof renameMenu>[0], response: IWebSocketData) => {
    return {
        ...options,
        name: response.data.ial.title,
        empty: response.data.ial[Constants.CUSTOM_SY_TITLE_EMPTY] === "true",
    };
};
