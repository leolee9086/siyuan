/**
 * @文件用途: plugin 模块的导入转发层
 * @使用范围: 为 plugin 目录下的所有文件提供统一的外部依赖导入入口
 * @解耦评估: 必需的架构层，通过集中管理导入路径实现模块边界清晰化，无法进一步解耦
 */

/**
 * @导入用途: AppFacade 类型定义，用于插件系统的核心应用外观类型标注
 * @使用范围: 所有需要访问应用实例的插件相关功能
 * @解耦评估: 核心类型依赖，插件系统必须依赖应用实例，无法通过依赖注入解耦
 */
/** 用途：提供插件域统一应用外观类型；使用范围：loader、菜单和插件 API 网关；解耦评估：类型来自稳定应用契约，不加载具体 App 入口。 */
import type {AppFacade} from "../app/AppFacade.types";

/**
 * @导入用途: 同步请求封装，用于向内核请求插件加载数据
 * @使用范围: loader.ts 中的插件批量加载流程
 * @解耦评估: 网络调用可注入，但当前由 imports 网关统一转发可降低调用点耦合
 */
import {fetchSyncPost} from "../util/network/fetch";

/**
 * @导入用途: 顶部栏尺寸重算函数
 * @使用范围: loader.ts 在插件状态栏图标挂载后刷新布局
 * @解耦评估: UI 工具函数可抽象事件触发，但当前直接调用更清晰
 */
import {resizeTopBar} from "../layout/util";
/** @导入用途: 设置页签位置 @使用范围: Setting.ts 中布局管理 @解耦评估: UI 工具函数 */
import {setTabPosition} from "../window/setHeader";

/**
 * @导入用途: 布局持久化函数
 * @使用范围: loader.ts 在插件启停或重载后保存布局
 * @解耦评估: 可改为事件驱动，但当前直接调用能确保时序可控
 */
import {saveLayout} from "../layout/persistence/saveLayout";

/**
 * @导入用途: 编辑器集合获取函数
 * @使用范围: loader.ts 在插件变更后刷新所有编辑器工具栏
 * @解耦评估: 可通过编辑器服务注入，但当前工具函数调用更直接
 */
import {getAllEditor} from "../layout/getAll";

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
 * @导入用途: 设置页签菜单 ID 映射
 * @使用范围: 插件顶栏图标在移动端设置菜单中的挂载位置
 * @解耦评估: 新设置 UI 的稳定映射函数，应通过导入网关统一转发
 */
import {settingTabToMenuId} from "../config/setting/tabs";

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

/**
 * @导入用途: 前端类型检测
 * @使用范围: loader.ts 在请求插件列表时携带 frontend 参数
 * @解耦评估: 环境判断函数可注入，但当前工具函数调用更轻量
 */
import {getFrontend} from "../util/platform/functions";

/**
 * @导入用途: 独立窗口检测
 * @使用范围: loader.ts 在顶栏和 Dock 渲染分支中判断运行形态
 * @解耦评估: 环境判断函数可注入，但当前共享工具函数更稳定
 */
import {isWindow} from "../util/platform/functions";

/**
 * @导入用途: 读取全局布局对象
 * @使用范围: loader.ts 在插件 Dock 按钮生成阶段访问布局容器
 * @解耦评估: 可通过参数注入布局对象，但当前读取全局布局是既有约定
 */
import {getSiyuanLayout} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/**
 * @导入用途: 读取插件自定义快捷键
 * @使用范围: loader.ts 在生成 Dock 按钮时附加快捷键提示
 * @解耦评估: 可在调用链上层传入，但当前集中在环境层读取更一致
 */
import {getPluginCustomHotkey} from "../util/siyuanEnvironments/getSiyuanConfig.environment";

/** @导出说明: 插件宿主应用外观类型 */
export type {AppFacade};

/** @导出说明: 同步请求封装 */
export {fetchSyncPost};

/** @导出说明: 顶部栏尺寸重算 */
export {resizeTopBar};

/** @导出说明: tab 位置重设函数 */
export {setTabPosition};

/** @导出说明: 布局持久化函数 */
export {saveLayout};

/** @导出说明: 编辑器集合获取函数 */
export {getAllEditor};

/** @导出说明: 华为设备检测 */
export {isHuawei};

/** @导出说明: 存储值设置 */
export {setStorageVal};

/** @导出说明: 打开设置对话框 */
export {openSetting};

/** @导出说明: 全局常量 */
export {Constants};

/** @导出说明: 设置页签菜单 ID 映射 */
export {settingTabToMenuId};

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

/** @导出说明: 前端类型检测 */
export {getFrontend};

/** @导出说明: 独立窗口检测 */
export {isWindow};

/** @导出说明: 读取全局布局对象 */
export {getSiyuanLayout};

/** @导出说明: 读取插件自定义快捷键 */
export {getPluginCustomHotkey};

/**
 * @导入用途: 菜单项构建类
 * @使用范围: 插件事件总线中构建菜单项和分隔符
 * @解耦评估: 核心UI组件，菜单系统必须依赖，无法解耦
 */
import {MenuItem} from "../menus/Menu.Item";

/**
 * @导入用途: 子菜单容器类
 * @使用范围: 插件事件总线中收集插件注册的菜单项
 * @解耦评估: 核心UI组件，菜单系统必须依赖，无法解耦
 */
import {subMenu} from "../menus/Menu.subMenu";

/**
 * @导入用途: 获取全局菜单实例
 * @使用范围: 插件事件总线中向全局菜单添加插件子菜单
 * @解耦评估: 可通过依赖注入解耦，但当前全局访问更简洁
 */
import {getSiyuanGlobalMenus} from "../util/siyuanEnvironments/getMenu.environment";

/**
 * @导入用途: 获取国际化文本
 * @使用范围: 插件事件总线中显示"插件"菜单标签
 * @解耦评估: 可通过参数传递解耦，但当前全局访问更符合国际化模式
 */
import {siyuanI18n} from "../util/siyuanEnvironments/i18n.getI18n.environment";

/** @导出说明: 菜单项构建类 */
export {MenuItem};

/** @导出说明: 子菜单容器类 */
export {subMenu};

/** @导出说明: 获取全局菜单实例 */
export {getSiyuanGlobalMenus};

/** @导出说明: 获取国际化文本 */
export {siyuanI18n};

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
