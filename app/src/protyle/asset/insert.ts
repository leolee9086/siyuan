/** 用途：恢复资源菜单保存的选区；使用范围：写入前同步聚焦；解耦评估：必须与写入保持同一 DOM 调用栈。 */
import {focusByRange} from "./imports";
/** 用途：生成标准资源 HTML；使用范围：资源写入内容构建；解耦评估：复用资源领域唯一规则。 */
import {genAssetHTML} from "./imports";
/** 用途：读取资源展示名称；使用范围：资源写入标题构建；解耦评估：复用路径领域唯一算法。 */
import {getAssetName} from "./imports";
/** 用途：收起编辑器工具层；使用范围：资源写入后的 UI 收尾；解耦评估：同步 UI 生命周期不可延后。 */
import {hideElements} from "./imports";
/** 用途：执行编辑器 HTML 插入；使用范围：资源写入提交；解耦评估：直接复用完整插入生命周期。 */
import {insertHTML} from "./imports";
/** 用途：解析资源扩展名；使用范围：资源类型判定；解耦评估：复用路径领域唯一算法。 */
import {pathPosix} from "./imports";

/**
 * 将资源选择结果写入当前 Protyle 编辑器。
 * 该行为拥有工具栏选区恢复、资源 HTML 生成、内容插入和工具层收起的完整时序。
 * @同步豁免: UI构建 - DOM Range 恢复、HTML 插入和工具层收起必须在同一选择事件调用栈完成。
 */
export const insertAssetIntoProtyle = (value: string, protyle: IProtyle) => {
    if (!protyle.toolbar) {
        throw new Error("Protyle toolbar module is not initialized");
    }
    const range = protyle.toolbar.range;
    // 资源菜单必须保存写入位置；缺失时继续执行会把内容插入到不可预测的选区。
    if (!range) {
        throw new Error("Protyle toolbar range is not initialized");
    }
    focusByRange(range);
    const type = pathPosix().extname(value).toLowerCase();
    const filename = value.startsWith("assets/") ? getAssetName(value) : value;
    insertHTML(genAssetHTML(type, value, filename, value.startsWith("assets/") ? filename + type : value), protyle);
    hideElements(["util"], protyle);
};
