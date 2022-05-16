Cloud-Semaphore
===================

*Provides semaphore-like functionality for multi-instance node applications that need to protect a critical section of code.


The npm should be installed on one server and all client instances as so:

```shell
npm install -g cloud-semaphore

```

Usage - start the server:
-------------------------
```
const semaphore = require('cloud-semaphore');


semaphore.server(3202, ['some-api-key']);

```

Usage - Obtain and Release a semaphore:
-------------------------
```
const {
    init,
    waitOnSemaphore,
    signalSemaphore
} = require('cloud-semaphore');

init('localhost', 3202, false, 'some-api-key' )

async function doSomethingImportant() {
    const sem = await waitOnSemaphore('Name');

    if(sem) {
        /* perform critical section */
        console.log('got it.');
        await signalSemaphore(sem);
        console.log('released it.');
    }
}

doSomethingImportant();

```


APIs
-------

## changeLogTargets()

#### Syntax
```
changeLogTargets(console);
changeLogTargets(console, callback);

```
#### Parameters

    console (boolean) (required)
        Enabled log events will be sent to the console when console is true.

    callback (function(message))
        This function will be called with a string describing log events when this function is
        provided.

#### Return value
    NA

## init()
    This function is called once before any other APIs described here to instruct the library
    how to contact the semaphore server.

#### Syntax
```
init(semaphoreHost, semaphorePort)
init(semaphoreHost, semaphorePort, secure)
init(semaphoreHost, semaphorePort, secure, apiKey)

```

#### Parameters

    semaphoreHost (string)
        The hostname where the semaphore server is listening.

    semaphorePort (number)
        The port where the semaphore server is listening.

    secure (boolean)
        Does the server support ssl. This service should never run on an unprotected
        connection. API keys are pass in the headers an must be be protected.

    apiKey (string)
        The string this instance will use to authenticate to the semaphore server.
        Giving each client instance a unique key is helpful when debuging applications
        that do not release the semaphore quickly and correctly.

#### Return value
    NA


## signalSemaphore(semaphore)

    This function is used to release a currently held semaphore. When called, the next
    consumer requesting the semaphore will be given it.

#### Syntax
```
signalSemaphore(semaphore)

```

#### Parameters

    semaphore (object) (required)
        The object returned by waitOnSemaphore must be passed as an argument to this
        function.

#### Return value (boolean)
    The value 'true' will be returned when the semaphore is recognized and successfully
    released.

## waitOnSemaphore(name)

    This function creates a connections to the server specified in the init function and
    returns when the semaphore in owned exclusively by the caller.

#### Syntax
```
waitOnSemaphore(name)

```

#### Parameters
    name (object) (required)
        A name to identify the critical section of code the semaphore protects. (string)

#### Return value
    The returned value is an object describing the requested semaphore. The semaphore is
    released by passing this object to signalSemaphore. If the semaphore server can not
    be contacted for any reason, a null will be returned, a log event created and the
    caller should not proceed.
