const http = require('http')
const express = require('express')

const app = express()
const server = http.createServer(app)
const serverPort = 9999

app.use(require('./app')(server))

server.listen(serverPort)
