import {setNoteBook} from "../util/file/notebook/store";

interface InstallAppConfigurationOptions {
    startNotebookRefresh?: boolean;
}

/** 注入 Kernel 配置后再启动所有会读取该配置的首轮笔记本刷新。 */
export const installAppConfiguration = (
    config: Config.IConf,
    isPublish: boolean,
    options: InstallAppConfigurationOptions = {},
) => {
    window.siyuan.config = config;
    window.siyuan.isPublish = isPublish;
    if (options.startNotebookRefresh !== false) {
        setNoteBook();
    }
    return config;
};
