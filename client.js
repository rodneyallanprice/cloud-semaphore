const axios = require('axios');

let SEMAPHORE_HOST='http://localhost:3202';

module.exports.init = function(semaphoreHost) {
    SEMAPHORE_HOST = semaphoreHost;
};

module.exports.WaitOnSemaphore = async function(name) {
    const registrationResponse = await axios.get(`${SEMAPHORE_HOST}/semaphore/register?name=${name}`, {'headers': {'x-api-key': 'pdq'}});

    axios.get(`${SEMAPHORE_HOST}/semaphore/monitor?name=${name}`,
        {
            'headers': {
                'x-api-key': 'pdq',
                'x-client-uuid': registrationResponse.data
            }
        }
    )
    .then((response) => {
        console.log(`Monitor returned: ${response.status}`);
    })
    .catch((error) => {
        console.log(`Monitor encountered: ${response.status} ${error}`);
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
        console.log(`Encountered ${error} waiting for sempaphore ${name}`);
    }

    if( response ) {
        console.log(`Received ${response.status} after waiting.`);
        return registrationResponse.data;
    }
    return null;
}

module.exports.SignalSemaphore = async function(name, id) {
    const releaseResponse = await axios.get(`${SEMAPHORE_HOST}/semaphore/signal?name=${name}`,
        {
            'headers': {
                'x-api-key': 'pdq',
                'x-client-uuid': id
            }
        }
    );
    console.log(`Release response: ${releaseResponse.status}`);
}

module.exports.ObserveSemaphore = async function(name) {
    const releaseResponse = await axios.get(`${SEMAPHORE_HOST}/semaphore/observe?name=${name}`,
        {
            'headers': {
                'x-api-key': 'pdq'
            }
        }
    );
    console.log(`Observe response: ${releaseResponse.status}`);
}
