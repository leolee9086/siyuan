/** 用途：访问统一导航历史状态；使用范围：移动历史写入与清理；解耦评估：状态必须由全局注册表持有，参数传入数组会重新产生分散所有权。 */
import {getNavigationHistoryState} from "../../navigation/history/NavigationHistoryRegistry";
/** 导出导航历史状态访问。 */
export {getNavigationHistoryState};

/** 用途：取得当前移动编辑器；使用范围：写入后退历史时捕获当前文档位置；解耦评估：这是移动宿主唯一编辑器查询，不建立到 zoomOut 或菜单实现的反向边。 */
import {getCurrentEditor} from "../util/getCurrentEditor";
/** 导出当前移动编辑器查询。 */
export {getCurrentEditor};
