/** 用途：拼接 Electron 资源路径；使用范围：资源双击；解耦评估：经路径边界按需取得原生实现。 */
import {originalPath} from "../../../../util/file/pathName";
/** 导出原生路径入口。 */
export {originalPath};

/** 用途：双击阈值与搜索存储键；使用范围：列表交互；解耦评估：直达稳定协议常量。 */
import {Constants} from "../../../../constants";
/** 导出协议常量。 */
export {Constants};

/** 用途：识别非修饰键双击；使用范围：结果打开；解耦评估：直达统一热键判定。 */
import {isNotCtrl} from "../../../../util/platform/hotkey/format";
/** 导出热键判定。 */
export {isNotCtrl};

/** 用途：识别 iPad；使用范围：单/双击判定；解耦评估：直达平台事实实现。 */
import {isIPad} from "../../../../util/platform/functions";
/** 导出 iPad 判定。 */
export {isIPad};

/** 用途：调用系统文件管理器；使用范围：Electron 资源双击；解耦评估：直达平台命令边界。 */
import {useShell} from "../../../../util/file/pathName";
/** 导出系统命令入口。 */
export {useShell};

/** 用途：渲染资源预览；使用范围：首次资源点击；解耦评估：直达 Search Assets 唯一实现。 */
import {renderPreview} from "../../../assets";
/** 导出资源预览。 */
export {renderPreview};

/** 用途：轮转资源标记；使用范围：重复资源点击；解耦评估：直达 Search Assets 唯一实现。 */
import {renderNextAssetMark} from "../../../assets";
/** 导出资源标记轮转。 */
export {renderNextAssetMark};

/** 用途：打开文档搜索结果；使用范围：Alt 点击和双击；解耦评估：直达 Search Editor 唯一实现。 */
import {openSearchEditor} from "../../../editor/openSearchEditor";
/** 导出搜索编辑器导航。 */
export {openSearchEditor};

/** 用途：轮转文档搜索标记；使用范围：重复点击；解耦评估：直达 Search Result 唯一实现。 */
import {renderNextSearchMark} from "../../../result/renderNextSearchMark";
/** 导出文档标记轮转。 */
export {renderNextSearchMark};

/** 用途：加载文章预览；使用范围：首次文档点击；解耦评估：直达 Search Article 唯一实现。 */
import {getArticle} from "../../../article/getArticle";
/** 导出文章预览。 */
export {getArticle};

/** 用途：提取列表项搜索关键词；使用范围：数据库搜索结果直达打开；解耦评估：直达 Search Menu 唯一实现。 */
import {getKeysByLiElement} from "../../../menu";
/** 导出关键词提取。 */
export {getKeysByLiElement};

/** 用途：严格识别输入框；使用范围：资源查询；解耦评估：直达同一 Search 组合域守卫。 */
import {isHTMLInputElement} from "../search.guard";
/** 导出输入框守卫。 */
export {isHTMLInputElement};

/** 用途：识别浏览器环境；使用范围：iPad 点击判定；解耦评估：直达平台事实。 */
import {isBrowser} from "../../../../platform";
/** 导出浏览器事实。 */
export {isBrowser};

/** 用途：识别 Electron 环境；使用范围：资源双击；解耦评估：直达平台事实。 */
import {isElectron} from "../../../../platform";
/** 导出 Electron 事实。 */
export {isElectron};

/** 用途：完整列表点击上下文；使用范围：handler 全流程；解耦评估：纯类型直达已有泛型契约。 */
import type {IListItemClickContext} from "../SearchContext.types";
/** 导出列表点击上下文。 */
export type {IListItemClickContext};

/** 用途：完整应用领域根；使用范围：绑定列表上下文；解耦评估：纯类型直达 AppFacade。 */
import type {AppFacade} from "../../../../app/AppFacade.types";
/** 导出应用领域根。 */
export type {AppFacade};

/** 用途：完整 Protyle 领域根；使用范围：绑定预览编辑器；解耦评估：纯类型直达领域声明。 */
import type {ProtyleDomain} from "../../../../protyle/protyle.types";
/** 导出 Protyle 领域根。 */
export type {ProtyleDomain};
