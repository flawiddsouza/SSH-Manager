let connectStatusSpan = document.getElementById('connection-status')
let connectForm = document.getElementById('connect-form')
let serversSelect = document.getElementById('servers-select')
let usersSelect = document.getElementById('users-select')
let foldersSelect = document.getElementById('folders-select')
let terminalContainer = document.getElementById('terminal-container')
let terminalSearchInput = document.getElementById('terminal-search')

import * as DomHelpers from './Libs/DomHelpers'

let serversCopy = []

function fetchServers() {
    fetch('servers').then(response => response.json()).then(servers => {
        serversCopy = servers
        DomHelpers.fillSelectOptionsFromArray(serversSelect, servers, 'name', 'id')
        serversSelectChangeHandler()
    })
}

function serversSelectChangeHandler() {
    let selectedServer = serversCopy.find(item => item.id == serversSelect.value)
    DomHelpers.fillSelectOptionsFromArray(usersSelect, selectedServer.users, 'user', 'id')
    DomHelpers.fillSelectOptionsFromArray(foldersSelect, selectedServer.folders, 'folder', 'id')
}

serversSelect.addEventListener('change', serversSelectChangeHandler)

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { SearchAddon } from '@xterm/addon-search'
import { WebglAddon } from '@xterm/addon-webgl'

let term = new Terminal({
    cursorBlink: true,
    fontFamily: '"Cascadia Mono", "Ubuntu Mono", monospace',
    scrollback: 9999999
})

const fitAddon = new FitAddon()
term.loadAddon(fitAddon)

const weblglAddon = new WebglAddon()
weblglAddon.onContextLoss(() => {
    weblglAddon.dispose()
})
term.loadAddon(weblglAddon)

const searchAddon = new SearchAddon()
term.loadAddon(searchAddon)

term.open(terminalContainer)

fitAddon.fit()

window.addEventListener('resize', resizeScreen, false)

function resizeScreen () {
    fitAddon.fit()
    socket.emit('resize', { cols: term.cols, rows: term.rows })
}

window.clientId = null

let socket = io.connect({ transports: ['websocket'] })
socket.on('connect', () => {
    connectStatusSpan.innerHTML = 'Connected'

    term.onData(data => {
        socket.emit('data', data)
    })

    socket.once('clientId', clientId => {
        window.clientId = clientId
    })

    socket.on('data', data => {
        term.write(new Uint8Array(data))
    })

    socket.on('disconnect', () => {
        connectStatusSpan.innerHTML = 'Disconnected'
    })
})

fetchServers()

connectForm.addEventListener('submit', e => {
    e.preventDefault()

    term.reset()

    fetch(`connect-server/${window.clientId}/${serversSelect.value}/${usersSelect.value}/${foldersSelect.value}`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            termCols: term.cols,
            termRows: term.rows
        })
    }).then(() => {
        term.focus()
    })
})

terminalSearchInput.addEventListener('keydown', e => {
    if(e.shiftKey && e.key === 'Enter') {
        searchAddon.findPrevious(e.target.value)
        return
    }

    if(e.key === 'Enter') {
        searchAddon.findNext(e.target.value)
    }
})
