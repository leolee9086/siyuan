/** @同步豁免: UI构建 - PDF 操作需要同步读取当前语言提示。 */
export const getPdfLoadingMessage = () => {
    return window.siyuan?.languages?.pdfIsLoading ?? "PDF is loading";
};
