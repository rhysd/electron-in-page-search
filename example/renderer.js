const searchInPage = require('..').default;
const remote = require('electron').remote;

const search = searchInPage(remote.getCurrentWebContents());

document.getElementById('search-page-button').addEventListener('click', () => {
    search.openSearchWindow();
});
