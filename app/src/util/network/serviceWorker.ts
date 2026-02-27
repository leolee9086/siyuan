// https://github.com/siyuan-note/siyuan/pull/8012
import { isServiceWorkerAvailable, getServiceWorkerContainer } from "../siyuanEnvironments/windowStandard.environment";
import { getWindowWebkit, getWindowJSAndroid, getWindowJSHarmony } from "../siyuanEnvironments/windowNative.environment";
import { isBrowser } from "../../platform";

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
): Promise<void> => {
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
