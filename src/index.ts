import {EventEmitter} from 'events';
import * as path from 'path';

const DefaultSearchWindowHtml = `file://${path.join(__dirname, 'search-window.html')}`;
const ShouldDebug = process.env.ELECTRON_IN_PAGE_SEARCH_DEBUG === 'development';
const log = ShouldDebug ? console.log.bind(console) : function nop() { /* nop */ };

export interface InPageSearchOptions {
    searchWindowWebview?: Electron.WebViewElement;
}

type FindInPage = (text: string, options?: Electron.FindInPageOptions) => number
type SearchTarget = Electron.WebContents | Electron.WebViewElement;

function isWebView(target: any): target is Electron.WebViewElement {
    return target.tagName !== undefined && target.tagName === 'WEBVIEW';
}

export default function searchInPage(searchTarget: SearchTarget, options?: InPageSearchOptions) {
    options = options || {};

    if (!options.searchWindowWebview) {
        options.searchWindowWebview = document.createElement('webview');
        document.body.appendChild(options.searchWindowWebview);
    }

    if (!options.searchWindowWebview.src) {
        options.searchWindowWebview.src = DefaultSearchWindowHtml;
    }

    const injected_script = path.join(__dirname, 'search-window.js');
    options.searchWindowWebview.executeJavaScript(`(function(){
        const s = document.createElement('script');
        s.src = 'file://${injected_script}';
        document.body.appendChild(s);
    })()`);

    return new InPageSearch(
        options.searchWindowWebview,
        searchTarget,
    );
}

export class InPageSearch extends EventEmitter {
    private findInPage: FindInPage;
    private requestId: number | null = null;
    private prevQuery: string;
    private activeIdx: number = 0;

    constructor(
        public searcher: Electron.WebViewElement,
        target: SearchTarget,
    ) {
        super();
        this.findInPage = target.findInPage.bind(target);
        this.registerFoundCallback(target);
        this.setupSearchWindowWebview();
        this.searcher.classList.add('search-inactive');
        this.prevQuery = '';
    }

    openSearchWindow(word: string) {
        log('search:', word);
        this.searcher.classList.remove('search-inactive');
        this.searcher.classList.add('search-active');
        this.emit('open');
        this.focusOnInput()
        // TODO
    }

    stopSearch() {
        this.searcher.classList.remove('search-active');
        this.searcher.classList.add('search-inactive');
        this.emit('stop');
        this.requestId = null;
        this.prevQuery = '';
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
                case 'electron-page-in-search:query': {
                    const text = event.args[0] as string;
                    this.onSearchQuery(text);
                    break;
                }
                case 'electron-page-in-search:close': {
                    this.stopSearch();
                    break;
                }
                case 'electron-page-in-search:back': {
                    if (this.isSearching()) {
                        this.findNext(false);
                    }
                    break;
                }
                case 'electron-page-in-search:forward': {
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
        this.searcher.send('electron-page-in-search:focus');
        this.emit('focus-input');
    }

    private sendResult(nth: number, all: number) {
        this.searcher.send('electron-page-in-search:result', nth, all);
        this.emit('found', this.prevQuery, nth, all);
    }
}
