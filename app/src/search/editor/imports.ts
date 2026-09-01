/** 用途：搜索编辑器导航动作与存储键；使用范围：打开当前搜索结果；解耦评估：直达稳定静态值。 */
import {Constants} from "../../constants";
/** 导出搜索导航常量。 */
export {Constants};

/** 用途：判断折叠状态；使用范围：选择导航 action；解耦评估：直达折叠检查唯一实现。 */
import {checkFold} from "../../block/fold/checkFold";
/** 导出折叠检查。 */
export {checkFold};

/** 用途：定位范围所属块；使用范围：保存当前搜索光标；解耦评估：直达 Protyle DOM 查询。 */
import {hasClosestBlock} from "../../protyle/util/hasClosest";
/** 导出块定位。 */
export {hasClosestBlock};

/** 用途：计算当前范围偏移；使用范围：保存文件位置；解耦评估：直达选区实现。 */
import {getSelectionOffset} from "../../protyle/util/selection";
/** 导出选区偏移计算。 */
export {getSelectionOffset};

/** 用途：取得块可编辑根；使用范围：范围偏移基准；解耦评估：直达 WYSIWYG DOM 实现。 */
import {getContenteditableElement} from "../../protyle/wysiwyg/getBlock";
/** 导出可编辑根查询。 */
export {getContenteditableElement};

/** 用途：读取已初始化应用存储；使用范围：保存搜索光标位置；解耦评估：直达严格环境访问器。 */
import {getSiyuanStorage} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格存储访问器。 */
export {getSiyuanStorage};

/** 用途：同步请求属性视图搜索目标；使用范围：数据库搜索结果直达打开；解耦评估：网络能力经网关集中，测试可替换。 */
import {fetchSyncPost} from "../../util/network/fetch";
/** 导出同步请求能力。 */
export {fetchSyncPost};

/** 用途：识别加密笔记本；使用范围：加密文档跳过阅读位置持久化；解耦评估：直达加密子域唯一判定实现。 */
import {isEncryptedBox} from "../../util/file/notebook/store";
/** 导出加密笔记本判定。 */
export {isEncryptedBox};

/** 用途：打开属性视图定位目标项；使用范围：数据库搜索结果导航；解耦评估：直达 AV 渲染子域唯一实现。 */
import {openDatabaseItem} from "../../protyle/render/av/openDatabaseItem";
/** 导出数据库项打开能力。 */
export {openDatabaseItem};
/** 导出数据库项打开数据契约。 */
export type {IDatabaseItemOpenData} from "../../protyle/render/av/openDatabaseItem";
