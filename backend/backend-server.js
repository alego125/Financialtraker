// Compatibility entry point. Keep one server and one security configuration.
const server = require('./server');
if (require.main === module) server.start();
module.exports = server;
