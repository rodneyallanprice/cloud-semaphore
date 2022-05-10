let loggingFunction = null;

/******************* logging *******************/

const logEvents = {
    'server': {
        'info': false,
        'alert': true,
        'sem_events': false,
        'sem_transition': false,
        'debug': false,
    },
    'client': {
        'network_status': false,
        'network_errors': true,
        'usage': false
    },
    'test': {
        'harness_info': false,
        'info': false,
        'flaw': true,
        'results': true,
        'summary': true
    }
};

module.exports.setLoggingCallback = function(callback) {
    loggingFunction = callback;
}

function updateLogEvents(component, event, value) {
    logEvents[component][event] = value;
}

module.exports.enableLogEvent = function(component, event) {
    updateLogEvents(component, event, true);
}

module.exports.disableLogEvent = function(component, event) {
    updateLogEvents(component, event, false);
}

function message(who, what) {
    if( loggingFunction ) {
        loggingFunction( what );
    }
    console.log(`${who}: ${what}`);
}

function clientMessage(name, id, actor, action) {
    const msg = `[${name}:${id}:${actor}] ${action}`;
    message('server', msg);
}

function clientMsg(clientConn, action) {
    clientMessage(clientConn.semaphoreName, clientConn.uid, clientConn.actor, action);
}

module.exports.semTransition = function(clientConn, action) {
    if(logEvents['server']['sem_transition'] || logEvents['server']['sem_events']) {
        clientMsg(clientConn, action);
    }
}

module.exports.semDebugEvent = function(clientConn, action) {
    if(logEvents['server']['sem_events']) {
        clientMsg(clientConn, action);
    }
}

module.exports.serverInfo = function (msg) {
    if(logEvents['server']['info']) {
        message('server', msg);
    }
}

module.exports.serverAlert = function (msg) {
    if(logEvents['server']['alert']) {
        message('server', msg);
    }
}

module.exports.networkStatus = function(name, id, actor, action) {
    if(logEvents['client']['network_status']) {
        message('client', `[${name}:${id}:${actor}] ${action}`);
    }
}

module.exports.networkError = function(name, key, actor, action) {
    if(logEvents['client']['network_errors']) {
        message('client', `[${name}:${key}:${actor}] ${action}`);
    }
}

module.exports.testHarnessInfo = function(info) {
    if(logEvents['test']['harness_info']) {
        message('test  ', info);
    }
}

module.exports.testInfo = function(info) {
    if(logEvents['test']['info']) {
        message('test  ', info);
    }
}

module.exports.testFlaw = function(name, error) {
    if(logEvents['test']['flaw']) {
        message('test  ', `Test ${name} failed to complete with error: ${error}`);
    }
}

module.exports.testSuccess = function(name) {
    if(logEvents['test']['results']) {
        message('test  ', `success: ${name}`);
    }
}

module.exports.testFailure = function(name, error) {
    if(logEvents['test']['results']) {
        message('test  ', `failure: ${name} - ${error}`);
    }
}

module.exports.testSummary = function(summary) {
    if(logEvents['test']['summary']) {
        message('test  ', summary);
    }
}