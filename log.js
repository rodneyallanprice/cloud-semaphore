let loggingFunction = null;

/******************* logging *******************/

const logEvents = {
    'server': {
        'info': true,
        'alert': true,
        'sem_events': false,
        'sem_transition': false,
        'debug': false,
    },
    'client': {
        'network_status': false,
        'network_errors': true,
        'usage_errors': false
    },
    'test': {
        'harness_info': false,
        'info': false,
        'flaw': true,
        'results': true,
        'summary': true
    }
};

exports.setLoggingCallback = function(callback) {
    loggingFunction = callback;
}

function eventKnown(component, event) {
    return Object.prototype.hasOwnProperty.call(logEvents, component) &&
        Object.prototype.hasOwnProperty.call(logEvents[component], event);
}

function updateLogEvents(component, event, value) {
    logEvents[component][event] = value;
    return logEvents;
}

exports.enableEvent = function(component, event) {
    if(!eventKnown(component, event )) {
        return null;
    }
    return updateLogEvents(component, event, true);
}

exports.disableEvent = function(component, event) {
    if(!eventKnown(component, event )) {
        return null;
    }
    return updateLogEvents(component, event, false);
}

function deepUpdate(current, updates) {
    for( let key of Object.keys(updates) ) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) {
            return null;
        }
        if (typeof updates[key] !== 'object') {
            current[key] = updates[key];
        } else if (!deepUpdate(current[key], updates[key])) {
            return null;
        }
    }
    return current;
}

exports.patchEventConfig = function(modifications) {
    return deepUpdate(logEvents, modifications);
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

exports.semTransition = function(clientConn, action) {
    if(logEvents['server']['sem_transition'] || logEvents['server']['sem_events']) {
        clientMsg(clientConn, action);
    }
}

exports.semDebugEvent = function(clientConn, action) {
    if(logEvents['server']['sem_events']) {
        clientMsg(clientConn, action);
    }
}

exports.serverInfo = function (msg) {
    if(logEvents['server']['info']) {
        message('server', msg);
    }
}

exports.serverAlert = function (msg) {
    if(logEvents['server']['alert']) {
        message('server', msg);
    }
}

exports.networkStatus = function(name, id, actor, action) {
    if(logEvents['client']['network_status']) {
        message('client', `[${name}:${id}:${actor}] ${action}`);
    }
}

exports.networkError = function(actor, action) {
    if(logEvents['client']['network_errors']) {
        message('client', `[${actor}] ${action}`);
    }
}

exports.usageError = function(actor, action) {
    if(logEvents['client']['usage_errors']) {
        message('client', `[${actor}] ${action}`);
    }
}

exports.testHarnessInfo = function(info) {
    if(logEvents['test']['harness_info']) {
        message('test  ', info);
    }
}

exports.testInfo = function(info) {
    if(logEvents['test']['info']) {
        message('test  ', info);
    }
}

exports.testFlaw = function(name, error) {
    if(logEvents['test']['flaw']) {
        message('test  ', `Test ${name} failed to complete with error: ${error}`);
    }
}

exports.testSuccess = function(name) {
    if(logEvents['test']['results']) {
        message('test  ', `success: ${name}`);
    }
}

exports.testFailure = function(name, error) {
    if(logEvents['test']['results']) {
        message('test  ', `failure: ${name} - ${error}`);
    }
}

exports.testSummary = function(summary) {
    if(logEvents['test']['summary']) {
        message('test  ', summary);
    }
}