import {EventEmitter} from 'events';
import * as path from 'path';

const DefaultSearchWindowHtml = `file://${path.join(__dirname, 'search-window.html')}`;
const ShouldDebug = !!process.env.ELECTRON_IN_PAGE_SEARCH_DEBUG;
const log = ShouldDebug ? console.log.bind(console) : function nop() { /* nop */ };

export interface InPageSearchOptions {
    searchWindowWebview?: Electron.WebViewElement;
    customCssPath?: string;
    customSearchWindowHtmlPath?: string;
    openDevToolsOfSearchWindow?: boolean;
}

type RequestId = number;
type FindInPage = (text: string, options?: Electron.FindInPageOptions) => RequestId;
type StopFindInPage = (action: Electron.StopFindInPageAtion) => void;

export type SearchTarget = Electron.WebContents | Electron.WebViewElement;

function isWebView(target: any): target is Electron.WebViewElement {
    return target.tagName !== undefined && target.tagName === 'WEBVIEW';
}

function injectScriptToWebView(target: Electron.WebViewElement, opts: InPageSearchOptions) {
    const injected_script = path.join(__dirname, 'search-window.js');
    const css = opts.customCssPath || path.join(__dirname, 'default-style.css');
    const script = `(function(){
        const l = document.createElement('link');
        l.rel = 'stylesheet';
        l.href = '${css}';
        document.head.appendChild(l);
        const s = document.createElement('script');
        s.src = 'file://${injected_script}';
        document.body.appendChild(s);
    })()`;

    // XXX:
    // Before <webview> completes to load its web contents, .getWebContents()
    // (and some other APIs) have some 'statuses'.
    //
    // 1. .getWebContents property does not exist
    // 2. .getWebContents property exsit but .getWebContents() returns undefined
    //
    // So we need to check both 1. and 2. Note that <webview> instance doesn't
    // have the method to check whether it's dom-ready or not such as .isReady()
    // of app instance.
    if (target.getWebContents && target.getWebContents()) {
        target.executeJavaScript(script);
    } else {
        target.addEventListener('dom-ready', () => {
            target.executeJavaScript(script);
        });
    }
}

export default function searchInPage(searchTarget: SearchTarget, options?: InPageSearchOptions) {
    options = options || {};

    if (!options.searchWindowWebview) {
        options.searchWindowWebview = document.createElement('webview');
        options.searchWindowWebview.className = 'electron-in-page-search-window';
        options.searchWindowWebview.setAttribute('nodeintegration', '');
        options.searchWindowWebview.style.outline = '0';
        document.body.appendChild(options.searchWindowWebview);
    }

    const wv = options.searchWindowWebview;

    if (!wv.src) {
        wv.src = options.customSearchWindowHtmlPath || DefaultSearchWindowHtml;
    }

    injectScriptToWebView(wv, options);

    if (options.openDevToolsOfSearchWindow) {
        // XXX:
        // Please check the comment in injectScriptToWebView() function to know
        // why .getWebContents property is checked here.
        const wc = wv.getWebContents && wv.getWebContents();
        if (wc) {
            wc.openDevTools({mode: 'detach'});
        } else {
            wv.addEventListener('dom-ready', () => {
                wv.getWebContents().openDevTools({mode: 'detach'});
            });
        }
    }

    return new InPageSearch(
        options.searchWindowWebview,
        searchTarget,
    );
}

export class InPageSearch extends EventEmitter {
    public opened = false;
    public targetIsWebview = false;
    private findInPage: FindInPage;
    private stopFindInPage: StopFindInPage;
    private requestId: RequestId | null = null;
    private prevQuery: string;
    private activeIdx: number = 0;

    constructor(
        public searcher: Electron.WebViewElement,
        target: SearchTarget,
    ) {
        super();
        this.targetIsWebview = isWebView(target);
        this.findInPage = target.findInPage.bind(target);
        this.stopFindInPage = target.stopFindInPage.bind(target);
        this.registerFoundCallback(target);
        this.setupSearchWindowWebview();
        this.searcher.classList.add('search-inactive');
        this.searcher.classList.add('search-firstpaint');
        this.prevQuery = '';
    }

    openSearchWindow() {
        if (this.opened) {
            log('Already opened');
            return;
        }
        this.searcher.classList.remove('search-inactive');
        this.searcher.classList.remove('search-firstpaint');
        this.searcher.classList.add('search-active');
        this.opened = true;
        this.emit('open');
        this.focusOnInput();
    }

    closeSearchWindow() {
        if (!this.opened) {
            log('Already closed');
            return;
        }
        this.stopFind();
        this.searcher.send('electron-in-page-search:close');
        this.searcher.classList.remove('search-active');
        this.searcher.classList.add('search-inactive');
        this.emit('stop');
        this.requestId = null;
        this.prevQuery = '';
        this.opened = false;
    }

    isSearching() {
        return this.requestId !== null;
    }

    startToFind(query: string) {
        this.requestId = this.findInPage(query);
        this.prevQuery = query;
        this.emit('start', query);
        this.focusOnInputOnBrowserWindow();
    }

    findNext(forward: boolean) {
        if (!this.isSearching()) {
            throw new Error('Search did not start yet. Use .startToFind() method to start the search');
        }
        this.requestId = this.findInPage(this.prevQuery, {
            forward,
            findNext: true,
        });
        this.emit('next', this.prevQuery, forward);
        this.focusOnInputOnBrowserWindow();
    }

    stopFind() {
        this.stopFindInPage('clearSelection');
    }

    private onSearchQuery(text: string) {
        log('Query from search window webview:', text);

        if (text === '') {
            this.closeSearchWindow();
            return;
        }

        if (!this.isSearching() || this.prevQuery !== text) {
            this.startToFind(text);
        } else {
            this.findNext(true);
        }
    }

    private onFoundInPage(result: Electron.FoundInPageResult) {
        log('Found:', result);

        if (this.requestId !== result.requestId) {
            return;
        }
        if (result.activeMatchOrdinal) {
            this.activeIdx = result.activeMatchOrdinal;
        }
        if (result.finalUpdate && result.matches) {
            this.sendResult(this.activeIdx, result.matches);
        }
    }

    private registerFoundCallback(target: SearchTarget) {
        if (isWebView(target)) {
            target.addEventListener('found-in-page', event => {
                this.onFoundInPage(event.result);
            });
        } else {
            // When target is WebContents
            target.on('found-in-page', (_, result) => {
                this.onFoundInPage(result);
            });
        }
    }

    private setupSearchWindowWebview() {
        this.searcher.addEventListener('ipc-message', event => {
            switch (event.channel) {
                case 'electron-in-page-search:query': {
                    const text = event.args[0] as string;
                    this.onSearchQuery(text);
                    break;
                }
                case 'electron-in-page-search:close': {
                    this.closeSearchWindow();
                    break;
                }
                case 'electron-in-page-search:back': {
                    if (this.isSearching()) {
                        this.findNext(false);
                    } else {
                        const text = event.args[0] as string;
                        if (text) {
                            this.onSearchQuery(text);
                        }
                    }
                    break;
                }
                case 'electron-in-page-search:forward': {
                    if (this.isSearching()) {
                        this.findNext(true);
                    } else {
                        const text = event.args[0] as string;
                        if (text) {
                            this.onSearchQuery(text);
                        }
                    }
                    break;
                }
                default:
                    break;
            }
        });
        if (ShouldDebug) {
            this.searcher.addEventListener('console-message', e => {
                log('Console message from search window:', `line:${e.line}: ${e.message}`, e.sourceId);
            });
        }
    }

    private focusOnInput() {
        log('Set focus on search window');
        // XXX:
        // Directly calling .focus() doesn't focus on <webview> here.
        // We need to delay the call in order to fix it.
        setImmediate(() => {
            this.searcher.focus();
            this.searcher.send('electron-in-page-search:focus');
            this.emit('focus-input');
        });
    }

    // XXX:
    // Search API's behavior is different depending on a target.
    //
    // When the search target is BrowserWindow, focus to <webview> will be
    // cleared after calling .findInPage(). So we need to focus on <webview>
    // after that. Below method does it.
    //
    // When the search target is <webview>, focus to <webview> (for search window)
    // won't be cleared. So we need to focus on search window <webview> again after
    // calling .findInPage(). Futhermore, we should not focus on it because of
    // <webview> bug. calling .focus() on search window <webview> also gives a focus
    // to another <webview>. As the result, search window <webview> can't have a focus.
    //
    // https://github.com/electron/electron/issues/7939
    //
    // At opening search window webview, it needs to give a focus to the webview
    // anyway in order to set first focus to <input> in it.
    private focusOnInputOnBrowserWindow() {
        if (this.targetIsWebview) {
            return;
        }
        this.focusOnInput();
    }

    private sendResult(nth: number, all: number) {
        log('Send result:', nth, all);
        this.searcher.send('electron-in-page-search:result', nth, all);
        this.emit('found', this.prevQuery, nth, all);
    }
}
