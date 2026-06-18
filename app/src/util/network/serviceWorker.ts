// https://github.com/siyuan-note/siyuan/pull/8012
/**
 * 用途：检测浏览器是否支持 Service Worker API
 * 使用范围：仅在 registerServiceWorker 函数中使用，作为注册前的可用性检查
 * 解耦评估：这是浏览器标准 API 的封装访问器，通过 imports.ts 转发符合项目导入规范
 */
import { isServiceWorkerAvailable } from "./imports";
/**
 * 用途：获取 Service Worker 注册容器对象
 * 使用范围：仅在 registerServiceWorker 函数中使用，用于执行 Service Worker 注册操作
 * 解耦评估：这是浏览器标准 API 的封装访问器，通过 imports.ts 转发符合项目导入规范
 */
import { getServiceWorkerContainer } from "./imports";
/**
 * 用途：获取 WebKit 原生客户端环境检测对象
 * 使用范围：仅在 registerServiceWorker 函数中使用，WebKit 原生环境下跳过 Service Worker 注册
 * 解耦评估：这是原生环境检测的封装访问器，通过 imports.ts 转发符合项目导入规范
 */
import { getWindowWebkit } from "./imports";
/**
 * 用途：获取 Android 原生客户端环境检测对象
 * 使用范围：仅在 registerServiceWorker 函数中使用，Android 原生环境下跳过 Service Worker 注册
 * 解耦评估：这是原生环境检测的封装访问器，通过 imports.ts 转发符合项目导入规范
 */
import { getWindowJSAndroid } from "./imports";
/**
 * 用途：获取 Harmony 原生客户端环境检测对象
 * 使用范围：仅在 registerServiceWorker 函数中使用，Harmony 原生环境下跳过 Service Worker 注册
 * 解耦评估：这是原生环境检测的封装访问器，通过 imports.ts 转发符合项目导入规范
 */
import { getWindowJSHarmony } from "./imports";
/**
 * 用途：判断当前是否运行在浏览器环境，用于决定是否注册 Service Worker
 * 使用范围：仅在 registerServiceWorker 函数中使用，作为环境检测的前置条件
 * 解耦评估：平台判断是基础设施能力，通过 imports.ts 转发符合项目导入规范
 */
import { isBrowser } from "./imports";

/**
 * 注册 Service Worker 以启用离线缓存与资源代理。
 * 仅在浏览器环境下生效，原生客户端（WebKit/Android/Harmony）环境会跳过注册。
 * 应在应用初始化阶段调用，确保 Service Worker 尽早接管页面请求。
 */
export const registerServiceWorker = async (
    scriptURL: string,
    options: RegistrationOptions = {
        scope: "/",
        type: "classic",
        updateViaCache: "all",
    },
) => {
    if (!isBrowser) {
        return;
    }
    if (getWindowWebkit()?.messageHandlers || getWindowJSAndroid() || getWindowJSHarmony() ||
        !isServiceWorkerAvailable()
    ) {
        return;
    }

    // REF https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration
    const serviceWorkerContainer = getServiceWorkerContainer();
    if (serviceWorkerContainer) {
        try {
            const registration = await serviceWorkerContainer.register(scriptURL, options);
            registration.update();
        } catch (e) {
            console.debug(`Registration failed with ${e}`);
        }
    }
};
