/** 用途：折叠状态决定预览加载模式；使用范围：搜索结果文章预览；解耦评估：直达折叠检查唯一实现。 */
import {checkFold} from "../../block/fold/checkFold";
/** 导出折叠检查。 */
export {checkFold};

/** 用途：搜索预览请求常量；使用范围：文档加载动作和观察器超时；解耦评估：直达稳定静态值。 */
import {Constants} from "../../constants";
/** 导出搜索常量。 */
export {Constants};

/** 用途：请求文档信息与正文；使用范围：搜索结果文章预览；解耦评估：直达统一网络传输实现。 */
import {fetchPost} from "../../util/network/fetch";
/** 导出网络请求。 */
export {fetchPost};

/** 用途：显示预览加载态；使用范围：文章切换开始时；解耦评估：直达既有 Protyle UI 操作。 */
import {addLoading} from "../../protyle/ui/loading";
/** 导出加载态操作。 */
export {addLoading};

/** 用途：应用内核文档响应；使用范围：文章正文返回后；解耦评估：直达 Protyle 统一响应入口。 */
import {onGet} from "../../protyle/util/onGet";
/** 导出响应应用操作。 */
export {onGet};

/** 用途：渲染并定位搜索高亮；使用范围：正文装载完成后；解耦评估：直达既有 Protyle 搜索渲染能力。 */
import {isSupportCSSHL, searchMarkRender} from "../../protyle/render/searchMarkRender";
/** 导出 CSS Highlight 能力判断。 */
export {isSupportCSSHL};
/** 导出搜索高亮渲染。 */
export {searchMarkRender};

/** 用途：CSS Highlight 无文本范围时定位块；使用范围：预览高亮完成后；解耦评估：直达共享 DOM 定位操作。 */
import {highlightById} from "../../util/DOM/highlightById";
/** 导出块定位操作。 */
export {highlightById};

/** 用途：将当前搜索范围滚动到预览中心；使用范围：预览高亮完成后；解耦评估：直达 Search 纯滚动实现。 */
import {scrollToCurrent} from "../utils/utils.scrollToCurrent";
/** 导出范围滚动操作。 */
export {scrollToCurrent};

/** 用途：识别加密笔记本并补充请求参数；使用范围：文档信息与正文请求；解耦评估：直达统一路径领域判断。 */
import {isEncryptedBox} from "../../util/file/notebook/store";
/** 导出加密笔记本判断。 */
export {isEncryptedBox};

/** 用途：创建文章高亮尺寸观察器；使用范围：CSS Highlight 生命周期；解耦评估：直达共享 DOM 观察器工厂唯一实现。 */
import {createResizeObserver} from "../../util/DOM/observers.factory";
/** 导出尺寸观察器工厂。 */
export {createResizeObserver};

/** 用途：读取统一 SForge 状态；使用范围：当前文章预览校验；解耦评估：直达全局状态基础设施。 */
import {getSForgeState} from "../../config/sforge.global";
/** 导出状态读取。 */
export {getSForgeState};

/** 用途：写入统一 SForge 状态；使用范围：登记当前文章预览；解耦评估：直达全局状态基础设施。 */
import {setSForgeState} from "../../config/sforge.global";
/** 导出状态写入。 */
export {setSForgeState};

/** 用途：当前文章预览状态键；使用范围：预览异步回调隔离；解耦评估：直达不可变 Symbol 声明。 */
import {ARTICLE_PREVIEW_CURRENT_ID} from "../../config/sforge.symbols";
/** 导出文章预览状态键。 */
export {ARTICLE_PREVIEW_CURRENT_ID};

/** 用途：完整 Protyle 领域根；使用范围：文章预览操作上下文；解耦评估：纯类型不加载具体实现。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";
/** 导出 Protyle 领域根。 */
export type {ProtyleDomain};

/** 用途：内核请求的可扩展结构；使用范围：文档信息与正文参数；解耦评估：直达网络层公开请求类型。 */
import type {IFetchRequestObject} from "../../util/network/types";
/** 导出可扩展请求结构。 */
export type {IFetchRequestObject};

/** 用途：读取已初始化的应用配置；使用范围：文章正文动态加载大小；解耦评估：直达严格环境访问器。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出严格配置访问器。 */
export {getSiyuanConfig};
