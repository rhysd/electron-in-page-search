const searchInPage = require('../..').default;

/*
 * Create a search instance for the current page.
 * Make sure that create the search instance per one WebContents instance.
 */
let search;
const webview = document.getElementById('target-webview');
webview.addEventListener('dom-ready', () => {
    search = searchInPage(webview);
    console.log(search);
});

document.getElementById('search-page-button').addEventListener('click', () => {
    /*
     * .openSearchWindow() method opens and activates a search window.
     * User can input the query and start the word seatch in page.
     */
    search.openSearchWindow();
});
