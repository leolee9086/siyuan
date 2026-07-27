/** 用途：构建菜单 DOM；使用范围：工厂同步返回；解耦评估：经本域网关使用菜单领域唯一实现。 */
import {MenuItem} from "./imports";
/** 用途：读取快捷键配置；使用范围：菜单描述；解耦评估：经本域网关保持缺失配置时显式失败。 */
import {getSiyuanConfig} from "./imports";
/** 用途：读取移动文案；使用范围：菜单描述；解耦评估：经本域网关保持缺失语言表时显式失败。 */
import {getSiyuanLanguages} from "./imports";
/** 用途：打开移动选择器；使用范围：菜单点击流程；解耦评估：经本域网关保持现有选择器协议。 */
import {movePathTo} from "./imports";
/** 用途：提交文档移动；使用范围：目标选择回调；解耦评估：经本域网关直达既有命令。 */
import {moveToPath} from "./imports";
/** 用途：解析文档路径；使用范围：root ID 构建；解耦评估：经本域网关使用当前 POSIX 路径实现。 */
import {pathPosix} from "./imports";

/**
 * 作用：同步创建一组文档路径的移动菜单项。
 * 意图：集中保留 root ID 推导、移动选择器参数和最终移动命令的既有顺序。
 * 调用时机：文件树单选、多选和文档标题菜单需要移动入口时调用。
 * @同步豁免: UI构建 - 必须在菜单 popup 前同步返回 DOM 元素，改为异步会改变现有 append 顺序。
 */
export const movePathToMenu = (paths: string[]) => {
    return new MenuItem({
        id: "move",
        label: getSiyuanLanguages().move,
        icon: "iconMove",
        accelerator: getSiyuanConfig().keymap.general.move.custom,
        /** 用户点击后按输入顺序构建根 ID，并打开现有移动选择器。 */
        click() {
            const rootIDs: string[] = [];
            for (const item of paths) {
                rootIDs.push(pathPosix().basename(item).replace(".sy", ""));
            }
            movePathTo({
                /** 用户选定目标后，将选择器返回的首个 notebook/path 原样提交。 */
                cb: (toPath, toNotebook) => {
                    const selectedPath = toPath[0];
                    const selectedNotebook = toNotebook[0];
                    // 选择器只应在存在聚焦项时回调；违反该协议时必须显式暴露错误。
                    if (!selectedPath || !selectedNotebook) {
                        throw new Error("移动目标缺少路径或笔记本标识");
                    }
                    moveToPath(paths, selectedNotebook, selectedPath);
                },
                paths,
                flashcard: false,
                rootIDs,
            });
        }
    }).element;
};
