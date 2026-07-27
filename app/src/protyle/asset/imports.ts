/**
 * 用途：提供资源路径到标准编辑器 HTML 的唯一生成实现。
 * 使用范围：Protyle 资源选择结果写入。
 * 解耦评估：HTML 规则属于资源领域，参数复制会形成平行实现，因此直达真实所有者。
 */
import {genAssetHTML} from "../../asset/renderAssets";
/** 导出资源 HTML 生成实现 */
export {genAssetHTML};

/**
 * 用途：提取资源展示名称。
 * 使用范围：Protyle 资源写入前的文件名规范化。
 * 解耦评估：路径算法已有唯一实现，应直接复用而非重新解析。
 */
import {getAssetName} from "../../util/file/pathName";
/** 导出资源展示名称解析 */
export {getAssetName};

/**
 * 用途：提供 POSIX 扩展名解析。
 * 使用范围：Protyle 资源写入前判断资源类型。
 * 解耦评估：路径算法已有唯一实现，应直接复用而非重新解析。
 */
import {pathPosix} from "../../util/file/pathName";
/** 导出 POSIX 路径解析 */
export {pathPosix};

/**
 * 用途：写入完成后收起编辑器工具层。
 * 使用范围：Protyle 资源选择结果写入的同步 UI 收尾。
 * 解耦评估：事件转发会改变当前 DOM 调用栈顺序，因此直达 UI 所有者。
 */
import {hideElements} from "../ui/hideElements";
/** 导出工具层收起行为 */
export {hideElements};

/**
 * 用途：按既有事务和 DOM 语义插入资源 HTML。
 * 使用范围：Protyle 资源选择结果写入。
 * 解耦评估：插入函数拥有完整编辑器生命周期，不拆成调用点能力。
 */
import {insertHTML} from "../util/insertHTML";
/** 导出编辑器 HTML 插入行为 */
export {insertHTML};

/**
 * 用途：写入前恢复工具栏保存的 DOM Range。
 * 使用范围：从资源菜单返回当前 Protyle 编辑位置。
 * 解耦评估：Range 必须同步恢复，事件或异步参数层会改变写入位置。
 */
import {focusByRange} from "../util/selection";
/** 导出 Range 聚焦行为 */
export {focusByRange};
