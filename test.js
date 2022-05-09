require('dotenv').config()
const server = require('./server');
const client = require('./client');
const log = require('./log.js');

const WaitOnSemaphore = client.WaitOnSemaphore;
const SignalSemaphore = client.SignalSemaphore;
const ObserveSemaphore = client.ObserveSemaphore;


async function twoUsersWithDelay() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    log.testInfo(`user1 holds ${user1.name}`);
    const result = await new Promise((resolve, reject) => {
        WaitOnSemaphore('TEST_SEM')
        .then((user2) => {
            log.testInfo(`user2 holds ${user2.name}`);
            log.testInfo(`user2 signals ${user2.name}`);
            SignalSemaphore(user2)
            .then(() => {
                resolve();
            });
        });
        setTimeout(() => {
            log.testInfo(`user1 signals ${user1.name}`);
            SignalSemaphore(user1)
        }, 1000)
    });
}

async function twoUsersWithCrash() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    console.log(`user1 holds ${user1}`);
    WaitOnSemaphore('TEST_SEM')
    .then((user2) => {
        console.log(`user2 holds ${user2}`);
        console.log(`user2 signals ${user2}`);
        SignalSemaphore(user2);
    });
    console.log(`user1 signals ${user1}`);
    // SignalSemaphore(user1)
    setTimeout(() => {
        process.exit(-1);
    }, 1000)
}

async function singleUser() {
    const sem = await WaitOnSemaphore(`TEST_SEM`);
    await SignalSemaphore(sem);
}

async function singleUserCrashWhileHolding() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    process.exit(-1);
}

function validateSemaphoreClean(sem) {
    if( Object.keys(sem.nodes).length > 0 ) {
        throw new Error(`Semaphore ${sem.name} has leftover nodes`);
    }
    if(sem.waiting.length > 0) {
        throw new Error(`Semaphore ${sem.name} has leftover waiters`);
    }
    if(sem.running) {
        throw new Error(`Semaphore ${sem.name} is still held`);
    }
    return;
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
    .then((res) => {
        return test.validate(res, test)
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
        validate: validateSemaphoresClean,
        timeOut: 2000
    },
    {
        name: 'Two clients can obtain and release a semaphore consecutively',
        client: twoUsersWithDelay,
        semNames: ['TEST_SEM'],
        validate: validateSemaphoresClean,
        timeOut: 10000
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
