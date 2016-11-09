import {EventEmitter} from 'events';
import * as path from 'path';

const DefaultSearchWindowHtml = `file://${path.join(__dirname, 'search-window.html')}`;
const ShouldDebug = process.env.ELECTRON_IN_PAGE_SEARCH_DEBUG === 'development';
const log = ShouldDebug ? console.log.bind(console) : function nop() { /* nop */ };

export interface InPageSearchOptions {
    startWord?: string;
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
    }
    if (!options.searchWindowWebview.src) {
        options.searchWindowWebview.src = DefaultSearchWindowHtml;
    }
    return new InPageSearch(
        options.searchWindowWebview,
        options.startWord || '',
        searchTarget,
    );
}

export class InPageSearch extends EventEmitter {
    private findInPage: FindInPage;
    private requestId = 0;

    constructor(
        public searcher: Electron.WebViewElement,
        private word: string,
        target: SearchTarget,
    ) {
        super();
        this.findInPage = target.findInPage.bind(target);
        this.registerFoundCallback(target);
        this.setupSearchWindowWebview();
        this.searcher.classList.add('search-inactive');
        if (word !== '') {
            this.startSearch(word);
        }
    }

    startSearch(word: string) {
        log('Start to search:', word);
        this.searcher.classList.remove('search-inactive');
        this.searcher.classList.add('search-active');
        this.focusOnInput()
        this.emit('start', word);
        // TODO
    }

    stopSearch() {
        this.searcher.classList.remove('search-active');
        this.searcher.classList.add('search-inactive');
        this.emit('stop');
    }

    private onSearchQuery(text: string) {
        log('Query from search window webview:', text);
        // TODO
    }

    private onFoundInPage(result: Electron.FoundInPageResult) {
        log('Found: result', result, 'word:', this.word);
        // TODO
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
        this.emit('focus-input');
    }

}
