const serverSrc = require('./server');
const clientSrc = require('./client');

module.exports.server = serverSrc.server;
module.exports.client = clientSrc;
module.exports.init = clientSrc.init;
module.exports.waitOnSemaphore = clientSrc.waitOnSemaphore;
module.exports.signalSemaphore = clientSrc.signalSemaphore;
module.exports.observeSemaphore = clientSrc.observeSemaphore;
module.exports.disableLogEvent = clientSrc.init.disableLogEvent;
module.exports.enableLogEvent = clientSrc.init.enableLogEvent;
module.exports.changeLogTargets = clientSrc.changeLogTargets;