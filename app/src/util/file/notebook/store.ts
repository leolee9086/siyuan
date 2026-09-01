/** 用途：笔记本列表请求；使用范围：刷新内存状态；解耦评估：经同域网关声明基础设施。 */
import {fetchPost} from "./imports";
/** 用途：读取当前笔记本集合；使用范围：查询与局部更新；解耦评估：经同域网关声明状态端口。 */
import {getSiyuanNotebooks} from "./imports";
/** 用途：替换当前笔记本集合；使用范围：刷新成功回调；解耦评估：经同域网关声明状态端口。 */
import {setSiyuanNotebooks} from "./imports";
/** 用途：同步笔记本响应中的顶层文档开关；使用范围：普通笔记本刷新；解耦评估：经同域网关声明配置状态端口。 */
import {getSiyuanConfig} from "./imports";

/** 按 ID 查找当前工作空间的笔记本。 */
const findNotebookById = (id: string) => getSiyuanNotebooks().find((item) => item.id === id);

/** 取得笔记本名称。 @同步豁免: UI构建 */
export const getNotebookName = (id: string) => findNotebookById(id)?.name ?? "";

/** 取得笔记本图标。 @同步豁免: UI构建 */
export const getNotebookIcon = (id: string) => findNotebookById(id)?.icon ?? "";

/** 更新内存中的笔记本名称。 @同步豁免: UI构建 */
export const setNotebookName = (id: string, name: string) => {
    const notebook = findNotebookById(id);
    if (notebook) {
        notebook.name = name;
    }
};

/** 统计当前打开的笔记本数量。 @同步豁免: UI构建 */
export const getOpenNotebookCount = () => getSiyuanNotebooks().filter((item) => !item.closed).length;

/** 返回指定 boxID 是否为加密笔记本。 @同步豁免: 请求参数构建 */
export const isEncryptedBox = (boxId: string): boolean => {
    if (!boxId) {
        return false;
    }
    return !!findNotebookById(boxId)?.encrypted;
};

/** 为加密笔记本内的请求参数附加 notebook 上下文。 @同步豁免: 请求参数构建 */
export const withEncryptedNotebook = (boxId: string, params: IObject) => isEncryptedBox(boxId)
    ? {...params, notebook: boxId}
    : params;

/** 按普通或闪卡请求语义应用笔记本响应。 */
const handleNotebookResponse = (
    response: IWebSocketData,
    callback?: (notebooks: INotebook[]) => void,
    flashcard = false,
) => {
    // 闪卡请求只消费临时结果，不覆盖全局笔记本集合。
    if (flashcard && callback) {
        callback(response.data.notebooks);
        return;
    }
    // 普通请求是全局笔记本列表的权威刷新来源。
    if (!flashcard) {
        setSiyuanNotebooks(response.data.notebooks);
        getSiyuanConfig().fileTree.boxDocEnabled = response.data.boxDocEnabled;
    }
    // 普通刷新在更新全局集合后继续通知调用者；无回调时只完成状态写入。
    if (callback) {
        callback(response.data.notebooks);
    }
};

/** 从内核刷新笔记本集合；闪卡模式只把结果交给调用者。 @同步豁免: 遗留代码 */
// @柯里化 固定笔记本列表端点与普通/闪卡响应策略，调用者只提供结果回调和模式。
export const setNoteBook = (callback?: (notebooks: INotebook[]) => void, flashcard = false) =>
    fetchPost("/api/notebook/lsNotebooks", {flashcard}, (response) => {
        handleNotebookResponse(response, callback, flashcard);
    });
