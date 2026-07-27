/** 用途：更新移动工作区标题；使用范围：编辑器与空状态显隐切换；解耦评估：直达标题处理唯一实现，不经其它 imports 网关转发。 */
import {setTitle} from "../../../util/processTitle";

/** 导出标题更新唯一实现供移动工作区呈现使用。 */
export {setTitle};
