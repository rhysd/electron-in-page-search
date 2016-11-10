import {EventEmitter} from 'events';
import * as path from 'path';

const DefaultSearchWindowHtml = `file://${path.join(__dirname, 'search-window.html')}`;
const ShouldDebug = !!process.env.ELECTRON_IN_PAGE_SEARCH_DEBUG;
const log = ShouldDebug ? console.log.bind(console) : function nop() { /* nop */ };

export interface InPageSearchOptions {
    searchWindowWebview?: Electron.WebViewElement;
}

type RequestId = number;
type FindInPage = (text: string, options?: Electron.FindInPageOptions) => RequestId;
type StopFindInPage = (action: Electron.StopFindInPageAtion) => void;
type SearchTarget = Electron.WebContents | Electron.WebViewElement;

function isWebView(target: any): target is Electron.WebViewElement {
    return target.tagName !== undefined && target.tagName === 'WEBVIEW';
}

function injectScriptToWebView(target: Electron.WebViewElement) {
    const injected_script = path.join(__dirname, 'search-window.js');
    const script = `(function(){
        const s = document.createElement('script');
        s.src = 'file://${injected_script}';
        document.body.appendChild(s);
    })()`;

    if (target.executeJavaScript) {
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
        document.body.appendChild(options.searchWindowWebview);
    }

    if (!options.searchWindowWebview.src) {
        options.searchWindowWebview.src = DefaultSearchWindowHtml;
    }

    injectScriptToWebView(options.searchWindowWebview);

    return new InPageSearch(
        options.searchWindowWebview,
        searchTarget,
    );
}

export class InPageSearch extends EventEmitter {
    public opened = false;
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
        this.findInPage = target.findInPage.bind(target);
        this.stopFindInPage = target.stopFindInPage.bind(target);
        this.registerFoundCallback(target);
        this.setupSearchWindowWebview();
        this.searcher.classList.add('search-inactive');
        this.prevQuery = '';
    }

    openSearchWindow() {
        this.searcher.classList.remove('search-inactive');
        this.searcher.classList.add('search-active');
        this.opened = true;
        this.emit('open');
        this.focusOnInput();
    }

    stopSearch() {
        this.stopFindInPage('clearSelection');
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
        this.emit('start');
        this.focusOnInput();
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
        this.focusOnInput();
    }

    private onSearchQuery(text: string) {
        log('Query from search window webview:', text);

        if (text === '') {
            this.stopSearch();
            return;
        }

        if (!this.isSearching() || this.prevQuery !== text) {
            this.startToFind(text);
        } else {
            this.findNext(true);
        }
    }

    private onFoundInPage(result: Electron.FoundInPageResult) {
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
        // TODO: Inject IPC code to send the user input
        this.searcher.addEventListener('ipc-message', event => {
            switch (event.channel) {
                case 'electron-in-page-search:query': {
                    const text = event.args[0] as string;
                    this.onSearchQuery(text);
                    break;
                }
                case 'electron-in-page-search:close': {
                    this.stopSearch();
                    break;
                }
                case 'electron-in-page-search:back': {
                    if (this.isSearching()) {
                        this.findNext(false);
                    }
                    break;
                }
                case 'electron-in-page-search:forward': {
                    if (this.isSearching()) {
                        this.findNext(true);
                    }
                    break;
                }
                default:
                    break;
            }
        });
        if (ShouldDebug) {
            this.searcher.addEventListener('console-message', e => {
                log('Console message from search window:', e.line, e.message);
            });
        }
    }

    private focusOnInput() {
        this.searcher.focus();
        this.searcher.send('electron-in-page-search:focus');
        this.emit('focus-input');
    }

    private sendResult(nth: number, all: number) {
        this.searcher.send('electron-in-page-search:result', nth, all);
        this.emit('found', this.prevQuery, nth, all);
    }
}
