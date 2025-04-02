const http = require('http');
const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const superagent = require('superagent');

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

async function getFile(res, filePath, req, statusCode) {
  const cacheFilePath = path.join(__dirname, 'cache', `${statusCode}.jpg`);
  const readFile = async () => {
      try {
          const data = await fs.promises.readFile(filePath);
          res.writeHead(200, { 'Content-Type': 'image/jpeg' });
          res.end(data); 
      } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Unable to read file');
      }
  };
  if (!fs.existsSync(filePath)) {
      try {
          const response = await superagent.get(`https://http.cat/${statusCode}`);
          const imageData = Buffer.from(response.body);
          await fs.promises.writeFile(cacheFilePath, imageData);
          await readFile();
      } catch (error) {
          if (error.response) {
              res.writeHead(400, { 'Content-Type': 'text/plain' });
              res.end('File not found');
          } else {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Error saving image to cache');
          }
      }
  } else {
      await readFile();
  }
}


function putFile(res, filePath, req) {
    const chunks = [];
    req.on('data', (chunk) => {
        chunks.push(chunk);
    });

    req.on('end', () => {
        const MAX_FILE_SIZE = 5 * 1024 * 1024; 
        const data = Buffer.concat(chunks);
        if (Buffer.byteLength(data) > MAX_FILE_SIZE) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('File size exceeds the maximum limit of 5MB');
            return;
        }
        const directory = path.dirname(filePath);
        fs.promises.mkdir(directory, { recursive: true })
            .then(() => {
                return fs.promises.writeFile(filePath, data);
            })
            .then(() => {
                res.writeHead(201, { 'Content-Type': 'text/plain' });
                res.end('File updated successfully');
            })
            .catch((error) => {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error updating file');
            });
    });

    req.on('error', (error) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error receiving data');
    });
} 

function deleteFile(res, filePath) {
  fs.promises.unlink(filePath)
      .then(() => {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('File deleted successfully');
      })
      .catch((error) => {
          if (error.code === 'ENOENT') {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('File not found');
          } else {
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Error deleting file');
          }
      });
}

function defaultResponse(res) {
    res.writeHead(405, { 'Content-Type': 'text/plain' });
    res.end('Method Not Allowed\n');
}

const methods = {
    GET: getFile,
    PUT: putFile,
    DELETE: deleteFile,
    default: defaultResponse
};

const server = http.createServer((req, res) => {
  const urlParts = req.url.split('/').filter(Boolean);
  if (urlParts.length != 1) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('You should specify a valid path');
  } else {
    const statusCode = urlParts[0];
    const filePath = path.join(options.cache, `${statusCode}.jpg`);
    (methods[req.method] || methods.default)(res, filePath, req, statusCode);
  }
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
  
