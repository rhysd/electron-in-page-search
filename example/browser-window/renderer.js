const searchInPage = require('../..').default;
const remote = require('electron').remote;

/*
 * Create a search instance for the current page.
 * Make sure that create the search instance per one WebContents instance.
 */
const search = searchInPage(remote.getCurrentWebContents());

document.getElementById('search-page-button').addEventListener('click', () => {
    /*
     * .openSearchWindow() method opens and activates a search window.
     * User can input the query and start the word seatch in page.
     */
    search.openSearchWindow();
});
