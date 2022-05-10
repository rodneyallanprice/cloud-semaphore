const axios = require('axios');
const log = require('./log.js');

let SEMAPHORE_HOST='http://localhost:3202';

module.exports.init = function(semaphoreHost) {
    SEMAPHORE_HOST = semaphoreHost;
};

module.exports.WaitOnSemaphore = async function(name) {
    const sem = {
        name: name
    };
    sem.start = Date.now();

    let registrationResponse;
    try {
        registrationResponse = await axios.get(`${SEMAPHORE_HOST}/semaphore/register?name=${name}`, {'headers': {'x-api-key': 'pdq'}});
    } catch (error) {
        return null;
    }

    sem.cancelHandle = axios.CancelToken.source();

    axios.get(`${SEMAPHORE_HOST}/semaphore/monitor?name=${name}`,
        {
            'headers': {
                'x-api-key': 'pdq',
                'x-client-uuid': registrationResponse.data
            },
            cancelToken: sem.cancelHandle.token
        }
    )
    .then((response) => {
        log.networkStatus(name, registrationResponse.data, '__monitor', 'Monitor returned: ${response.status}')
    })
    .catch((error) => {
        log.networkError(name, registrationResponse.data, '__monitor', `encountered: ${error}`)
    });

    let response = null;
    try {
        response = await axios.get(`${SEMAPHORE_HOST}/semaphore/wait?name=${name}`,
            {
                'headers': {
                    'x-api-key': 'pdq',
                    'x-client-uuid': registrationResponse.data
                }
            }
        );
    } catch(error) {
        log.networkError(name, registrationResponse.data, '___waiter', `Encountered ${error} waiting for sempaphore ${sem.name}`)
    }

    if( response ) {
        sem.granted = Date.now()
        log.networkStatus(name, registrationResponse.data, '___waiter', `Received ${response.status} after waiting ${sem.granted - sem.start} ms.`);
        sem.id = registrationResponse.data;
        return sem;
    }
    return null;
}

module.exports.SignalSemaphore = async function(sem) {
    sem.released = Date.now();
    let releaseResponse;
    try {
        releaseResponse = await axios.get(`${SEMAPHORE_HOST}/semaphore/signal?name=${sem.name}`,
            {
                'headers': {
                    'x-api-key': 'pdq',
                    'x-client-uuid': sem.id
                }
            }
        );
    } catch (error) {
        log.networkError(sem.name, sem.id, '_signaler', `Encountered ${error} signaling sempaphore ${sem.name}`);
        return null;
    }
    log.networkStatus(sem.name, sem.id, '_signaler', `Semaphore ${sem.name} waited: ${sem.granted - sem.start} held: ${sem.released - sem.granted}`);
    return releaseResponse;
}

module.exports.ObserveSemaphore = async function(name) {
    let releaseResponse;
    try {
        releaseResponse = await axios.get(`${SEMAPHORE_HOST}/semaphore/observe?name=${name}`,
            {
                'headers': {
                    'x-api-key': 'pdq'
                }
            }
        );
    } catch (error) {
        log.networkError(name, '                 na                 ', '_observer', `Encountered ${error} observing sempaphore ${name}`);
        return null;
    }
    log.networkStatus(name, '                 na                 ', '_observer',
    `Observe response: ${releaseResponse.status}\n        ${JSON.stringify(releaseResponse.data)}`);
    return releaseResponse.data;
}

async function updateEventConfig(component, event, value) {
    let response;
    const body = {};
    body[component] = {};
    body[component][event] = value;
    const args = {
        'headers': {
            'x-api-key': 'pdq'
        }
    }
    try {
        response = await axios.patch(`${SEMAPHORE_HOST}/semaphore/logconfig`, body, args);
    } catch (error) {
        log.networkError('na    ', 'na                                  ', '__updater', `Encountered ${error} updating log config`);
        return null;
    }
    log.networkStatus('na    ', 'na                                  ', '__updater',
    `log config response: ${response.status}\n        ${JSON.stringify(response.data)}`);
    return response.data;
}

module.exports.disableLogEvent = async function(component, event) {
    if(component != 'server') {
        return Promise.resolve(log.disableEvent(component, event));
    }
    return await updateEventConfig(component, event, false);
}

module.exports.enableLogEvent = async function(component, event) {
    if(component != 'server') {
        return Promise.resolve(log.enableEvent(component, event));
    }
    return await updateEventConfig(component, event, true);
}