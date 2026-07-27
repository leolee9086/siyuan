/** 用途：枚举当前编辑器模型；使用范围：单项替换后刷新已打开文档；解耦评估：直达布局查询实现。 */
import {getAllModels} from "../../layout/getAll";
/** 导出模型查询。 */
export {getAllModels};

/** 用途：发送查找替换请求；使用范围：替换执行；解耦评估：直达统一网络实现。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};

/** 用途：显示禁用方法和内核错误；使用范围：替换反馈；解耦评估：直达消息唯一实现。 */
import {showMessage} from "../../dialog/message";
/** 导出消息操作。 */
export {showMessage};

/** 用途：刷新受替换影响的编辑器；使用范围：单项替换响应；解耦评估：直达 Protyle 刷新实现。 */
import {reloadProtyle} from "../../protyle/util/reload";
/** 导出编辑器刷新。 */
export {reloadProtyle};

/** 用途：从结果项提取查询键；使用范围：关键字/查询语法替换；解耦评估：直达 Search 结果实现。 */
import {getKeyByLiElement} from "../result/searchResultKey";
/** 导出结果键读取。 */
export {getKeyByLiElement};

/** 用途：保存替换历史；使用范围：请求发起前；解耦评估：直达 Search 历史唯一实现。 */
import {saveKeyList} from "../history/storage";
/** 导出历史保存。 */
export {saveKeyList};

/** 用途：替换禁用文案；使用范围：SQL/语义方法提示；解耦评估：直达 i18n 环境。 */
import {siyuanI18n} from "../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出搜索文案。 */
export {siyuanI18n};

/** 用途：替换完成后刷新搜索；使用范围：全量与单项响应；解耦评估：直达 Search 输入编排。 */
import {inputEvent} from "../inputEvent";
/** 导出搜索刷新。 */
export {inputEvent};

/** 用途：完整 Protyle 领域根；使用范围：搜索刷新参数；解耦评估：纯类型不加载具体实现。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 导出 Protyle 领域根。 */
export type {ProtyleDomain};
