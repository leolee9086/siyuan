/**
 * @文件用途: plugin 模块的导入转发层
 * @使用范围: 为 plugin 目录下的所有文件提供统一的外部依赖导入入口
 * @解耦评估: 必需的架构层，通过集中管理导入路径实现模块边界清晰化，无法进一步解耦
 */

/**
 * @导入用途: App 类型定义，用于插件系统的核心应用实例类型标注
 * @使用范围: 所有需要访问应用实例的插件相关功能
 * @解耦评估: 核心类型依赖，插件系统必须依赖应用实例，无法通过依赖注入解耦
 */
import {App} from "../index";

/**
 * @导入用途: 华为设备检测功能
 * @使用范围: 插件菜单中的设备兼容性判断
 * @解耦评估: 可通过依赖注入解耦，但当前为工具函数，重构成本较高
 */
import {isHuawei} from "../protyle/util/compatibility";

/**
 * @导入用途: 存储值设置功能
 * @使用范围: 插件菜单中保存用户的固定/取消固定偏好
 * @解耦评估: 可通过依赖注入解耦，但当前为工具函数，重构成本较高
 */
import {setStorageVal} from "../protyle/util/compatibility";

/**
 * @导入用途: 打开设置对话框功能
 * @使用范围: 插件管理菜单项点击时打开设置界面
 * @解耦评估: 可通过事件发射解耦，但当前直接调用更简洁高效
 */
import {openSetting} from "../config";

/**
 * @导入用途: 全局常量定义
 * @使用范围: 插件菜单中使用的菜单类型和存储键常量
 * @解耦评估: 常量依赖，无法解耦且不应解耦
 */
import {Constants} from "../constants";

/**
 * @导入用途: 获取思源配置信息
 * @使用范围: 插件菜单中判断只读模式等配置
 * @解耦评估: 可通过参数传递解耦，但当前全局访问更符合配置读取模式
 */
import {getSiyuanConfig} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 获取思源语言包
 * @使用范围: 插件菜单中的多语言文本显示
 * @解耦评估: 可通过参数传递解耦，但当前全局访问更符合国际化模式
 */
import {getSiyuanLanguages} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 获取思源菜单实例
 * @使用范围: 插件菜单中清理分隔符等 DOM 操作
 * @解耦评估: 可通过依赖注入解耦，但当前全局访问更简洁
 */
import {getSiyuanMenus} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 获取思源存储数据
 * @使用范围: 插件菜单中读取用户的固定/取消固定偏好
 * @解耦评估: 可通过参数传递解耦，但当前全局访问更符合存储读取模式
 */
import {getSiyuanStorage} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 移动端检测
 * @使用范围: 插件菜单中判断是否显示管理入口
 * @解耦评估: 工具函数，可通过参数传递但当前方式更简洁
 */
import {isMobile} from "../util/platform/functions";

/** @导出说明: 应用实例类型 */
export {App};

/** @导出说明: 华为设备检测 */
export {isHuawei};

/** @导出说明: 存储值设置 */
export {setStorageVal};

/** @导出说明: 打开设置对话框 */
export {openSetting};

/** @导出说明: 全局常量 */
export {Constants};

/** @导出说明: 获取思源配置 */
export {getSiyuanConfig};

/** @导出说明: 获取思源语言包 */
export {getSiyuanLanguages};

/** @导出说明: 获取思源菜单实例 */
export {getSiyuanMenus};

/** @导出说明: 获取思源存储数据 */
export {getSiyuanStorage};

/** @导出说明: 移动端检测 */
export {isMobile};

/**
 * @导入用途: Graphviz 图形渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {graphvizRender} from "../protyle/render/graphvizRender";

/**
 * @导入用途: 代码高亮渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {highlightRender} from "../protyle/render/highlightRender";

/**
 * @导入用途: 数学公式渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {mathRender} from "../protyle/render/mathRender";

/**
 * @导入用途: Mermaid 图表渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {mermaidRender} from "../protyle/render/mermaidRender";

/**
 * @导入用途: Flowchart.js 流程图渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {flowchartRender} from "../protyle/render/flowchartRender";

/**
 * @导入用途: ECharts 图表渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {chartRender} from "../protyle/render/chartRender";

/**
 * @导入用途: ABC 五线谱渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {abcRender} from "../protyle/render/abcRender";

/**
 * @导入用途: HTML 内容渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {htmlRender} from "../protyle/render/htmlRender";

/**
 * @导入用途: 思维导图渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {mindmapRender} from "../protyle/render/mindmapRender";

/**
 * @导入用途: PlantUML 图形渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {plantumlRender} from "../protyle/render/plantumlRender";

/**
 * @导入用途: 属性视图渲染功能
 * @使用范围: 插件系统暴露给第三方插件的 Protyle 渲染方法集合
 * @解耦评估: 渲染函数作为工具方法，插件系统需要提供统一的渲染能力接口，无法通过依赖注入解耦
 */
import {avRender} from "../protyle/render/av/render";

/** @导出说明: Graphviz 图形渲染 */
export {graphvizRender};

/** @导出说明: 代码高亮渲染 */
export {highlightRender};

/** @导出说明: 数学公式渲染 */
export {mathRender};

/** @导出说明: Mermaid 图表渲染 */
export {mermaidRender};

/** @导出说明: Flowchart.js 流程图渲染 */
export {flowchartRender};

/** @导出说明: ECharts 图表渲染 */
export {chartRender};

/** @导出说明: ABC 五线谱渲染 */
export {abcRender};

/** @导出说明: HTML 内容渲染 */
export {htmlRender};

/** @导出说明: 思维导图渲染 */
export {mindmapRender};

/** @导出说明: PlantUML 图形渲染 */
export {plantumlRender};

/** @导出说明: 属性视图渲染 */
export {avRender};
