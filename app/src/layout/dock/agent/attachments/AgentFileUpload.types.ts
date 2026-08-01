/** 已进入 AI 主笔记本附件目录的文件摘要。 */
export interface AgentUploadedFile {
    name: string;
    path: string;
}

/** 一次附件上传的完整结果，部分成功与逐文件失败同时保留。 */
export interface AgentFileUploadResult {
    uploaded: AgentUploadedFile[];
    failed: string[];
    message: string;
}
