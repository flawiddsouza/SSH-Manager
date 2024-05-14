module.exports = function(server) {

    const express = require('express')
    const fs = require('fs')
    const SSHClient = require('ssh2').Client
    const { performance } = require('perf_hooks')
    const path = require('path')
    const os = require('os')

    function getAbsolutePath(pathToFile) {
        return path.join(__dirname, pathToFile)
    }

    const app = express()

    app.use(express.json())
    app.use(express.static(getAbsolutePath('public')))

    let servers = JSON.parse(fs.readFileSync(getAbsolutePath('servers.json'), 'utf8'))

    app.get('/servers', (req, res) => {
        servers = JSON.parse(fs.readFileSync(getAbsolutePath('servers.json'), 'utf8')) // refresh servers array

        res.send(
            servers.map((item, index) => {
                const folders = item.folders?.map((folder, folderIndex) => ({ id: folderIndex, folder })) ?? []
                return {
                    id: index,
                    name: item.name,
                    users: item.credentials.map((credential, credentialIndex) => ({ id: credentialIndex, user: credential.username })),
                    folders: [{ id: 'Default Folder', folder: 'Default Folder' }].concat(folders)
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
            serverToConnectTo.credentials[req.params.userId].privateKeyPath,
            req.params.folderId !== 'Default Folder' ? serverToConnectTo.folders[req.params.folderId] : null,
            req.body.termCols,
            req.body.termRows
        )
        res.send('Success')
    })

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

    function createSSHConnection(clientId, host, port, username, password, privateKeyPath=null, folderPath, termCols, termRows) {
        const connectConfig = { host, port, username, password }

        if(privateKeyPath) {
            const homeDirectory = os.homedir()
            if(privateKeyPath.startsWith('~/')) {
                privateKeyPath = path.join(homeDirectory, privateKeyPath.slice(2))
            }
            connectConfig.privateKey = fs.readFileSync(privateKeyPath, 'utf8')
            delete connectConfig.password
        }

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
        .connect(connectConfig)

        sshClients[clientId] = sshClient
    }

    return app
}
