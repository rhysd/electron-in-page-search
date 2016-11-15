In-Page Search for Electron Applications
========================================
[![Build Status](https://travis-ci.org/rhysd/electron-in-page-search.svg?branch=master)](https://travis-ci.org/rhysd/electron-in-page-search) 
This package provides Chrome's native in-page search feature to Electron applications.
Electron exposes Chrome's native API to JavaScript. But native in-page search API has
some pitfalls and stateful. So this package wraps it and provide provide more easy,
pitfall-free APIs.

![screenshot](https://github.com/rhysd/ss/blob/master/electron-in-page-search/main.gif?raw=true)

In-page search can be used for browser window or webview (`BrowserWindow` instance or
`<webview>` tag) in Electron app. You can use only one function for both of them
in renderer process.

```javascript
// Pass current browser window's WebContents instance
const searchInWindow = searchInPage(remote.getCurrentWebContents());

// Pass <webview> instance
const searchInWebview = searchInPage(document.getElementById('my-webview'));

// Open inner window made with <webview> for in-page search

// Search some text in the browser window
searchInWindow.openSearchWindow();

// Search some text in the webview
searchInWebview.openSearchWindow();
```

This package works cross platform (macOS, Linux and Windows).

## Installation

```
$ npm install --save electron-in-page-search
```

## Examples

Two examples are added. So please see the code of working app there.

- [Search in browser window](examples/browser-window)
- [Search in `<webview>`](examples/webview)

You can try them by cloning this repository.

```
$ git clone https://github.com/rhysd/electron-in-page-search.git
$ cd electron-in-page-search
$ npm install
$ npm run build
$ npm run example # Run browser window example
$ cd example/webview/
$ npm start # Run webview example
```

To know APIs for this package, you can see [TypeScript's type definitions](index.d.ts).

## Usage

When you want to use in-page search in app, call `searchInPage` function to create an `InPageSearch` instance.

```javascript
import searchInPage from 'electron-in-page-search';
// or
const searchInPage = require('electron-in-page-search').default;

import {remote} from 'electron';

const inPageSearch = searchInPage(remote.getCurrentWebContents());

document.getElementById('some-button').addEventListener('click', () => {
    inPageSearch.openSearchWindow();
});
```

When calling `searchInPage`, it creates a `<webview>` element for search window.
This `<webview>` can avoid that in-page search finds the text in the search window.

The webview has a class property `electron-in-page-search-window search-inactive` by default.
Then `openSearchWindow` is called, the webview has a class property `electron-in-page-search-window search-active`
while searching. So you can styling the search window webview by CSS like below:

```css
.electron-in-page-search-window {
  width: 300px;
  height: 36px;
  background-color: white;
}

.electron-in-page-search-window.search-inactive {
  visibility: hidden;
}

.electron-in-page-search-window.search-active {
  visibility: visible;
}
```

You can control background color of search window by adding `background-color`
(in above, `white` is specified). You can customize CSS further (please see below
'Customization' section).

Please see [example's style](example/browser-window/style.css) for live example.

The search window contains 'back' button, 'forward' button, 'close' button and query form.
Application users can input a query and click them (or press enter key in the form) to start
the in-page search.
Repeating to press enter key or clicking 'back'/'forward' buttons moves a focus on hit words.
Finally the users can close a search window by clicking 'close' button to stop the search.

After a search window closing, the window's class property will be `electron-in-page-search-window search-inactive`
again.

## Development

### Debugging

If you want to see a DevTools of search window, please pass `openDevToolsOfSearchWindow`
property to `searchInPage` function as below.

```javascript
searchInPage(webContents, { openDevToolsOfSearchWindow: true });
```

It opens the DevTools with detach mode.

And this package also supports logging. When `$ELECTRON_IN_PAGE_SEARCH_DEBUG` environment
variable is not empty, it outputs logs with `console.log` in rendrer process.

### TypeScript

This package is written in [TypeScript](https://github.com/Microsoft/TypeScript) and ready for TypeScript.
You need not to prepare type definition file for this package because [index.d.ts](index.d.ts) is
already in this package.

```typescript
import searchInPage, {InPageSearch} from 'electron-in-page-search';

let search: InPageSearch;
const elem = document.createElement('webview');
elem.src = 'https://example.com';

document.getElementById('main').appendChild(elem);
elem.on('dom-ready', () => {
    search = searchInPage(elem);
});

document.getElementById('search-button').addEventListener('click', () => {
    if (search) {
        search.openSearchWindow();
    }
});
```

## Customization

### Use my own CSS for search window

If you want to use a default search window but don't want to use a default CSS,
you can use your own CSS file.

e.g.

```javascript
const path = require('path');

searchInPage(webview, {
    customCssPath: path.join(__dirname, 'my_awesome_styles.css')
});
```

Below is a list of `class` property of each parts in search window.
Please write your CSS styles for below classes.

| class name              | description                 | element   |
|-------------------------|-----------------------------|-----------|
| `inpage-search-body`    | Body of whole search window | `<div>`   |
| `inpage-search-input`   | Query form                  | `<input>` |
| `inpage-search-matches` | 'N/M' search count          | `<div>`   |
| `inpage-search-back`    | 'back' button               | `<div>`   |
| `inpage-search-forward` | 'forward' button            | `<div>`   |
| `inpage-search-close`   | 'close' button              | `<div>`   |

### Use my own HTML for search window

If you want to control the whole search window, you can pass a path to your own HTML file.

```javascript
const path = require('path');

searchInPage(webview, {
    customCssPath: path.join(__dirname, 'my_awesome_styles.css'),
    customSearchWindowHtmlPath: path.join(__dirname, 'my_awesome_search_window.html')
});
```

electron-in-page-search package injects `<script>` tag to setup IPC messaging between
a search window `<webview>` and a renderer process. It finds each elements and
sets listners through class names.

So you need to maintain above class names also in your own search window HTML.

### Lifetime hooks for search

`InPageSearch` instance (returned from `searchInPage`) extends `EventEmitter`.
It emits some events on some timings.
You can hook them to execute your code at some points.

Below is a list of hook names.

| hook name     | description                              | listener args                             |
|---------------|------------------------------------------|-------------------------------------------|
| 'open'        | On window opened                         | `()`                                      |
| 'start'       | On in-page search started                | `(query: string)`                         |
| 'next'        | On finding next match                    | `(query: string, forward: boolean)`       |
| 'focus-input' | On focusing on search window             | `()`                                      |
| 'found'       | On some word matched to the search query | `(activeMatch: number, allMatch: number)` |

### Animation for search window

You can use CSS animation for animation of search window. If you don't want to animate a search window when the webview is mounted, please use `search-firstpaint` class name as below:

```css
.electron-in-page-search-window.search-firstpaint {
  visibility: hidden;
}

.electron-in-page-search-window.search-inactive {
  animation-duration: 0.2s;
  animation-name: yourAwesomeAnimationOnClosing;
}

.electron-in-page-search-window.search-active {
  animation-duration: 0.2s;
  animation-name: yourAwesomeAnimationOnOpening;
}
```

The `search-firstpaint` class will be removed when opening search window at first.
