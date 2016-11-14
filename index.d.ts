/// <reference types="electron" />
/// <reference types="node" />
import { EventEmitter } from 'events';
export interface InPageSearchOptions {
    searchWindowWebview?: Electron.WebViewElement;
    customCssPath?: string;
    customSearchWindowHtmlPath?: string;
    openDevToolsOfSearchWindow?: boolean;
}
export declare type SearchTarget = Electron.WebContents | Electron.WebViewElement;
export default function searchInPage(searchTarget: SearchTarget, options?: InPageSearchOptions): InPageSearch;
export declare class InPageSearch extends EventEmitter {
    searcher: Electron.WebViewElement;
    opened: boolean;
    targetIsWebview: boolean;
    private findInPage;
    private stopFindInPage;
    private requestId;
    private prevQuery;
    private activeIdx;
    constructor(searcher: Electron.WebViewElement, target: SearchTarget);
    openSearchWindow(): void;
    closeSearchWindow(): void;
    isSearching(): boolean;
    startToFind(query: string): void;
    findNext(forward: boolean): void;
    stopFind(): void;
    private onSearchQuery(text);
    private onFoundInPage(result);
    private registerFoundCallback(target);
    private setupSearchWindowWebview();
    private focusOnInput();
    private focusOnInputOnBrowserWindow();
    private sendResult(nth, all);
}
