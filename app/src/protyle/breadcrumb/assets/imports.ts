/** 用途：查询全部编辑器；使用范围：同根文档资源本地化后刷新；解耦评估：直达 Layout 查询实现。 */
import {getAllEditor} from "../../../layout/getAll";
/** 导出编辑器查询。 */
export {getAllEditor};
/** 用途：平台判断；使用范围：移动端只刷新当前编辑器；解耦评估：直达平台事实。 */
import {isMobile} from "../../../platform";
/** 导出平台判断。 */
export {isMobile};
/** 用途：添加加载态；使用范围：网络资源本地化请求；解耦评估：直达唯一 Protyle UI 实现。 */
import {addLoading} from "../../ui/loading";
/** 导出加载态行为。 */
export {addLoading};
/** 用途：内核 POST 请求；使用范围：资源下载；解耦评估：直达唯一网络实现。 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};
/** 用途：隐藏工具栏；使用范围：资源下载开始；解耦评估：直达唯一 Protyle UI 实现。 */
import {hideElements} from "../../ui/hideElements";
/** 导出局部元素隐藏。 */
export {hideElements};
/** 用途：刷新编辑器；使用范围：资源本地化完成；解耦评估：直达唯一 Protyle 行为。 */
import {reloadProtyle} from "../../util/reload";
/** 导出编辑器刷新。 */
export {reloadProtyle};
