/** 用途：本地存储键与默认值常量。使用范围：本目录初始化迁移；解耦评估：数据协议常量必须与内核存储键保持同一身份。 */
import {Constants} from "../../../constants";
/** 用途：生成搜索块类型默认值。使用范围：缺失或旧版本搜索配置迁移；解耦评估：直达搜索默认值领域，不经过其它 imports.ts 网关。 */
import {getDefaultSubType} from "../../../search/defaults/searchDefaults";
/** 用途：生成搜索主类型默认值。使用范围：首次创建本地搜索配置；解耦评估：直达搜索默认值领域，不经过其它 imports.ts 网关。 */
import {getDefaultType} from "../../../search/defaults/searchDefaults";
/** 用途：等待内核本地存储响应。使用范围：本目录唯一初始化入口；解耦评估：直达网络实现，响应仍由本领域守卫验证。 */
import {fetchSyncPost} from "../../../util/network/fetch";

/** 导出本地存储协议常量供初始化迁移使用。 */
export {Constants};
/** 导出搜索块子类型默认值构造器供兼容迁移使用。 */
export {getDefaultSubType};
/** 导出搜索主类型默认值构造器供首次初始化使用。 */
export {getDefaultType};
/** 导出可等待的内核 POST 能力供存储初始化使用。 */
export {fetchSyncPost};
