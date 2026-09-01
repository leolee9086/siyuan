/** 用途：标识搜索词与资源搜索词本地存储槽；使用范围：搜索历史持久化；解耦评估：协议常量直接指向唯一声明，不经其它网关。 */
import {Constants} from "../../constants";
/** 用途：读取搜索历史数量限制与本地存储对象；使用范围：搜索历史持久化；解耦评估：环境访问器是现有唯一状态边界，参数化只会把全局生命周期责任扩散到调用点。 */
import {getSiyuanConfig, getSiyuanStorage} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：向内核持久化更新后的本地搜索历史；使用范围：搜索历史持久化；解耦评估：直接依赖唯一存储实现，保留同步发起请求的现有时序。 */
import {setStorageVal} from "../../util/storage/setStorageVal";

/** 导出应用协议常量。 */
export {Constants};
/** 导出当前配置访问器。 */
export {getSiyuanConfig};
/** 导出当前存储访问器。 */
export {getSiyuanStorage};
/** 导出本地存储持久化能力。 */
export {setStorageVal};

/** 用途：识别加密笔记本；使用范围：敏感搜索历史写入豁免；解耦评估：直达加密子域唯一判定实现。 */
import {isEncryptedBox} from "../../util/file/notebook/store";
/** 导出加密笔记本判定。 */
export {isEncryptedBox};
