import searchInPage from '../src/index';
import * as A from 'assert';
import {remote} from 'electron';
import {spy} from 'sinon';

function waitForReady(w: Electron.WebviewTag) {
    return new Promise(resolve => {
        const c = w.getWebContents && w.getWebContents();
        if (c) {
            resolve(w);
            return;
        }
        w.addEventListener('dom-ready', resolve);
    });
}

function pause1000ms() {
    return new Promise(resolve => {
        setTimeout(resolve, 1000);
    });
}

context('For <webview>', function () {
    let wv: Electron.WebviewTag;

    before(function (done) {
        document.body.innerHTML = '';
        wv = document.createElement('webview');
        wv.src = 'https://example.com';
        document.body.appendChild(wv);
        wv.addEventListener('dom-ready', () => {
            wv.executeJavaScript(`document.body.innerText = 'foo bar baz foo bar piyo poyo'`, false);
            done();
        });
    });

    describe('searchInPage()', function () {
        it('creates search instance which enables in-page search', function () {
            const s = searchInPage(wv);
            A.ok(s);
            A.ok(!s.opened);

            const opened = spy();
            s.on('open', opened);

            s.openSearchWindow();
            A.ok(opened.called);
            A.ok(s.opened);

            const w = document.querySelector('.electron-in-page-search-window') as Electron.WebviewTag;
            A.equal(w.className, 'electron-in-page-search-window search-active');

            const started = spy();
            s.on('start', started);

            const next = spy();
            return waitForReady(w).then(pause1000ms).then(() => {
                remote.getCurrentWindow().focusOnWebView();
                w.executeJavaScript(`(function() {
                    document.querySelector('.inpage-search-input').value = 'foo';
                    document.querySelector('.inpage-search-forward').click();
                })()`, false);
            }).then(pause1000ms).then(() => {
                A.ok(started.called);
                A.equal(started.args[0][0], 'foo');

                s.on('next', next);

                w.executeJavaScript(`(function() {
                    document.querySelector('.inpage-search-forward').click();
                })()`, false);
            }).then(pause1000ms).then(() => {
                A.ok(next.called);
                A.equal(next.args[0][0], 'foo');
                A.ok(next.args[0][1]);
                w.executeJavaScript(`(function() {
                    document.querySelector('.inpage-search-close').click();
                })()`, false);
            }).then(pause1000ms).then(() => {
                A.ok(!s.opened);
                A.equal(w.className, 'electron-in-page-search-window search-inactive');
                s.finalize();
            });
        });
    });
});
