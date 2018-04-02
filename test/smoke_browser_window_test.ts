import searchInPage from '../src/index';
import * as A from 'assert';
import { remote } from 'electron';
import { spy } from 'sinon';
import { waitForReady, pause, searchStart, clickButton } from './helper';

context('For browser window', function() {
    before(function() {
        document.body.innerHTML = '<div>foo bar baz foo bar piyo poyo</div>';
    });

    describe('searchInPage()', function() {
        it('creates search instance which enables in-page search', function() {
            const s = searchInPage(remote.getCurrentWebContents());
            A.ok(s);
            A.ok(!s.opened);

            A.equal(document.querySelector('webview'), null);

            const opened = spy();
            s.on('open', opened);

            s.openSearchWindow();
            A.ok(opened.called);
            A.ok(s.opened);

            const w = document.querySelector('webview') as Electron.WebviewTag;
            A.equal(w.className, 'electron-in-page-search-window search-active');

            const started = spy();
            s.on('start', started);

            const stopped = spy();
            s.on('stop', stopped);

            const next = spy();
            return waitForReady(w)
                .then(pause(1000))
                .then(searchStart(w, 'foo', 1))
                .then(pause(1000))
                .then(() => {
                    A.ok(s.isSearching());
                    A.ok(started.called);
                    A.equal(started.args[0][0], 'foo');

                    s.on('next', next);
                })
                .then(clickButton(w, 'forward'))
                .then(pause(1000))
                .then(() => {
                    A.ok(next.called);
                    A.equal(next.args[0][0], 'foo');
                    A.ok(next.args[0][1]);
                })
                .then(clickButton(w, 'close'))
                .then(pause(1000))
                .then(() => {
                    A.ok(!s.opened);
                    A.ok(stopped.called);
                    A.equal(w.className, 'electron-in-page-search-window search-inactive');
                    s.finalize();
                    A.equal(document.querySelector('webview'), null);
                });
        });

        it('can search words multiple times', function() {
            const s = searchInPage(remote.getCurrentWebContents());
            s.openSearchWindow();
            const w = document.querySelector('webview') as Electron.WebviewTag;
            const next = spy();
            const start = spy();
            s.on('next', next);
            s.on('start', start);
            return waitForReady(w)
                .then(pause(1000))
                .then(searchStart(w, 'foo', 2))
                .then(pause(1000))
                .then(searchStart(w, 'ba', 2))
                .then(pause(1000))
                .then(() => {
                    A.equal(start.args[0][0], 'foo');
                    A.equal(start.args[1][0], 'ba');
                    A.equal(next.args[0][0], 'foo');
                    A.ok(next.args[0][1]);
                    A.equal(next.args[1][0], 'ba');
                    A.ok(next.args[1][1]);
                })
                .then(clickButton(w, 'close'))
                .then(pause(1000))
                .then(() => {
                    A.ok(!s.isSearching());
                    A.ok(!s.opened);
                    A.equal(w.className, 'electron-in-page-search-window search-inactive');
                    s.finalize();
                    A.equal(document.querySelector('webview'), null);
                });
        });

        it('can open/close search window repeatedly', function() {
            const s = searchInPage(remote.getCurrentWebContents());
            s.openSearchWindow();
            const w = document.querySelector('webview') as Electron.WebviewTag;
            const next = spy();
            const start = spy();
            const stop = spy();
            return waitForReady(w)
                .then(pause(1000))
                .then(searchStart(w, 'foo', 2))
                .then(pause(1000))
                .then(() => s.closeSearchWindow())
                .then(pause(1000))
                .then(() => {
                    A.equal(w.className, 'electron-in-page-search-window search-inactive');
                    s.on('next', next);
                    s.on('start', start);
                    s.openSearchWindow();
                })
                .then(pause(1000))
                .then(searchStart(w, 'ba', 2))
                .then(pause(1000))
                .then(() => {
                    A.equal(start.args[0][0], 'ba');
                    A.equal(next.args[0][0], 'ba');
                    A.ok(next.args[0][1]);
                    s.on('stop', stop);
                })
                .then(clickButton(w, 'close'))
                .then(pause(1000))
                .then(() => {
                    A.ok(stop.called);
                    A.ok(!s.opened);
                    A.equal(w.className, 'electron-in-page-search-window search-inactive');
                    s.finalize();
                    A.equal(document.querySelector('webview'), null);
                });
        });
    });
});
