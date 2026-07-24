/** 用途：笔记本列表请求；使用范围：同目录状态刷新；解耦评估：通用网络基础设施，不依赖文件树 UI。 */
import {fetchPost} from "../../network/fetch";
/** 用途：读取笔记本集合；使用范围：名称、图标和打开数量查询；解耦评估：只读环境端口。 */
import {getSiyuanNotebooks} from "../../siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：替换笔记本集合；使用范围：非闪卡列表刷新；解耦评估：状态写入端口集中在笔记本领域。 */
import {setSiyuanNotebooks} from "../../siyuanEnvironments/getSiyuanConfig.environment";

/** 同目录笔记本状态使用的网络请求。 */
export {fetchPost};
/** 同目录笔记本状态使用的集合读取端口。 */
export {getSiyuanNotebooks};
/** 同目录笔记本状态使用的集合写入端口。 */
export {setSiyuanNotebooks};
