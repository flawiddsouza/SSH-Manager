let connectStatusSpan = document.getElementById('connection-status')
let connectForm = document.getElementById('connect-form')
let serversSelect = document.getElementById('servers-select')
let usersSelect = document.getElementById('users-select')
let foldersSelect = document.getElementById('folders-select')
let terminalContainer = document.getElementById('terminal-container')

import * as DomHelpers from './Libs/DomHelpers'

let serversCopy = []

function fetchServers() {
    fetch('/servers').then(response => response.json()).then(servers => {
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

import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'

let term = new Terminal({
    cursorBlink: true,
    fontFamily: '"Cascadia Mono", "Ubuntu Mono", monospace'
})

const fitAddon = new FitAddon()
term.loadAddon(fitAddon)

term.open(terminalContainer)

fitAddon.fit()

window.clientId = null

let socket = io.connect()
socket.on('connect', () => {
    connectStatusSpan.innerHTML = 'Connected'

    term.onData(data => {
        socket.emit('data', data)
    })

    socket.once('clientId', clientId => {
        window.clientId = clientId
    })

    socket.on('data', data => {
        term.write(data)
    })

    socket.on('disconnect', () => {
        connectStatusSpan.innerHTML = 'Disconnected'
    })
})

fetchServers()

connectForm.addEventListener('submit', e => {
    e.preventDefault()

    term.reset()

    fetch(`/connect-server/${window.clientId}/${serversSelect.value}/${usersSelect.value}/${foldersSelect.value}`, {
        method: 'POST'
    }).then(() => {
        term.focus()
    })
})
