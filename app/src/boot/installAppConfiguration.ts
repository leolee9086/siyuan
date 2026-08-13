import {setNoteBook} from "../util/file/notebook/store";

/** 注入 Kernel 配置后再启动所有会读取该配置的首轮笔记本刷新。 */
export const installAppConfiguration = (config: Config.IConf, isPublish: boolean) => {
    window.siyuan.config = config;
    window.siyuan.isPublish = isPublish;
    setNoteBook();
    return config;
};
