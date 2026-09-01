/** 用途：读取 AV 协议属性；使用范围：虚拟窗口标记；解耦评估：直达常量唯一所有者。 */
import {Constants} from "../../../../../constants";
/** 导出 AV 协议常量。 */
export {Constants};

/** 用途：显示定位失败消息；使用范围：目标不可见时；解耦评估：直达消息唯一实现。 */
import {showMessage} from "../../../../../dialog/message";
/** 导出消息能力。 */
export {showMessage};

/** 用途：读取定位请求；使用范围：窗口准备；解耦评估：直达统一状态真实所有者。 */
import {getAVLocateRequest} from "../state/state";
/** 导出定位请求读取。 */
export {getAVLocateRequest};

/** 用途：缓存已渲染 AV 数据；使用范围：窗口准备；解耦评估：直达统一状态真实所有者。 */
import {setRenderedAVData} from "../state/state";
/** 导出渲染数据写入。 */
export {setRenderedAVData};

/** 用途：读取画廊卡片宽度；使用范围：定位窗口列数计算；解耦评估：经画廊样式所有者统一解析新旧字段。 */
import {getCardWidth} from "../../gallery/style";
/** 导出画廊卡片宽度解析。 */
export {getCardWidth};
