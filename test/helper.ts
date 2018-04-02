import { remote } from 'electron';

export function pause(msec: number) {
    return () =>
        new Promise(resolve => {
            setTimeout(resolve, msec);
        });
}

export function waitForReady(w: Electron.WebviewTag, wait: number = 1000) {
    return new Promise(resolve => {
        const c = w.getWebContents && w.getWebContents();
        if (c) {
            resolve(w);
            return;
        }
        w.addEventListener('dom-ready', resolve);
    }).then(pause(wait));
}

export function clickButton(w: Electron.WebviewTag, button: 'forward' | 'back' | 'close') {
    return () =>
        new Promise(resolve => {
            const sel = `.inpage-search-${button}`;
            const src = `(function(){ document.querySelector('${sel}').click(); })()`;
            w.executeJavaScript(src, false, resolve);
        });
}

export function searchStart(w: Electron.WebviewTag, query: string, click_times: number, forward: boolean = true) {
    return () =>
        new Promise(resolve => {
            remote.getCurrentWindow().focusOnWebView();

            const selector = forward ? '.inpage-search-forward' : '.inpage-search-back';
            let src = '(function() {';
            src += `document.querySelector(".inpage-search-input").value = "${query}";`;
            src += `const b = document.querySelector('${selector}');`;
            for (let i = 0; i < click_times; ++i) {
                src += 'b.click();';
            }
            src += '})()';
            w.executeJavaScript(src, false, resolve);
        });
}
