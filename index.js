const http = require('http');
const fs = require('fs');
const path = require('path');

const publicFolder = path.join(__dirname, 'public');

const hostname = '0.0.0.0';
const port = 80;
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};
const getMimeType = (filePath) => {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'application/octet-stream';
};
const server = http.createServer((req, res) => {
    let contents;
    try {
        let filePath = path.join(publicFolder, req.url === '/' ? 'index.html' : req.url);
        contents = fs.readFileSync(filePath);
        res.statusCode = 200;
        res.setHeader('Content-Type', getMimeType(filePath));
        res.end(contents);
    } catch (e) {
        console.log(e);
        res.statusCode = 404;
    }
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
