require('dotenv').config()
const server = require('./server');
const client = require('./client');
const log = require('./log.js');

const WaitOnSemaphore = client.WaitOnSemaphore;
const SignalSemaphore = client.SignalSemaphore;
const ObserveSemaphore = client.ObserveSemaphore;



async function singleUser() {
    const sem = await WaitOnSemaphore(`TEST_SEM`);
    await SignalSemaphore(sem);
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
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    clientResult.user1 = user1;
    log.testInfo(`user1 holds ${user1.name}`);
    return await new Promise((resolve, reject) => {
        WaitOnSemaphore('TEST_SEM')
        .then((user2) => {
            clientResult.user2 = user2;
            log.testInfo(`user2 holds ${user2.name}`);
            log.testInfo(`user2 signals ${user2.name}`);
            SignalSemaphore(user2)
            .then(() => {
                resolve(clientResult);
            });
        });
        setTimeout(() => {
            log.testInfo(`user1 signals ${user1.name}`);
            SignalSemaphore(user1)
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
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    clientResult.user1 = user1;
    log.testInfo(`user1 holds ${user1.name}`);
    return await new Promise((resolve, reject) => {
        WaitOnSemaphore('TEST_SEM')
        .then((user2) => {
            clientResult.user2 = user2;
            log.testInfo(`user2 holds ${user2.name}`);
            log.testInfo(`user2 signals ${user2.name}`);
            SignalSemaphore(user2)
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
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    clientResult.user1 = user1;
    log.testInfo(`user1 holds ${user1.name}`);
    const waiters = [];
    for( let idx = 0; idx < count; idx++ ) {
        let Sem;
        waiters.push(
            WaitOnSemaphore('TEST_SEM')
            .then((sem) => {
                Sem = sem;
                return SignalSemaphore(sem);
            })
            .then(() => {
                return Sem;
            })
        );
    }
    setTimeout(() => {
        log.testInfo(`user1 signals ${user1.name}`);
        SignalSemaphore(user1)
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


function validateSemaphoreClean(sem) {
    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
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
    return new Promise((resolve, reject) => {
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
                return ObserveSemaphore(semName);
            })
        );
        semList.forEach((sem) => {
            validateSemaphoreClean( sem );
        });
    }
    return Promise.resolve();
}

async function delay(serverDelay, reason) {
    return await new Promise((resolve, reject) => {
        log.testHarnessInfo(`Waiting for ${reason}`);
        setTimeout(() => {
            resolve();
        }, serverDelay)
    });
}

function run_test_case( test ) {
    log.testHarnessInfo('Starting server');
    const testServer = server.server(process.env.PORT || 3202, ['pdq', 'xyz']);

    const result = {
        name: test.name
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
    .then((response) => {
        return stopListener(testServer);
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
        name: 'One client can obtain and release a semaphore',
        client: singleUser,
        semNames: ['TEST_SEM'],
        validate: validateSingleUser,
        timeOut: 2000
    },
    {
        name: 'Two clients can obtain and release a semaphore consecutively',
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
        name: 'Five hundred clients can request a semaphore concurrently and obtain and release it consecutively',
        client: fiveHundredUsersWithDelay,
        semNames: ['TEST_SEM'],
        validate: validateMultipleUsers,
        timeOut: 100000
    }
];

async function run() {
    let swings = 0;
    let misses = 0;

    for( let i = 0; i < TEST_CASES.length; i++) {
        await new Promise( async (resolve) => {
            swings++;
            const result = await run_test_case(TEST_CASES[i])
            if(result.error) {
                log.testFailure(result.name, result.error);
                misses++;
            } else {
                log.testSuccess(result.name);
            }
            resolve();
        })
    }

    log.testSummary(`${misses} failures in ${swings} tests.`);
}

run();
