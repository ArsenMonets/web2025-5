const http = require('http');
const { Command } = require('commander');

const program = new Command();

program
  .requiredOption('-h, --host <host>', 'server address')
  .requiredOption('-p, --port <port>', 'server port', parseInt)
  .requiredOption('-c, --cache <path>', 'path to the cache directory');

program.parse(process.argv);

const options = program.opts();

if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    console.error(`error: Invalid port number: ${options.port}. Must be an integer between 1 and 65535.`);
    process.exit(1);
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Server is running!\n');
});

server.listen(options.port, options.host, () => {
  console.log(`Server started at http://${options.host}:${options.port}/`);
});

server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`error: Port ${options.port} is already in use.`);
    } else if (err.code === 'EADDRNOTAVAIL') {
      console.error(`error: Host ${options.host} is not available.`);
    } else if (err.code === 'ENOTFOUND') {
      console.error(`error: Host ${options.host} could not be found.`);
    } else if (err.code === 'EACCES') {
      console.error(`error: Insufficient privileges to bind to port ${options.port}. Try using a port number above 1024 or running with elevated privileges.`);
    } else {
      console.error(`Server error: ${err.message}`);
    }
    process.exit(1);
  });
  
