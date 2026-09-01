import {beforeEach, describe, expect, it, vi} from "vitest";

import {createProtyleDomainFixture} from "../support/protyleDomain.fixture";

const mocks = vi.hoisted(() => ({
    confirmDialog: vi.fn((_title: string, _text: string, confirm: () => void) => confirm()),
    destroy: vi.fn(),
    hideMessage: vi.fn(),
    showMessage: vi.fn(() => "upload-message"),
    xhrs: [] as FakeXHR[],
}));

class FakeXHR {
    static readonly DONE = 4;
    readyState = 0;
    status = 0;
    responseText = "";
    method = "";
    url = "";
    withCredentials = false;
    body?: FormData;
    headers = new Map<string, string>();
    onreadystatechange?: () => void;
    upload: {onprogress?: (event: ProgressEvent) => void} = {};

    open(method: string, url: string) {
        this.method = method;
        this.url = url;
    }

    setRequestHeader(name: string, value: string) {
        this.headers.set(name, value);
    }

    send(body: FormData) {
        this.body = body;
    }

    complete(status: number, responseText: string) {
        this.readyState = FakeXHR.DONE;
        this.status = status;
        this.responseText = responseText;
        this.onreadystatechange?.();
    }
}

vi.mock("../../src/protyle/upload/transport/imports", () => ({
    Constants: {SIZE_UPLOAD_TIP_SIZE: 1024, UPLOAD_ADDRESS: "/legacy-upload"},
    confirmDialog: mocks.confirmDialog,
    destroy: mocks.destroy,
    escapeHtml: (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;"),
    filesize: (size: number) => `${size} B`,
    hideMessage: mocks.hideMessage,
    showMessage: mocks.showMessage,
    siyuanI18n: {
        fileTypeError: "file type error",
        nameEmpty: "name empty",
        over: "over",
        upload: "upload",
        uploadFileTooLarge: "${x} ${y}",
        uploading: "uploading",
    },
}));

vi.mock("../../src/protyle/upload/transport/xhr.factory", () => ({
    createUploadXHR: () => {
        const xhr = new FakeXHR();
        mocks.xhrs.push(xhr);
        return xhr;
    },
}));

import {uploadFiles} from "../../src/protyle/upload/transport";

const createUploadContext = () => {
    const domain = createProtyleDomainFixture();
    const applyUploadedFiles = vi.fn(async () => undefined);
    const uploadLocalFiles = vi.fn();
    domain.applyUploadedFiles = applyUploadedFiles;
    domain.uploadLocalFiles = uploadLocalFiles;
    const editorElement = document.createElement("div");
    const protyleElement = document.createElement("div");
    const progressElement = document.createElement("div");
    document.body.appendChild(protyleElement);
    Object.assign(domain.protyle, {
        block: {rootID: "root-id"},
        element: protyleElement,
        getInstance: () => domain,
        lite: false,
        options: {
            upload: {
                fieldName: "file[]",
                filename: (name: string) => name,
                max: 1024 * 1024,
                url: "/upload",
            },
        },
        upload: {element: progressElement, isUploading: false},
        wysiwyg: {element: editorElement},
    });
    return {domain, applyUploadedFiles, uploadLocalFiles, editorElement, progressElement};
};

describe("upload transport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.xhrs.length = 0;
        document.body.innerHTML = "";
        vi.stubGlobal("DataTransferItem", class DataTransferItem {});
        vi.stubGlobal("XMLHttpRequest", FakeXHR);
    });

    it("configures XHR and gives options.success precedence over the explicit callback", () => {
        const context = createUploadContext();
        const optionsSuccess = vi.fn();
        const explicitSuccess = vi.fn();
        context.domain.protyle.options.upload.success = optionsSuccess;
        context.domain.protyle.options.upload.token = "token";
        context.domain.protyle.options.upload.withCredentials = true;
        const input = document.createElement("input");

        uploadFiles(context.domain.protyle, [new File(["data"], "asset.txt", {type: "text/plain"})], input, explicitSuccess);
        const xhr = mocks.xhrs[0];
        expect({method: xhr.method, url: xhr.url, token: xhr.headers.get("X-Upload-Token"), credentials: xhr.withCredentials})
            .toEqual({method: "POST", url: "/upload", token: "token", credentials: true});
        expect(xhr.body?.get("id")).toBe("root-id");

        xhr.complete(200, "response");

        expect(optionsSuccess).toHaveBeenCalledWith(context.editorElement, "response");
        expect(explicitSuccess).not.toHaveBeenCalled();
        expect(context.applyUploadedFiles).not.toHaveBeenCalled();
        expect(input.value).toBe("");
        expect(context.progressElement.style.display).toBe("none");
    });

    it("uses the explicit callback without applying the default format hook", () => {
        const context = createUploadContext();
        const explicitSuccess = vi.fn();
        const format = vi.fn(() => "formatted");
        context.domain.protyle.options.upload.format = format;

        uploadFiles(context.domain.protyle, [new File(["data"], "asset.txt")], undefined, explicitSuccess);
        mocks.xhrs[0].complete(200, "raw");

        expect(explicitSuccess).toHaveBeenCalledWith("raw");
        expect(format).not.toHaveBeenCalled();
        expect(context.applyUploadedFiles).not.toHaveBeenCalled();
    });

    it("formats only the default result before delegating to the complete Protyle domain", () => {
        const context = createUploadContext();
        const format = vi.fn(() => "formatted");
        context.domain.protyle.options.upload.format = format;
        const file = new File(["data"], "asset.txt");

        uploadFiles(context.domain.protyle, [file]);
        mocks.xhrs[0].complete(200, "raw");

        expect(format).toHaveBeenCalledWith([file], "raw");
        expect(context.applyUploadedFiles).toHaveBeenCalledWith("formatted");
    });

    it("escapes accepted file names in upload status and confirmation HTML", () => {
        const context = createUploadContext();
        const filename = `<img src=x onerror="alert(1)">.txt`;
        const file = new File([new Uint8Array(1024)], filename, {type: "text/plain"});

        uploadFiles(context.domain.protyle, [file]);

        const statusHTML = mocks.showMessage.mock.calls[0][0] as string;
        const confirmationHTML = mocks.confirmDialog.mock.calls[0][1] as string;
        expect(statusHTML).toContain("&lt;img src=x onerror=\"alert(1)\">.txt");
        expect(statusHTML).not.toContain(`<img src=x onerror="alert(1)">.txt`);
        expect(confirmationHTML).toContain("&lt;img src=x onerror=\"alert(1)\">.txt");
        expect(confirmationHTML).not.toContain(`<img src=x onerror="alert(1)">.txt`);
    });

    it("escapes rejected file names without creating an upload request", () => {
        const context = createUploadContext();
        context.domain.protyle.options.upload.max = 1;
        const filename = `<img src=x onerror="alert(1)">.txt`;
        const file = new File([new Uint8Array(2)], filename, {type: "text/plain"});

        uploadFiles(context.domain.protyle, [file]);

        const statusHTML = mocks.showMessage.mock.calls[0][0] as string;
        expect(statusHTML).toContain("&lt;img src=x onerror=\"alert(1)\">.txt");
        expect(statusHTML).not.toContain(`<img src=x onerror="alert(1)">.txt`);
        expect(mocks.confirmDialog).not.toHaveBeenCalled();
        expect(mocks.xhrs).toHaveLength(0);
    });

    it("delegates directory pseudo-files to the complete Protyle domain", () => {
        const context = createUploadContext();
        const directory = new File([], "folder");
        Object.defineProperty(directory, "path", {value: "D:/folder"});

        uploadFiles(context.domain.protyle, [directory]);

        expect(context.uploadLocalFiles).toHaveBeenCalledWith([{path: "D:/folder", size: null}], false);
        expect(mocks.xhrs).toHaveLength(0);
    });
});
