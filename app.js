const express = require('express')
const fs = require('fs')
const http = require('http')
const SSHClient = require('ssh2').Client
const { performance } = require('perf_hooks')

const app = express()
const serverPort = 9999
const server = http.createServer(app)

app.use(express.json())
app.use(express.static('public'))

app.get('/', (req, res) => {
    res.render('index')
})

let servers = JSON.parse(fs.readFileSync('./servers.json', 'utf8'))

app.get('/servers', (req, res) => {
    res.send(
        servers.map((item, index) => {
            return {
                id: index,
                name: item.name,
                users: item.credentials.map((credential, credentialIndex) => ({ id: credentialIndex, user: credential.username })),
                folders: [{ id: 'Default Folder', folder: 'Default Folder' }].concat(item.folders.map((folder, folderIndex) => ({ id: folderIndex, folder })))
            }
        })
    )
})

app.post('/connect-server/:clientId/:id/:userId/:folderId', (req, res) => {
    let serverToConnectTo = servers[req.params.id]

    if(req.params.clientId in sshClients) {
        clients[req.params.clientId].removeAllListeners('data') // remove `data` event listener that was added during the preview createSSHConnection
        sshClients[req.params.clientId].end()
    }

    createSSHConnection(
        req.params.clientId,
        serverToConnectTo.host,
        serverToConnectTo.port,
        serverToConnectTo.credentials[req.params.userId].username,
        serverToConnectTo.credentials[req.params.userId].password,
        null,
        req.params.folderId !== 'Default Folder' ? serverToConnectTo.folders[req.params.folderId] : null,
        req.body.termCols,
        req.body.termRows
    )
    res.send('Success')
})

server.listen(serverPort)

const io = require('socket.io')(server, {
    transports: ['websocket']
})

let clients = {}
let sshClients = {}

io.on('connection', client => {
    let clientId = generateUUID()
    clients[clientId] = client
    client.emit('clientId', clientId)
})

// from https://stackoverflow.com/a/8809472/4932305
function generateUUID() {
    var d = new Date().getTime()
    var d2 = (performance && performance.now && (performance.now()*1000)) || 0
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16
        if(d > 0){
            r = (d + r)%16 | 0
            d = Math.floor(d/16)
        } else {
            r = (d2 + r)%16 | 0
            d2 = Math.floor(d2/16)
        }
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
    })
}

function createSSHConnection(clientId, host, port, username, password, privateKey=null, folderPath, termCols, termRows) {
    let sshClient = new SSHClient()
    sshClient
    .on('ready', () => {
        clients[clientId].emit('data', '\r\n*** SSH CONNECTION ESTABLISHED ***\r\n')
        sshClient.shell({
            term: 'xterm',
            cols: termCols,
            rows: termRows
        }, (err, stream) => {
            if(err) {
                return clients[clientId].emit('data', '\r\n*** SSH SHELL ERROR: ' + err.message + ' ***\r\n')
            }

            if(folderPath) {
                stream.write(`cd ${folderPath}\n`)
            }

            clients[clientId].on('data', data => {
                stream.write(data)
            })

            clients[clientId].on('resize', data => {
                stream.setWindow(data.rows, data.cols)
            })

            stream.on('data', data => {
                clients[clientId].emit('data', data)
            })

            stream.on('end', () => {
                clients[clientId].removeAllListeners('data')
                sshClient.end()
            })
        })
    })
    .on('close', () => {
        clients[clientId].emit('data', '\r\n*** SSH CONNECTION CLOSED ***\r\n')
    })
    .on('error', err => {
        clients[clientId].emit('data', '\r\n*** SSH CONNECTION ERROR: ' + err.message + ' ***\r\n')
    })
    .connect({ host, port, username, password, privateKey })

    sshClients[clientId] = sshClient
}
