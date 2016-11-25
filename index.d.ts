/// <reference types="electron" />
/// <reference types="node" />
import { EventEmitter } from 'events';
export interface InPageSearchOptions {
    searchWindowWebview?: Electron.WebViewElement;
    searchWindowParent?: HTMLElement;
    customCssPath?: string;
    customSearchWindowHtmlPath?: string;
    openDevToolsOfSearchWindow?: boolean;
}
export declare type SearchTarget = Electron.WebContents | Electron.WebViewElement;
export default function searchInPage(searchTarget: SearchTarget, options?: InPageSearchOptions): InPageSearch;
export declare class InPageSearch extends EventEmitter {
    searcher: Electron.WebViewElement;
    searcherParent: HTMLElement;
    searchTarget: SearchTarget;
    opened: boolean;
    private requestId;
    private prevQuery;
    private activeIdx;
    private initialized;
    constructor(searcher: Electron.WebViewElement, searcherParent: HTMLElement, searchTarget: SearchTarget);
    openSearchWindow(): void;
    closeSearchWindow(): void;
    isSearching(): boolean;
    startToFind(query: string): void;
    findNext(forward: boolean): void;
    stopFind(): void;
    finalize(): void;
    private onSearchQuery(text);
    private onFoundInPage(result);
    private registerFoundCallback();
    private setupSearchWindowWebview();
    private focusOnInput();
    private focusOnInputOnBrowserWindow();
    private sendResult(nth, all);
}
