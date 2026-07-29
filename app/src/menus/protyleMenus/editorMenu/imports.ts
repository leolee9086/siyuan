/**
 * 用途：集中管理 editorMenu 模块的外部依赖导入
 * 使用范围：editorMenu 目录下业务文件统一从该文件转发导入
 * 解耦评估：通过单点转发隔离跨目录耦合，后续替换实现时可减少业务文件改动范围
 */

/**
 * 用途：编辑器菜单常量集合
 * 使用范围：enterBack、inlineMathMenu、zoomOut 中读取菜单与回调常量
 * 解耦评估：常量属于稳定基础依赖，当前通过转发层隔离路径耦合
 */
import { Constants } from "../../../constants";
/** 导出 Constants 供 editorMenu 读取常量 */
export { Constants };

/**
 * 用途：平台端类型判断
 * 使用范围：enterBack/zoomOut 根据是否移动端决定分支
 * 解耦评估：平台判断依赖稳定，转发层可避免业务文件直接感知上层路径
 */
import { isMobile } from "../../../platform";
/** 导出 isMobile 供 editorMenu 判断端类型 */
export { isMobile };

/**
 * 用途：向上查找指定标签祖先
 * 使用范围：tableMenu 中定位 TD/TH
 * 解耦评估：DOM 工具函数职责清晰，转发层用于收敛路径耦合
 */
import { hasClosestByTag } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestByTag 供 tableMenu 定位单元格 */
export { hasClosestByTag };

/**
 * 用途：校验元素是否为 HTMLTableCellElement
 * 使用范围：tableMenu 类型守卫，避免无效单元格调用表格菜单
 * 解耦评估：类型守卫可复用且稳定，转发层保持业务边界清晰
 */
import { isHTMLTableCellElement } from "../../../util/DOM/element.guard";
/** 导出 isHTMLTableCellElement 供 tableMenu 类型守卫 */
export { isHTMLTableCellElement };

/**
 * 用途：构造全局右键菜单项
 * 使用范围：tableMenu 与 inlineMathMenu 追加菜单项
 * 解耦评估：UI 基础组件依赖稳定，转发层减少业务文件跨层导入
 */
import { MenuItem } from "../../Menu.Item";
/** 导出 MenuItem 供 editorMenu 构建菜单项 */
export { MenuItem };

/**
 * 用途：读取全局菜单单例（对象）
 * 使用范围：tableMenu 在右键菜单中追加分隔符和子菜单
 * 解耦评估：环境能力已封装，转发层进一步集中依赖入口
 */
import { getSiyuanGlobalMenus } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenus 供 tableMenu 使用 */
export { getSiyuanGlobalMenus };

/**
 * 用途：读取全局菜单实例（menu）
 * 使用范围：inlineMathMenu 清空、追加、弹出菜单
 * 解耦评估：环境能力已封装，转发层减少业务文件直接耦合
 */
import { getSiyuanGlobalMenusMenu } from "../../../util/siyuanEnvironments/getMenu.environment";
/** 导出 getSiyuanGlobalMenusMenu 供 inlineMathMenu 使用 */
export { getSiyuanGlobalMenusMenu };

/**
 * 用途：获取国际化文案
 * 使用范围：tableMenu、inlineMathMenu、zoomOut 的文案渲染
 * 解耦评估：i18n 来源统一且稳定，通过转发层统一入口
 */
import { siyuanI18n } from "../../../util/siyuanEnvironments/i18n.getI18n.environment";
/** 导出 siyuanI18n 供 editorMenu 文案渲染 */
export { siyuanI18n };

/**
 * 用途：格式化更新时间戳
 * 使用范围：inlineMathMenu 删除公式后写入 updated 字段
 * 解耦评估：第三方库依赖稳定，通过转发层避免业务直接导入第三方包
 */
import * as dayjs from "dayjs";
/** 导出 dayjs 供 inlineMathMenu 更新时间 */
export { dayjs };

/**
 * 用途：恢复指定 Range 焦点
 * 使用范围：inlineMathMenu copy/cut 前聚焦到行内公式节点
 * 解耦评估：编辑器选区能力短期不适合替换，转发层可减少路径耦合
 */
import {focusByRange} from "../../../protyle/util/selection";
/** 导出 focusByRange 供 inlineMathMenu 聚焦选区 */
export { focusByRange };

/**
 * 用途：定位当前元素所在块节点
 * 使用范围：inlineMathMenu 获取块节点与 data-node-id
 * 解耦评估：DOM 工具函数复用价值高，转发层保持业务与工具解耦
 */
import { hasClosestBlock } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestBlock 供 inlineMathMenu 定位块节点 */
export { hasClosestBlock };

/**
 * 用途：定位并聚焦插入的 wbr 位置
 * 使用范围：inlineMathMenu 删除节点后恢复光标
 * 解耦评估：选区工具函数属于底层能力，转发层减少业务跨层依赖
 */
import { focusByWbr } from "../../../protyle/util/selection";
/** 导出 focusByWbr 供 inlineMathMenu 删除后恢复光标 */
export { focusByWbr };

/**
 * 用途：提交编辑器事务更新
 * 使用范围：inlineMathMenu 删除公式后写入事务用于撤销/重做
 * 解耦评估：事务能力是核心基础设施，转发层有助于统一依赖边界
 */
import {updateTransaction} from "../../../protyle/wysiwyg/transaction/update";
/** 导出 updateTransaction 供 inlineMathMenu 提交事务 */
export { updateTransaction };

/**
 * 用途：写入本地存储
 * 使用范围：zoomOut 更新 LOCAL_DOCINFO 等运行态缓存
 * 解耦评估：存储写入接口已封装，转发层减少业务代码直接耦合实现路径
 */
import {setStorageVal} from "../../../util/storage/setStorageVal";
/** 导出 setStorageVal 供 zoomOut 写入缓存 */
export { setStorageVal };

/**
 * 用途：请求后端 API
 * 使用范围：zoomOut 拉取文档内容与聚焦补偿数据
 * 解耦评估：网络请求能力由统一封装提供，转发层保持调用边界稳定
 */
import {fetchPost} from "../../../util/network/fetch";
/** 导出 fetchPost 供 zoomOut 请求文档数据 */
export { fetchPost };

/**
 * 用途：判断笔记本是否加密。
 * 使用范围：zoomOut 三条 getDoc 请求统一附加 notebook 参数。
 * 解耦评估：加密状态属于请求契约前置条件，经转发层集中提供。
 */
import {isEncryptedBox} from "../../../util/file/notebook/store";
/** 导出 isEncryptedBox 供 zoomOut 请求参数构造器使用 */
export { isEncryptedBox };

/**
 * 用途：更新反向链接图
 * 使用范围：zoomOut 非移动端完成加载后同步 backlink graph
 * 解耦评估：功能依赖编辑器视图模型，转发层减少业务层路径耦合
 */
import { updateBacklinkGraph } from "../../../editor/util.updateBacklinkGraph";
/** 导出 updateBacklinkGraph 供 zoomOut 更新反链图 */
export { updateBacklinkGraph };

/**
 * 用途：读取当前所有模型实例
 * 使用范围：zoomOut 完成后更新对应大纲面板高亮
 * 解耦评估：模型聚合能力由 layout 提供，转发层避免业务直接跨层耦合
 */
import { getAllModels } from "../../../layout/getAll";
/** 导出 getAllModels 供 zoomOut 同步模型状态 */
export { getAllModels };

/**
 * 用途：移动端回退栈推进
 * 使用范围：zoomOut 在移动端导航时写入 back 栈
 * 解耦评估：移动端导航能力与平台实现绑定，通过转发层集中依赖
 */
import {pushMobileBack} from "../../../mobile/navigationHistory/mobileNavigationHistory";
/** 导出移动历史写入动作，供 zoomOut 管理回退栈。 */
export {pushMobileBack};

/**
 * 用途：按类名向上查找祖先节点
 * 使用范围：zoomOut 判断当前编辑器是否位于 block popover
 * 解耦评估：DOM 工具函数职责清晰，转发层用于稳定依赖入口
 */
import { hasClosestByClassName } from "../../../protyle/util/hasClosest";
/** 导出 hasClosestByClassName 供 zoomOut 判断弹层上下文 */
export { hasClosestByClassName };

/**
 * 用途：处理 getDoc 响应并写入编辑器
 * 使用范围：zoomOut 主流程收到文档数据后的渲染入口
 * 解耦评估：渲染入口为核心流程，当前通过转发层收敛路径耦合
 */
import { onGet } from "../../../protyle/util/onGet";
/** 导出 onGet 供 zoomOut 注入文档数据 */
export { onGet };

/**
 * 用途：聚焦指定块并激活编辑位置
 * 使用范围：zoomOut 回到聚焦块或其可见替代块
 * 解耦评估：选区基础能力稳定，转发层减少业务文件跨层依赖
 */
import { focusBlock } from "../../../protyle/util/selection";
/** 导出 focusBlock 供 zoomOut 聚焦块元素 */
export { focusBlock };

/**
 * 用途：查找当前可显示的首个块
 * 使用范围：zoomOut 聚焦块处于容器节点时回退到可显示块
 * 解耦评估：块结构工具函数职责明确，转发层降低业务耦合
 */
import { getFirstBlock } from "../../../protyle/wysiwyg/getBlock";
/** 导出 getFirstBlock 供 zoomOut 选择可显示块 */
export { getFirstBlock };

/**
 * 用途：同步请求补偿数据
 * 使用范围：zoomOut 聚焦块缺失时查询 unfolded parent
 * 解耦评估：同步请求属于遗留兼容流程，暂保持；通过转发层限制依赖扩散
 */
import { fetchSyncPost } from "../../../util/network/fetch";
/** 导出 fetchSyncPost 供 zoomOut 查询补偿数据 */
export { fetchSyncPost };

/**
 * 用途：读取安全的移动端运行对象
 * 使用范围：zoomOut 判断是否处于 mobile editor 运行态
 * 解耦评估：window 访问通过环境层封装，业务文件不直接触达全局对象
 */
import { getSafeSiyuanMobile } from "../../../util/siyuanEnvironments/mobile.environment";
/** 导出 getSafeSiyuanMobile 供 zoomOut 判断移动编辑器上下文 */
export { getSafeSiyuanMobile };

/**
 * 用途：读取运行时配置
 * 使用范围：zoomOut 读取 dynamicLoadBlocks
 * 解耦评估：配置读取已在环境层抽象，转发层进一步统一入口
 */
import { getSiyuanConfig } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanConfig 供 zoomOut 读取配置 */
export { getSiyuanConfig };

/**
 * 用途：读取运行时 storage
 * 使用范围：zoomOut 更新 LOCAL_DOCINFO 后同步写入存储
 * 解耦评估：storage 访问经环境层封装可降低 window 直接耦合
 */
import { getSiyuanStorage } from "../../../util/siyuanEnvironments/getSiyuanConfig.environment";
/** 导出 getSiyuanStorage 供 zoomOut 读取存储对象 */
export { getSiyuanStorage };
