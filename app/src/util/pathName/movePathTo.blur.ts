import { setStorageVal } from "../../ai/imports";
import { Constants } from "../../constants";

/**
 * 创建输入框失焦事件处理器
 * 保存搜索历史到本地存储
 */
export const 创建失焦事件处理器 = (inputElement: HTMLInputElement) => {
    return () => {
        const storage = window.siyuan.storage;
        if (!storage) return;
        
        if (inputElement.value) {
            let list: string[] = storage[Constants.LOCAL_MOVE_PATH].keys;
            list.splice(0, 0, inputElement.value);
            list = Array.from(new Set(list)).slice(0, window.siyuan.config.search.limit);
            storage[Constants.LOCAL_MOVE_PATH].keys = list;
        }
        storage[Constants.LOCAL_MOVE_PATH].k = inputElement.value;
        setStorageVal(Constants.LOCAL_MOVE_PATH, storage[Constants.LOCAL_MOVE_PATH]);
    };
};
