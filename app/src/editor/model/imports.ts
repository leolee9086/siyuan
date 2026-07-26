/** 用途：编辑器内容内边距同步；使用范围：全屏初始化；解耦评估：纯 Protyle UI 行为，直接作为模型运行依赖。 */
import {setPadding} from "../../protyle/ui/padding";
/** 用途：Electron 环境判定；使用范围：窗口 hash 同步条件；解耦评估：平台事实读取，不持有宿主状态。 */
import {isElectron} from "../../platform";
/** 用途：文档字数统计；使用范围：Protyle 初始化完成；解耦评估：状态栏运行端口，不依赖 Editor class。 */
import {countBlockWord} from "../../protyle/runtime/status.port";
/** 用途：最近文档时间写入；使用范围：Editor 构造完成；解耦评估：网络基础设施，不依赖 Editor class。 */
import {fetchPost} from "../../util/network/fetch";
/** 用途：读取文件树配置；使用范围：决定页签未更新标记；解耦评估：只读环境访问，不持有 Editor 状态。 */
import {getSiyuanConfig} from "../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：安全读取全局窗口；使用范围：恢复编辑器全屏状态；解耦评估：浏览器环境端口，不依赖 Editor class。 */
import {getWindow} from "../../util/siyuanEnvironments/getWindow.environment";
/** 用途：Editor 构造选项契约；使用范围：模型构造参数；解耦评估：稳定泛型领域类型，不依赖具体实现。 */
import type {IEditorOptions} from "../types";
/** 用途：编辑引擎创建选项；使用范围：参数化引擎工厂；解耦评估：完整 Protyle 配置映射，不依赖具体引擎 class。 */
import type {EditorEngineOptions} from "../types";
/** 用途：编辑引擎领域身份；使用范围：Editor 泛型约束；解耦评估：稳定结构契约，不依赖 Protyle class。 */
import type {ProtyleDomain} from "../../protyle/protyle.types";

/** 同目录 Editor 模型使用的内边距同步实现。 */
export {setPadding};
/** 同目录 Editor 模型使用的平台事实。 */
export {isElectron};
/** 同目录 Editor 模型使用的字数统计端口。 */
export {countBlockWord};
/** 同目录 Editor 模型使用的网络写入函数。 */
export {fetchPost};
/** 同目录 Editor 模型使用的配置读取函数。 */
export {getSiyuanConfig};
/** 同目录 Editor 模型使用的窗口读取函数。 */
export {getWindow};
/** 同目录 Editor 模型使用的构造选项契约。 */
export type {IEditorOptions};
/** 同目录 Editor 模型使用的参数化引擎创建选项。 */
export type {EditorEngineOptions};
/** 同目录 Editor 模型使用的编辑引擎身份。 */
export type {ProtyleDomain};
