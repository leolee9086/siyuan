/** 用途：打开既有移动选择器并提交移动请求、解析文档路径；使用范围：移动菜单点击流程；解耦评估：三项均是当前路径领域真实声明，参数注入会把固定命令实现泄露给菜单调用方。 */
import {movePathTo, moveToPath, pathPosix} from "../../../util/pathName";
/** 用途：严格读取应用配置与语言；使用范围：同步菜单描述；解耦评估：现有 getter 读取同一全局状态并在缺失时显式失败，避免调用方注入重复状态。 */
import {getSiyuanConfig, getSiyuanLanguages} from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：生成现有菜单 DOM；使用范围：移动菜单同步构建；解耦评估：MenuItem 是菜单领域唯一渲染实现，本子域无需另建渲染接口。 */
import {MenuItem} from "../../Menu";

/** 导出菜单项实现。 */
export {MenuItem};
/** 导出严格配置读取。 */
export {getSiyuanConfig};
/** 导出严格语言读取。 */
export {getSiyuanLanguages};
/** 导出移动选择器命令。 */
export {movePathTo};
/** 导出文档移动命令。 */
export {moveToPath};
/** 导出 POSIX 路径实现。 */
export {pathPosix};
