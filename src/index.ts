import { EventEmitter } from 'events';
import * as path from 'path';

const DefaultSearchWindowHtml = `file://${path.join(__dirname, 'search-window.html')}`;
const ShouldDebug = !!process.env.ELECTRON_IN_PAGE_SEARCH_DEBUG;
const log = ShouldDebug
    ? console.log.bind(console)
    : function nop() {
          /* nop */
      };

export interface InPageSearchOptions {
    searchWindowWebview?: Electron.WebviewTag;
    searchWindowParent?: HTMLElement;
    preloadSearchWindow?: boolean;
    customCssPath?: string;
    customSearchWindowHtmlPath?: string;
    openDevToolsOfSearchWindow?: boolean;
}

type RequestId = number;

export type SearchTarget = Electron.WebContents | Electron.WebviewTag;

export class InPageSearch extends EventEmitter {
    public opened = false;
    private requestId: RequestId | null = null;
    private prevQuery = '';
    private activeIdx = 0;
    private maxIdx = 0;
    private initialized = false;

    constructor(
        public searcher: Electron.WebviewTag,
        public searcherParent: HTMLElement,
        public searchTarget: SearchTarget,
        preload: boolean,
    ) {
        super();
        if (preload) {
            this.initialize();
        }
    }

    openSearchWindow() {
        if (this.opened) {
            log('Already opened');
            return;
        }

        this.initialize();

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
        this.requestId = this.searchTarget.findInPage(query);
        this.activeIdx = 0;
        this.maxIdx = 0;
        this.prevQuery = query;
        this.emit('start', query);
        this.focusOnInputOnBrowserWindow();
    }

    findNext(forward: boolean) {
        if (!this.isSearching()) {
            throw new Error('Search did not start yet. Use .startToFind() method to start the search');
        }
        this.requestId = this.searchTarget.findInPage(this.prevQuery, {
            forward,
            findNext: true,
        });
        this.emit('next', this.prevQuery, forward);
        this.focusOnInputOnBrowserWindow();
    }

    stopFind() {
        this.searchTarget.stopFindInPage('clearSelection');
    }

    // You need to call this method when destroying InPageSearch instance.
    // Or the <webview> element will ramain in DOM and leaks memory.
    finalize() {
        this.searcherParent.removeChild(this.searcher);
    }

    private initialize() {
        if (this.initialized) {
            return;
        }

        this.registerFoundCallback();
        this.setupSearchWindowWebview();
        this.initialized = true;
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

        if (typeof result.activeMatchOrdinal === 'number') {
            this.activeIdx = result.activeMatchOrdinal;
        }
        if (typeof result.matches === 'number') {
            this.maxIdx = result.matches;
        }
        if (result.finalUpdate) {
            this.sendResult();
        }
    }

    private registerFoundCallback() {
        if (isWebView(this.searchTarget)) {
            this.searchTarget.addEventListener('found-in-page', event => {
                this.onFoundInPage(event.result);
            });
        } else {
            // When target is WebContents
            this.searchTarget.on('found-in-page', (_, result) => {
                this.onFoundInPage(result);
            });
        }
    }

    private setupSearchWindowWebview() {
        this.searcher.classList.add('search-inactive');
        this.searcher.classList.add('search-firstpaint');
        if (this.searcher.parentElement === null) {
            this.searcherParent.appendChild(this.searcher);
        }

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
        if (isWebView(this.searchTarget)) {
            return;
        }
        if (this.maxIdx !== 0 && this.activeIdx === this.maxIdx) {
            // XXX:
            // Add 100ms delay before putting focus when scrolling up for search wrap (#8).
            // When scrolling up, clearing webview focus is delayed and calling this.focusOnInput()
            // directly focuses on input before removing focus from <input>.
            setTimeout(this.focusOnInput.bind(this), 100);
            return;
        }
        this.focusOnInput();
    }

    private sendResult() {
        const nth = this.activeIdx;
        const all = this.maxIdx;
        log('Send result:', nth, all);
        this.searcher.send('electron-in-page-search:result', nth, all);
        this.emit('found', this.prevQuery, nth, all);
    }
}

function isWebView(target: any): target is Electron.WebviewTag {
    return target.tagName !== undefined && target.tagName === 'WEBVIEW';
}

function fixPathSlashes(p: string) {
    if (process.platform !== 'win32') {
        return p;
    }
    // Note:
    // On Windows, path separator is not '/' but browser seems to understand
    // '/' separator only. So we need to convert separator manually.
    //
    // e.g.
    //  C:\Users\foo\bar\piyo.html -> /C:/Users/foo/bar/piyo.html
    //
    // c.f.
    //  https://github.com/electron/electron/issues/1298
    let replaced = p.replace(/\\/g, '/');
    if (replaced[0] !== '/') {
        replaced = '/' + replaced;
    }
    return replaced;
}

function injectScriptToWebView(target: Electron.WebviewTag, opts: InPageSearchOptions) {
    const injected_script = fixPathSlashes(path.join(__dirname, 'search-window.js'));
    const css = fixPathSlashes(opts.customCssPath || path.join(__dirname, 'default-style.css'));
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
        target.executeJavaScript(script, false);
    } else {
        target.addEventListener('dom-ready', () => {
            target.executeJavaScript(script, false);
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
            wc.openDevTools({ mode: 'detach' });
        } else {
            wv.addEventListener('dom-ready', () => {
                wv.getWebContents().openDevTools({ mode: 'detach' });
            });
        }
    }

    return new InPageSearch(
        options.searchWindowWebview,
        options.searchWindowParent || document.body,
        searchTarget,
        !!options.preloadSearchWindow,
    );
}
