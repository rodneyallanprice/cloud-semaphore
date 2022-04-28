require('dotenv').config()
const server = require('./server');
const client = require('./client');

const WaitOnSemaphore = client.WaitOnSemaphore;
const SignalSemaphore = client.SignalSemaphore;
const ObserveSemaphore = client.ObserveSemaphore;


async function twoUsersWithDelay() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    console.log(`user1 holds ${user1}`);
    WaitOnSemaphore('TEST_SEM')
    .then((user2) => {
        console.log(`user2 holds ${user2}`);
        console.log(`user2 signals ${user2}`);
        SignalSemaphore('TEST_SEM', user2);
    });
    console.log(`user1 signals ${user1}`);
    // SignalSemaphore('TEST_SEM', user1)
    setTimeout(() => {
        SignalSemaphore('TEST_SEM', user1);
    }, 1000)
}

async function twoUsersWithCrash() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    console.log(`user1 holds ${user1}`);
    WaitOnSemaphore('TEST_SEM')
    .then((user2) => {
        console.log(`user2 holds ${user2}`);
        console.log(`user2 signals ${user2}`);
        SignalSemaphore('TEST_SEM', user2);
    });
    console.log(`user1 signals ${user1}`);
    // SignalSemaphore('TEST_SEM', user1)
    setTimeout(() => {
        process.exit(-1);
    }, 1000)
}

async function singleUser() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    await SignalSemaphore('TEST_SEM', user1);
}

async function singleUserCrashWhileHolding() {
    const user1 = await WaitOnSemaphore(`TEST_SEM`);
    process.exit(-1);
}

server.server(process.env.PORT || 3202, ['pdq', 'xyz']);

setTimeout(() => {
    singleUser();
    // twoUsersWithDelay();
    // singleUserCrashWhileHolding();
    // twoUsersWithCrash()
    // ObserveSemaphore('TEST_SEM');
}, 1000);
