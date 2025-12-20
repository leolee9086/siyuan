import { bazaarData } from "./bazaarData";
import { App } from "../../index";

export interface IBazaar {
    element: HTMLElement;
    _data: typeof bazaarData;
    _onBazaar(response: IWebSocketData, bazaarType: TBazaarType): void;
    _genMyHTML(bazaarType: TBazaarType, app: App, updateUpdate?: boolean): void;
    _renderReadme(bazaarType: TBazaarType, data: IBazaarItem, downloaded: boolean): void;
    genHTML(): string;
    bindEvent(app: App): void;
    _renderFilteredPackages(bazaarType: TBazaarType): void;
}

export interface IBazaarDataObj {
    bazaarType: TBazaarType;
    themeMode?: string;
    updated?: string;
    name?: string;
    repoURL?: string;
    repoHash?: string;
    downloaded?: boolean;
    downloads?: number;
    [key: string]: unknown;
}
