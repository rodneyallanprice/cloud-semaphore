Cloud-Semaphore
===================

Provides semaphore-like functionality for multi-instance node applications that need to protect a critical section of code.

Install
=======

The npm should be installed on one server and all client instances as so:

```shell
npm install -g cloud-semaphore

```

Usage - Start the server:
===================

```
const semaphore = require('cloud-semaphore');


semaphore.server(3202, ['some-api-key']);

```

Usage - Obtain and release a semaphore:
===================

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

Best Practice
===================

As with traditional semaphores, care should be taken to minimize the time any one client holds
the semaphore. Code that fails to release a semaphore will cause all other requests to block until the client process exits or its idle connections are closed. The server will notice that the connection holding the semaphore has closed and will then release it to the next waiter.

APIs
===================

## changeLogTargets()

#### Syntax
```
changeLogTargets(console);
changeLogTargets(console, callback);

```
#### Parameters

    console (boolean) (required)
        Enabled log events will be sent to the console when 'console' is true.

    callback (function(message))
        This function will be called with a string describing log events when this function is
        provided.

#### Return value
    NA

## disableLogEvent()

#### Syntax
```
disableLogEvent(component, eventType);

```
#### Parameters

    component (string) (required)
        The component can be 'server' or 'client' depending on what service creates the eventType.

    eventType (string) (required)
        The server event type can be one of the following:
            - info (defaults to true)
            - alert (defaults to true)
            - sem_events (defaults to false)
            - sem_transition (defaults to false)
            - debug (defaults to false)
        The client event type can be one of the following:
            - network_status (defaults to false)
            - network_errors (defaults to true)
            - usage_errors (defaults to false)

#### Return value
    A JSON object describing the log event configuration after the requested event was disabled.
    Null is returned when arguments are not recognized or when the server can not be reached.

## enableLogEvent()

#### Syntax
```
enableLogEvent(component, eventType);

```
#### Parameters

    component (string) (required)
        The component can be 'server' or 'client' depending on what service creates the eventType.

    eventType (string) (required)
        The server event type can be one of the following:
            - info (defaults to true)
            - alert (defaults to true)
            - sem_events (defaults to false)
            - sem_transition (defaults to false)
            - debug (defaults to false)
        The client event type can be one of the following:
            - network_status (defaults to false)
            - network_errors (defaults to true)
            - usage_errors (defaults to false)

#### Return value
    A JSON object describing the log event configuration after the requested event was enabled.
    Null is returned when arguments are not recognized or when the server can not be reached.


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
        connection. API keys are passed in the headers and must be protected.

    apiKey (string)
        The string this instance will use to authenticate to the semaphore server.
        Giving each client instance a unique key is helpful when debugging applications
        that do not release the semaphore quickly and correctly.

#### Return value
    NA

## observeSemaphore()
    This function is valuable to see the current state of any semaphore and the
    requests waiting for it.

#### Syntax
```
observeSemaphore(name)

```

#### Parameters

    name (object) (required)
        A name to identify the critical section of code the semaphore protects.

#### Return value
    A JSON object is returned showing the current owner and waiters.

## server(port, acceptedApiKeys, sslCert, sslKey)

    This function is used to start the semaphore server. The server is typically run
    in its own process and by necessity in a single instance.

#### Syntax
```
server(port, acceptedApiKeys)
server(port, acceptedApiKeys, sslCert, sslKey)

```

#### Parameters

    port (number) (required)
        The TCP port where the server will listen.

    acceptedApiKeys (array of strings) (required)
        A list of keys the server will accept for authentication.

    sslCert (string)
        The server will require ssl connections when a certificate and key are provided

    sslKey (string)
        The server will require ssl connections when a certificate and key are provided


#### Return value (object)
    The returned object is an HTTP listener.

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

    This function creates connections to the server specified in the init function and
    returns when the semaphore is owned exclusively by the caller.

#### Syntax
```
waitOnSemaphore(name)

```

#### Parameters
    name (object) (required)
        A name to identify the critical section of code the semaphore protects.

#### Return value
    The returned value is an object describing the requested semaphore. The semaphore is
    released by passing this object to signalSemaphore. If the semaphore server can not
    be contacted for any reason, a null will be returned, a log event created and the
    caller should not proceed.
