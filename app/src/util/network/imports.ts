/** 用途：内核退出 IPC 常量。使用范围：网络错误处理的退出路径；解耦评估：协议常量必须保持全应用唯一，参数传递只会扩大调用表面。 */
import { Constants } from "../../constants";
/** 用途：判断浏览器、Electron 与移动宿主。使用范围：网络错误、Service Worker 与消息重载分支；解耦评估：平台环境事实由现有平台模块统一判定。 */
import { isBrowser, isElectron, isMobile } from "../../platform";
/** 用途：向 Electron 主进程发送退出消息。使用范围：特定系统 API 网络失败；解耦评估：本目录网关直达平台桥接，业务请求处理不直接依赖 Electron 实现。 */
import { ipcSend } from "../../platform/electron/ipcRenderer";
/** 用途：读取配置、存储、WebSocket 与请求竞态标识。使用范围：消息分发和请求处理；解耦评估：这些能力操作同一 Siyuan 运行时状态，必须直达唯一环境实现。 */
import { getSiyuanConfig, getSiyuanReqId, getSiyuanStorage, getSiyuanWebSocket, setSiyuanReqId } from "../siyuanEnvironments/getSiyuanConfig.environment";
/** 用途：访问移动原生网络桥接对象。使用范围：网络兼容路径；解耦评估：原生桥身份由环境模块统一封装，不在请求调用链重复参数化。 */
import { getWindowJSAndroid, getWindowJSHarmony, getWindowWebkit } from "../siyuanEnvironments/windowNative.environment";
/** 用途：访问浏览器 Service Worker 能力。使用范围：网络环境适配；解耦评估：浏览器能力探测由环境模块集中负责。 */
import { getServiceWorkerContainer, isServiceWorkerAvailable } from "../siyuanEnvironments/windowStandard.environment";
/** 用途：认证失效后重载当前页面。使用范围：HTTP 401 响应；解耦评估：location 访问由环境模块封装以保持测试可替换性。 */
import { reloadLocation } from "../siyuanEnvironments/windowLocation.environment";
/** 用途：读取类型安全的跨模块注册状态。使用范围：请求信号量与 Model 错误处理；解耦评估：注册表统一拥有跨 HMR 生命周期状态，局部闭包会造成状态分裂。 */
import { getSForgeState } from "../../config/sforge.global";
/** 用途：初始化类型安全的跨模块注册状态。使用范围：首次请求创建信号量；解耦评估：注册表统一拥有跨 HMR 生命周期状态，局部闭包会造成状态分裂。 */
import { setSForgeState } from "../../config/sforge.global";
/** 用途：定位 Model 错误处理器。使用范围：事务网络故障；解耦评估：命名 Symbol 是注册表键的稳定身份，事件无法表达可查询状态。 */
import { MODEL_HANDLERS } from "../../config/sforge.symbols";
/** 用途：定位请求信号量。使用范围：全部受限 POST 请求；解耦评估：命名 Symbol 保证所有入口共享同一并发计数。 */
import { REQUEST_SEMAPHORE } from "../../config/sforge.symbols";
/** 用途：定位内核消息 UI 依赖。使用范围：processMessage 的宿主能力注册与读取；解耦评估：命名 Symbol 保证完整应用各入口共享同一依赖实例。 */
import { PROCESS_MESSAGE_UI_DEPENDENCIES } from "../../config/sforge.symbols";

/** 导出网络协议常量。 */
export { Constants };
/** 导出 Electron 宿主判定。 */
export { isElectron };
/** 导出 Electron IPC 发送能力。 */
export { ipcSend };
/** 导出浏览器宿主判定。 */
export { isBrowser };
/** 导出请求竞态标识读取能力。 */
export { getSiyuanReqId };
/** 导出已验证的应用配置访问器。 */
export { getSiyuanConfig };
/** 导出已验证的本地存储访问器。 */
export { getSiyuanStorage };
/** 导出 WebSocket 运行时访问器。 */
export { getSiyuanWebSocket };
/** 导出请求竞态标识写入能力。 */
export { setSiyuanReqId };
/** 导出 Android 原生桥读取能力。 */
export { getWindowJSAndroid };
/** 导出 Harmony 原生桥读取能力。 */
export { getWindowJSHarmony };
/** 导出 WebKit 原生桥读取能力。 */
export { getWindowWebkit };
/** 导出 Service Worker 容器读取能力。 */
export { getServiceWorkerContainer };
/** 导出 Service Worker 可用性判定。 */
export { isServiceWorkerAvailable };
/** 导出页面重载环境能力。 */
export { reloadLocation };
/** 导出类型安全的全局注册表读取能力供网络并发与错误处理使用。 */
export { getSForgeState };
/** 导出类型安全的全局注册表写入能力供网络并发状态初始化使用。 */
export { setSForgeState };
/** 导出 Model 错误处理器注册键供事务请求故障分派使用。 */
export { MODEL_HANDLERS };
/** 导出网络信号量注册键供所有请求实例共享同一并发状态。 */
export { REQUEST_SEMAPHORE };
/** 导出内核消息 UI 依赖注册键。 */
export { PROCESS_MESSAGE_UI_DEPENDENCIES };
/** 导出移动宿主判定。 */
export { isMobile };
