// https://github.com/siyuan-note/siyuan/pull/8012
import { isServiceWorkerAvailable, getServiceWorkerContainer } from "./siyuanEnvironments/windowStandard.environment";
import { getWindowWebkit, getWindowJSAndroid, getWindowJSHarmony } from "./siyuanEnvironments/windowNative.environment";
import { isBrowser } from "../platform";

export const registerServiceWorker = (
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
        serviceWorkerContainer
            .register(scriptURL, options)
            .then(registration => {
                registration.update();
            }).catch(e => {
            console.debug(`Registration failed with ${e}`);
        });
    }
};
