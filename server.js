const express = require('express');
const EventEmitter = require('events');
const crypto = require('crypto');

module.exports.server = function (port, acceptedKeys, loggingFunction) {
    class SemaphoreEmitter extends EventEmitter {};

    const releaseEmitter = new SemaphoreEmitter();

    const runEmitter = new SemaphoreEmitter();

    const SEMAPHORES = {};

    const app = express();

    app.use(express.json());

    app.set('json spaces', 2)

    /******************* logging *******************/

    const logEvents = {
        'client_actions': true,
        'client_usage': true,
        'debug': true
    };

    function logMessage(msg) {
        if( loggingFunction ) {
            loggingFunction( msg );
        }
        console.log(msg);
    }

    function logClientMessage(name, id, actor, action) {
        const msg = `[${name}:${id}:${actor}] ${action}`;
        logMessage(msg);
    }

    function logClientMsg(clientConn, action) {
        logClientMessage(clientConn.semaphoreName, clientConn.uid, clientConn.actor, action);
    }

    function logClientUsage(clientConn, action) {
        if(logEvents['client_usage'] || logEvents['client_actions']) {
            logClientMsg(clientConn, action);
        }
    }

    function logNewClientAction(name, id) {
        if(logEvents['client_actions']) {
            logClientMessage(name, id, 'registrar', 'creating client');
        }
    }

    function logClientAction(clientConn, action) {
        if(logEvents['client_actions']) {
            logClientMsg(clientConn, action);
        }
    }

    function logDebugMessage(msg) {
        if(logEvents['debug']) {
            logMessage(msg);
        }
    }

    /******************* create semaphore client *******************/

    function createClientNode(semaphore, clientId) {
        if( !semaphore.nodes[clientId] ) {
            semaphore.nodes[clientId] = {
                id: clientId,
                monitor: false,
                waiter: false,
                error: null,
                refCount: 0
            };
        }
        return semaphore.nodes[clientId];
    }

    function guaranteeSemaphoreExists(name) {
        let semaphore = SEMAPHORES[name];
        if(!semaphore) {
            SEMAPHORES[name] = {
                nodes: {},
                waiting: [],
                running: null,
                name: name
            }
            semaphore = SEMAPHORES[name];
        }
        return semaphore;
    }

    /******************* verify semaphore client *******************/

    function verifyClientStaging(clientConn) {
        const node = clientConn.semaphore.nodes[clientConn.uid]
        return (!node.monitor || !node.waiter);
    }

    function verifyClientRunning(clientConn) {
        return clientConn.semaphore.running === clientConn.uid;
    }

    function updateClientConn(clientConn) {
        const node = clientConn.node;
        switch(clientConn.actor) {
            case '__monitor':
                node.monitor = true;
                break;
            case '___waiter':
                node.waiter = true;
                break;
            case '_signaler':
                break;
            default:
                logMessage(`THIS SHOULD NEVER HAPPEN: type '${clientConn.actor}' unrecognized.`);
                break;
        }
    }

    function getClientNode(clientConn) {
        const node = clientConn.semaphore.nodes[clientConn.uid]
        logClientAction(clientConn, 'adding client reference')
        node.refCount++;
        return node;
    }

    function releaseClientNode(clientConn) {
        const node = clientConn.node
        node.refCount--;
        if( node.refCount < 1 ) {
            logClientAction(clientConn, 'deleting client');
            delete clientConn.semaphore.nodes[node.id];
        }
    }

    function verifyClient(req, actor) {
        clientConn = {
            status: 401,
            actor: actor,
            semaphoreName: null,
            uid: null,
            semaphore: null,
            node: null
        };

        const apiKey = req.header('x-api-key');
        if( apiKey && acceptedKeys.includes(apiKey)) {
            clientConn.semaphoreName = req.query.name;
            clientConn.uid = req.header('x-client-uuid');
            clientConn.semaphore = SEMAPHORES[clientConn.semaphoreName];
            if( !clientConn.semaphore ) {
                clientConn.status = 404;
            } else if(
                        ( (actor === '__monitor') || (actor === '___waiter') ) &&
                        !verifyClientStaging(clientConn)
                    ) {
                runEmitter.emit(clientConn.uid, 'Requesting client closed connection.');
                clientConn.status = 404;
            } else if( (actor === '_signaler') && !verifyClientRunning(clientConn)) {
                runEmitter.emit(clientConn.uid, 'Requesting client closed connection.');
                clientConn.status = 422;
            } else {
                clientConn.node = getClientNode(clientConn);
                updateClientConn(clientConn);
                clientConn.status = 200;
            }
        }
        return clientConn;
    }

    function releaseClientConn(clientConn) {
        logClientAction(clientConn, 'removing client reference');
        releaseClientNode(clientConn);
    }

    /******************* manage semaphore client state *******************/

    function stageClient( clientConn ) {
        const semaphore = clientConn.semaphore;
        const node = clientConn.node;

        if( node.monitor && node.waiter ) {
            logClientUsage(clientConn, 'waiting for semaphore');
            semaphore.waiting.push(node.id);
        }
    }

    function promoteIfPossible(clientConn) {
        const semaphore = clientConn.semaphore;
        if( ( semaphore.running === null ) && ( semaphore.waiting.length > 0 ) ) {
            semaphore.running = semaphore.waiting.shift();
            runEmitter.emit(semaphore.running, 'RUNNING');
        }
    }

    function removeClientIfRunning(clientConn) {
        if( clientConn.semaphore.running === clientConn.uid ) {
            clientConn.semaphore.running = null;
            return true;
        }
        return false;
    }

    function removeClientIfWaiting(clientConn) {
        const idx = clientConn.semaphore.waiting.findIndex((id) => {
            return (id === clientConn.uid);
        });
        if( idx > -1 ) {
            return clientConn.semaphore.waiting.splice( idx, 1);
        }
        return null;
    }

    function removeClient(clientConn) {
        let found;
        if( !clientConn.semaphore ) {
            found = false;
        } else if( removeClientIfRunning( clientConn ) || removeClientIfWaiting( clientConn ) ) {
            found = true;
        }
        runEmitter.emit(clientConn.uid, 'Requesting client closed connection.');
        releaseEmitter.emit(clientConn.uid, 'Requesting client closed connection.');
        return found;
    }

    /******************* semaphore end points *******************/

    // register semaphore
    app.get('/semaphore/register/', (req, res) => {
        const apiKey = req.header('x-api-key');
        if( !apiKey || !acceptedKeys.includes(apiKey)) {
            res.status(401);
            res.end();
            return;
        }

        const semaphoreName = req.query.name;
        const client_uid = crypto.randomUUID();

        logNewClientAction(semaphoreName, client_uid);

        const semaphore = guaranteeSemaphoreExists(semaphoreName);
        createClientNode(semaphore, client_uid);

        res.send(client_uid);
        return;
    });

    // monitor semaphore
    app.get('/semaphore/monitor/', async (req, res) => {

        const clientConn = verifyClient(req, '__monitor');
        if( clientConn.status !== 200 ) {
            res.status(clientConn.status);
            res.end();
            return;
        }

        req.on('close', () => {
            removeClient(clientConn);
            promoteIfPossible(clientConn);
        });

        logClientAction(clientConn, 'starting monitor');
        const result = await new Promise((resolve, reject) => {
            releaseEmitter.on(clientConn.uid, (action) => {
                resolve(action);
            });
            stageClient( clientConn );
            promoteIfPossible( clientConn );
        });

        if(result === 'RELEASING') {
            logClientAction(clientConn, 'stopping monitor');
            res.status(200);
        } else {
            logClientUsage(clientConn, `stopping monitor after error: ${result}`);
            res.statusMessage = result;
            res.status(500);
        }
        res.end();
        releaseClientConn(clientConn);
        return;
    });

    // wait for semaphore
    app.get('/semaphore/wait/', async (req, res) => {
        const clientConn = verifyClient(req, '___waiter');
        if( clientConn.status !== 200 ) {
            res.status(clientConn.status);
            res.end();
            return;
        }

        const result = await new Promise((resolve, reject) => {
            runEmitter.on(clientConn.uid, (action) => {
                resolve(action);
            });
            stageClient( clientConn );
            promoteIfPossible(clientConn);
        });

        if(result === 'RUNNING') {
            logClientUsage(clientConn, 'holding the semaphore');
            res.status(200);
        } else {
            logClientUsage(clientConn, `encountered error: ${result}`);
            res.statusMessage = result;
            res.status(500);
        }

        res.status(result === 'RUNNING' ? 200: 500);
        res.end();
        releaseClientConn(clientConn);
    });

    // signal semaphore
    app.get('/semaphore/signal/', async (req, res) => {
        const clientConn = verifyClient(req, '_signaler');
        if( clientConn.status !== 200 ) {
            res.status(clientConn.status);
            res.end();
            return;
        }

        clientConn.semaphore.running = null;
        logClientUsage(clientConn, 'releasing the semaphore');
        releaseEmitter.emit(clientConn.uid, 'RELEASING');
        promoteIfPossible(clientConn);
        res.status(200);
        res.end();
        releaseClientConn(clientConn);
    });

    // observe semaphore
    app.get('/semaphore/observe/', async (req, res) => {
        const apiKey = req.header('x-api-key');
        if( !apiKey || !acceptedKeys.includes(apiKey)) {
            res.status(401);
            res.end();
            return;
        }

        const str = JSON.stringify(SEMAPHORES[req.query.name], null, 4);

        logDebugMessage(str);

        res.send(str);
    });


    app.listen(port, () => logMessage(`The server is listening on port ${port}`));
}
