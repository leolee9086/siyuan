/** 用途：Vue 响应式与监听原语；使用范围：文件属性控制器。 */
export {computed, ref, watch} from "vue";
export type {Ref} from "vue";
/** 用途：复用唯一颜色转换和可读前景算法；使用范围：标签确定性颜色展示。 */
export {bestTextColor, hexToRgb, rgbToHex} from "../../colors/colorEngine";
export type {RGB} from "../../colors/types";
/** 用途：复用现有 HSL 到十六进制转换；使用范围：未配置标签颜色的稳定回退。 */
export {hslToHex} from "../../../util/assets/color";
