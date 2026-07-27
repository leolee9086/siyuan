/** 用途：实例化 Gallery 设置菜单；使用范围：Cover/Size/Ratio；解耦评估：经本域网关直达 Menu。 */
import {Menu} from "./imports";

/** 创建一次性 Gallery 设置菜单，不保存跨调用状态。 */
/** @同步豁免: UI构建 */
export const createGallerySettingsMenu = () => new Menu();
