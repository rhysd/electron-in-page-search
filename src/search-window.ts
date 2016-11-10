import {ipcRenderer as ipc} from 'electron';

const search_button = document.querySelector('.inpage-search-button') as HTMLButtonElement;
const matches = document.querySelector('.inpage-search-matches') as HTMLDivElement;
const back_button = document.querySelector('.inpage-search-back') as HTMLButtonElement;
const forward_button = document.querySelector('.inpage-search-forward') as HTMLButtonElement;
const close_button = document.querySelector('.inpage-search-close') as HTMLButtonElement;
const search_input = document.querySelector('.inpage-search-input') as HTMLInputElement;

let in_composition = false;

search_button.addEventListener('click', () => {
    const input = search_input.value;
    if (input === '') {
        return;
    }
    ipc.sendToHost('electron-page-in-search:query', input);
});

back_button.addEventListener('click', () => {
    ipc.sendToHost('electron-page-in-search:back');
});

forward_button.addEventListener('click', () => {
    ipc.sendToHost('electron-page-in-search:forward');
});

close_button.addEventListener('click', () => {
    ipc.sendToHost('electron-page-in-search:close');
});

search_input.addEventListener('keydown', e => {
    if (in_composition) {
        return;
    }
    switch(e.code) {
    case 'Enter':
        ipc.sendToHost('electron-page-in-search:query', search_input.value);
        break;
    case 'Escape':
        ipc.sendToHost('electron-page-in-search:close');
        break;
    case 'KeyG':
        if (e.ctrlKey) {
            ipc.sendToHost('electron-page-in-search:close');
        }
        break;
    default:
        break;
    }
});
search_input.addEventListener('compositionstart', () => {
    in_composition = true;
});
search_input.addEventListener('compositionend', () => {
    in_composition = false;
});

ipc.on('electron-page-in-search:focus', () => {
    search_input.focus();
});

ipc.on('electron-page-in-search:result', (_: any, nth: number, all: number) => {
    matches.innerText = `${nth}/${all}`;
});

