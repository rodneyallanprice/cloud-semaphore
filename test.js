require('dotenv').config()
const server = require('./server');
const log = require('./log.js');
const {
    init,
    waitOnSemaphore,
    signalSemaphore,
    observeSemaphore,
    disableLogEvent,
    enableLogEvent
} = require('./client');

const SERVER_PORT = process.env.PORT || 3202;
const SERVER_API_KEYS = ['pdq', 'xyz'];

async function singleUser() {
    const sem = await waitOnSemaphore(`TEST_SEM`);
    await signalSemaphore(sem);
    return {
        'sem': sem
    };
}

async function validateSingleUser( clientResult, test ) {
    return validateSemaphoreUsage(clientResult.sem, 'user1')
    .then(() => {
        return validateSemaphoresClean(clientResult, test);
    });
}

async function twoUsersWithDelay() {
    const clientResult = {};
    const user1 = await waitOnSemaphore(`TEST_SEM`);
    clientResult.user1 = user1;
    log.testInfo(`user1 holds ${user1.name}`);
    return await new Promise((resolve) => {
        waitOnSemaphore('TEST_SEM')
        .then((user2) => {
            clientResult.user2 = user2;
            log.testInfo(`user2 holds ${user2.name}`);
            log.testInfo(`user2 signals ${user2.name}`);
            signalSemaphore(user2)
            .then(() => {
                resolve(clientResult);
            });
        });
        setTimeout(() => {
            log.testInfo(`user1 signals ${user1.name}`);
            signalSemaphore(user1)
        }, 1000)
    });
}

function validateTwoUsersWithDelay( clientResult, test ) {
    return validateSemaphoreUsage(clientResult.user1, 'user1')
    .then(() => {
        return validateSemaphoreUsage(clientResult.user2, 'user2');
    })
    .then(() => {
        return validateSemaphoresClean(clientResult, test);
    });
}

async function twoUsersWithCrash() {
    const clientResult = {};
    const user1 = await waitOnSemaphore(`TEST_SEM`);
    clientResult.user1 = user1;
    log.testInfo(`user1 holds ${user1.name}`);
    return await new Promise((resolve) => {
        waitOnSemaphore('TEST_SEM')
        .then((user2) => {
            clientResult.user2 = user2;
            log.testInfo(`user2 holds ${user2.name}`);
            log.testInfo(`user2 signals ${user2.name}`);
            signalSemaphore(user2)
            .then(() => {
                resolve(clientResult);
            });
        });
        setTimeout(() => {
            // simulate a crash by closing the monitor connection
            log.testInfo(`simulating crash while user1 holds ${user1.name}`);
            user1.cancelHandle.cancel();
        }, 3000)
    });
}

function validateTwoUsersWithCrash( clientResult, test ) {
    return validateSemaphoreCrashedOwner(clientResult.user1, 'user1')
    .then(() => {
        return validateSemaphoreUsage(clientResult.user2, 'user2');
    })
    .then(() => {
        return validateSemaphoresClean(clientResult, test);
    });
}

async function multipleUsers(count, delay) {
    const clientResult = {};
    const user1 = await waitOnSemaphore(`TEST_SEM`);
    clientResult.user1 = user1;
    log.testInfo(`user1 holds ${user1.name}`);
    const waiters = [];
    for( let idx = 0; idx < count; idx++ ) {
        let Sem;
        waiters.push(
            waitOnSemaphore('TEST_SEM')
            .then((sem) => {
                Sem = sem;
                return signalSemaphore(sem);
            })
            .then(() => {
                return Sem;
            })
        );
    }
    setTimeout(() => {
        log.testInfo(`user1 signals ${user1.name}`);
        signalSemaphore(user1)
    }, delay)

    const results = await Promise.all(waiters);
    clientResult.users = results;
    return clientResult;
}

function validateMultipleUsers( clientResult, test ) {
    return validateSemaphoreUsage(clientResult.user1, 'user1')
    .then(() => {
        return validateMultipleSemaphoreUsage(clientResult.users, 'user');
    })
    .then(() => {
        return validateSemaphoresClean(clientResult, test);
    });
}

async function fiveHundredUsersWithDelay() {
    return multipleUsers(500, 1000);
}

async function waitOnSemaphoreCanNotReachServer(test) {
    const clientResult = {}
    await stopListener(test.server);
    delete test.server;
    const sem = await waitOnSemaphore('TEST_SEM');
    clientResult.sem = sem;
    return clientResult
}

// eslint-disable-next-line no-unused-vars
function validateWaitOnSemaphoreCanNotReachServer(clientResult, _test) {
    return new Promise((resolve) => {
        if( clientResult.sem ) {
            throw new Error('waitOnSemaphore returned a non null semaphore when the server could not be reached.');
        }
        resolve();
    });
}

async function signalSemaphoreCanNotReachServer(test) {
    const clientResult = {}
    const sem = await waitOnSemaphore('TEST_SEM');
    clientResult.sem = sem;
    sem.cancelHandle.cancel();
    await stopListener(test.server);
    delete test.server;
    clientResult.result = await signalSemaphore(sem);
    return clientResult;
}

// eslint-disable-next-line no-unused-vars
function validateSignalSemaphoreCanNotReachServer(clientResult, _test) {
    return new Promise((resolve) => {
        if( clientResult.result ) {
            throw new Error('signalSemaphore returned a non null semaphore when the server could not be reached.');
        }
        resolve();
    });
}

async function observeSemaphoreCanNotReachServer(test) {
    const clientResult = {}
    await stopListener(test.server);
    delete test.server;
    const semData = await observeSemaphore('TEST_SEM');
    clientResult.semData = semData;
    return clientResult
}

// eslint-disable-next-line no-unused-vars
function validateObserveSemaphoreCanNotReachServer(clientResult, _test) {
    return new Promise((resolve) => {
        if( clientResult.semData ) {
            throw new Error('observeSemaphore returned a non null response when the server could not be reached.');
        }
        resolve();
    });
}

// eslint-disable-next-line no-unused-vars
async function endPointsRequireApiKey(_test) {
    const clientResult = {}
    clientResult.sem = await waitOnSemaphore('TEST_SEM');
    await clientResult.sem.cancelHandle.cancel();
    init('localhost', SERVER_PORT, false, 'bogus');
    clientResult.signal = await signalSemaphore(clientResult.sem);

    clientResult.wait = await waitOnSemaphore('TEST_SEM');
    clientResult.observe = await observeSemaphore('TEST_SEM');
    clientResult.logevent = await disableLogEvent('server', 'info');
    // restore test defaults
    init('localhost', SERVER_PORT, false, SERVER_API_KEYS[0]);
    return clientResult
}

// eslint-disable-next-line no-unused-vars
function validateEndPointsRequireApiKey(clientResult, _test) {
    return new Promise((resolve) => {
        if( clientResult.signal ) {
            throw new Error('signalSemaphore returned a non-null response when a valid api_key was not used.');
        }
        if( clientResult.wait ) {
            throw new Error('waitOnSemaphore returned a non-null response when a valid api_key was not used.');
        }
        if( clientResult.observe ) {
            throw new Error('observeSemaphore returned a non-null response when a valid api_key was not used.');
        }
        if( clientResult.logevent ) {
            throw new Error('disableLogEvent returned a non-null response when a valid api_key was not used.');
        }
        resolve();
    });
}

function clone(a) {
    return JSON.parse(JSON.stringify(a));
 }
// eslint-disable-next-line no-unused-vars
async function changeLogConfig(_test) {
    const clientResult = {}
    clientResult.config1 = clone(await enableLogEvent('server', 'info'));
    clientResult.config2 = clone(await disableLogEvent('server', 'info'));
    clientResult.config3 = clone(await enableLogEvent('client', 'network_errors'));
    clientResult.config4 = clone(await disableLogEvent('client', 'network_errors'));

    return clientResult;
}

// eslint-disable-next-line no-unused-vars
function validateChangeLogConfig(clientResult, _test) {
    return new Promise((resolve) => {
        if( clientResult.config1 == clientResult.config2 ) {
            throw new Error('disableLogEvent() did not change the server log configuration');
        }
        if( clientResult.config1['server']['info'] != true ) {
            throw new Error("enableLogEvent() did not change logEvent['server']['info'] to true.");
        }
        if( clientResult.config2['server']['info'] != false ) {
            throw new Error("disableLogEvent() did not change logEvent['server']['info'] to false.");
        }
        if( clientResult.config3 == clientResult.config4 ) {
            throw new Error('disableLogEvent() did not change the client log configuration');
        }
        if( clientResult.config3['client']['network_errors'] != true ) {
            throw new Error("enableLogEvent() did not change logEvent['client']['network_errors'] to true.");
        }
        if( clientResult.config4['client']['network_errors'] != false ) {
            throw new Error("disableLogEvent() did not change logEvent['client']['network_errors'] to false.");
        }
        resolve();
    });
}

// eslint-disable-next-line no-unused-vars
async function checkLogConfig(_test) {
    const clientResult = {}
    clientResult.config1 = clone(await enableLogEvent('server', 'bogus'));
    clientResult.config2 = clone(await disableLogEvent('bogus', 'info'));
    clientResult.config3 = clone(await enableLogEvent('client', 'bogus'));

    return clientResult;
}

// eslint-disable-next-line no-unused-vars
function validateCheckLogConfig(clientResult, _test) {
    return new Promise((resolve) => {
        if( clientResult.config1 ) {
            throw new Error("enableLogEvent() created a log config event that does not exist.");
        }
        if( clientResult.config2 ) {
            throw new Error("enableLogEvent() created a log config event that does not exist.");
        }
        if( clientResult.config3 ) {
            throw new Error("enableLogEvent() created a log config event that does not exist.");
        }
        resolve();
    });
}

function validateSemaphoreClean(sem) {
    return new Promise((resolve) => {
        if( Object.keys(sem.nodes).length > 0 ) {
            throw new Error(`Semaphore ${sem.name} has leftover nodes`);
        }
        if(sem.waiting.length > 0) {
            throw new Error(`Semaphore ${sem.name} has leftover waiters`);
        }
        if(sem.running) {
            throw new Error(`Semaphore ${sem.name} is still held`);
        }
        resolve();
    });
}

function validateSemaphoreUsage(sem, owner) {
    return new Promise((resolve) => {
        if(!sem.granted ) {
            throw new Error(`Semaphore ${sem.name} was never granted to ${owner}`);
        }
        if(!sem.released ) {
            throw new Error(`Semaphore ${sem.name} was never released by ${owner}`);
        }
        resolve();
    });
}

async function validateMultipleSemaphoreUsage(users, owner) {
    let userResults = [];
    for(let idx = 0; idx < users.length; idx++ ) {
        userResults.push(validateSemaphoreUsage(users[idx], `${owner}${idx + 2}`));
    }
    return await Promise.all(userResults);
}


function validateSemaphoreCrashedOwner(sem, owner) {
    return new Promise((resolve) => {
        if(!sem.granted ) {
            throw new Error(`Semaphore ${sem.name} was never granted to ${owner}`);
        }
        if(sem.released ) {
            throw new Error(`Semaphore ${sem.name} was unexpectedly released by ${owner}`);
        }
        resolve();
    });
}

async function validateSemaphoresClean( clientResult, test ) {
    if(test.semNames && test.semNames.length > 0) {
        const semList = await Promise.all(
            test.semNames.map((semName) => {
                return observeSemaphore(semName);
            })
        );
        semList.forEach((sem) => {
            validateSemaphoreClean( sem );
        });
    }
    return Promise.resolve();
}

async function delay(serverDelay, reason) {
    return await new Promise((resolve) => {
        log.testHarnessInfo(`Waiting for ${reason}`);
        setTimeout(() => {
            resolve();
        }, serverDelay)
    });
}

async function run_test_case( test ) {
    log.testHarnessInfo('Starting server');
    test.server = await server.server(SERVER_PORT, SERVER_API_KEYS);

    const result = {
        name: test.name,
    }

    const timeout = test.timeOut || 10000;
    let timer;
    let resolver;
    const TimeOutPromise = new Promise((resolve, reject) => {
        resolver = resolve;
        timer = setTimeout(() => {
            reject(new Error(`The test '${test.name}' timed out after ${timeout} ms`))
        }, timeout)
    });

    const TestPromise = delay(test.serverDelay || 1500, 'for server to start.')
    .then(() => {
        return test.client(test)
    })
    .then((clientResult) => {
        return test.validate(clientResult, test)
    })
    .then(() => {
        return result;
    })
    .catch((error) => {
        result.error = error;
        return result;
    });

    return Promise.race([TimeOutPromise, TestPromise])
    .then(() => {
        clearTimeout(timer);
        resolver();
    })
    .catch((error) => {
        log.testFlaw(test.name, error);
        result.error = error;
    })
    .then(() => {
        if(test.server) {
            return stopListener(test.server);
        }
        return Promise.resolve();
    })
    .then(() => {
        return result;
    });
}

async function stopListener(listener) {
    log.testHarnessInfo('Stopping server');
    return new Promise((resolve) => {
        listener.close(() => {
            resolve();
        });
    })
}

const TEST_CASES = [
    {
        name: 'One client can obtain and release a semaphore.',
        client: singleUser,
        semNames: ['TEST_SEM'],
        validate: validateSingleUser,
        timeOut: 10000
    },
    {
        name: 'Two clients can obtain and release a semaphore consecutively.',
        client: twoUsersWithDelay,
        semNames: ['TEST_SEM'],
        validate: validateTwoUsersWithDelay,
        timeOut: 10000
    },
    {
        name: 'If a client crashes while holding a semaphore, the semaphore is released and given to the next waiter.',
        client: twoUsersWithCrash,
        semNames: ['TEST_SEM'],
        validate: validateTwoUsersWithCrash,
        timeOut: 10000
    },
    {
        name: 'Five hundred clients can request a semaphore concurrently and obtain and release it consecutively.',
        client: fiveHundredUsersWithDelay,
        semNames: ['TEST_SEM'],
        validate: validateMultipleUsers,
        timeOut: 100000
    },
    {
        name: 'The waitOnSemaphore function will return null if server can not be reached for any reason.',
        client: waitOnSemaphoreCanNotReachServer,
        semNames: ['TEST_SEM'],
        validate: validateWaitOnSemaphoreCanNotReachServer,
        timeOut: 100000
    },
    {
        name: 'The signalSemaphore function will return null if server can not be reached for any reason.',
        client: signalSemaphoreCanNotReachServer,
        semNames: ['TEST_SEM'],
        validate: validateSignalSemaphoreCanNotReachServer,
        timeOut: 100000
    },
    {
        name: 'The observeSemaphore function will return null if server can not be reached for any reason.',
        client: observeSemaphoreCanNotReachServer,
        semNames: ['TEST_SEM'],
        validate: validateObserveSemaphoreCanNotReachServer,
        timeOut: 100000
    },
    {
        name: 'Server endpoints will return a 401 if a valid api key is not provided.',
        client: endPointsRequireApiKey,
        semNames: ['TEST_SEM'],
        validate: validateEndPointsRequireApiKey,
        timeOut: 100000
    },
    {
        name: 'log configuration can be changed.',
        client: changeLogConfig,
        validate: validateChangeLogConfig,
        timeOut: 100000
    },
    {
        name: 'only existinglog configuration can be changed.',
        client: checkLogConfig,
        validate: validateCheckLogConfig,
        timeOut: 100000
    }
];

async function disableLogNoise() {
    const listener = await server.server(SERVER_PORT, SERVER_API_KEYS)
    await disableLogEvent('server', 'info');
    await stopListener(listener);
    await disableLogEvent('client', 'network_errors');
}

async function run() {
    let swings = 0;
    let misses = 0;

    await disableLogNoise();

    for( let i = 0; i < TEST_CASES.length; i++) {
        await new Promise( (resolve) => {
            swings++;
            return run_test_case(TEST_CASES[i])
            .then((result) => {
                if(result.error) {
                    log.testFailure(result.name, result.error);
                    misses++;
                } else {
                    log.testSuccess(result.name);
                }
                resolve();
            });
        })
    }

    log.testSummary(`${misses} failures in ${swings} tests.`);
}

init('localhost', SERVER_PORT, false, SERVER_API_KEYS[0]);
run();
