import {ipcRenderer as ipc} from 'electron';

const search_button = document.querySelector('.inpage-search-button') as HTMLButtonElement;
const matches = document.querySelector('.inpage-search-matches') as HTMLDivElement;
const back_button = document.querySelector('.inpage-search-back') as HTMLButtonElement;
const forward_button = document.querySelector('.inpage-search-forward') as HTMLButtonElement;
const close_button = document.querySelector('.inpage-search-close') as HTMLButtonElement;
const search_input = document.querySelector('.inpage-search-input') as HTMLInputElement;

let in_composition = false;

if (search_button !== null) {
    search_button.addEventListener('click', () => {
        const input = search_input.value;
        if (input === '') {
            return;
        }
        ipc.sendToHost('electron-in-page-search:query', input);
    });
}

if (back_button !== null) {
    back_button.addEventListener('click', () => {
        ipc.sendToHost('electron-in-page-search:back', search_input.value);
    });
}

if (forward_button !== null) {
    forward_button.addEventListener('click', () => {
        ipc.sendToHost('electron-in-page-search:forward', search_input.value);
    });
}

close_button.addEventListener('click', () => {
    ipc.sendToHost('electron-in-page-search:close');
});

search_input.addEventListener('keydown', e => {
    if (in_composition) {
        return;
    }
    switch (e.code) {
    case 'Enter':
        ipc.sendToHost('electron-in-page-search:query', search_input.value);
        break;
    case 'Escape':
        ipc.sendToHost('electron-in-page-search:close');
        break;
    case 'KeyG':
        if (e.ctrlKey) {
            ipc.sendToHost('electron-in-page-search:close');
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

ipc.on('electron-in-page-search:focus', () => {
    search_input.focus();
});

ipc.on('electron-in-page-search:result', (_: any, nth: number, all: number) => {
    matches.innerText = `${nth}/${all}`;
});

ipc.on('electron-in-page-search:close', () => {
    search_input.value = '';
    matches.innerText = '0/0';
});
