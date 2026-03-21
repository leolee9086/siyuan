import { tabRegistry } from "../registry";
import { initBazaarHub } from "./initHub";
import { initBazaarPublish } from "./initPublish";
import { initBazaarSourceTab } from "./initSource";
import {
    BAZAAR_HUB_TAB_TYPE,
    BAZAAR_PUBLISH_TAB_TYPE,
    BAZAAR_SOURCE_TAB_TYPE,
} from "./constants";

tabRegistry.register({
    type: BAZAAR_HUB_TAB_TYPE,
    init: initBazaarHub,
});

tabRegistry.register({
    type: BAZAAR_PUBLISH_TAB_TYPE,
    init: initBazaarPublish,
});

tabRegistry.register({
    type: BAZAAR_SOURCE_TAB_TYPE,
    init: initBazaarSourceTab,
});
