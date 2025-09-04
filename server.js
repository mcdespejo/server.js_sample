const http = require("http");
const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

// Allowed file extensions for upload
const ALLOWED_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.txt'];
const publicDir = path.join(__dirname, "public");
const uploadsDir = path.join(__dirname, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

function serveFile(filePath, res) {
    fs.stat(filePath, (err, stats) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 - File Not Found</h1>', 'utf8');
        } else if (stats.isDirectory()) {
            // Optionally serve index.html for directories in public
            const indexPath = path.join(filePath, 'index.html');
            fs.stat(indexPath, (err2, stats2) => {
                if (!err2 && stats2.isFile()) {
                    fs.readFile(indexPath, (err3, content) => {
                        if (err3) {
                            res.writeHead(500);
                            res.end(`Server Error: ${err3.code}`);
                        } else {
                            res.writeHead(200, { 'Content-Type': mime.lookup(indexPath) || 'text/html' });
                            res.end(content, 'utf8');
                        }
                    });
                } else {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end('<h1>404 - File Not Found</h1>', 'utf8');
                }
            });
        } else {
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(500);
                    res.end(`Server Error: ${err.code}`);
                } else {
                    res.writeHead(200, { 'Content-Type': mime.lookup(filePath) || 'application/octet-stream' });
                    res.end(content, 'utf8');
                }
            });
        }
    });
}

function handleUpload(req, res) {
    if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'text/html' });
        res.end('<h1>405 - Method Not Allowed</h1>');
        return;
    }

    // Parse multipart form data manually (simple implementation)
    let data = '';
    req.setEncoding('binary');
    req.on('data', chunk => {
        data += chunk;
    });

    req.on('end', () => {
        const boundaryMatch = req.headers['content-type'].match(/boundary=(.+)$/);
        if (!boundaryMatch) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end('<h1>400 - Bad Request</h1>');
            return;
        }
        const boundary = boundaryMatch[1];
        const parts = data.split('--' + boundary);

        for (let part of parts) {
            if (part.indexOf('Content-Disposition') !== -1) {
                // Extract filename
                const filenameMatch = part.match(/filename="(.+?)"/);
                if (!filenameMatch) continue;
                let filename = path.basename(filenameMatch[1]);
                const ext = path.extname(filename).toLowerCase();

                // Validate file extension
                if (!ALLOWED_EXTENSIONS.includes(ext)) {
                    res.writeHead(400, { 'Content-Type': 'text/html' });
                    res.end('<h1>400 - Invalid file type</h1>');
                    return;
                }

                // Extract file data
                const fileDataStart = part.indexOf('\r\n\r\n') + 4;
                const fileDataEnd = part.lastIndexOf('\r\n');
                const fileData = part.substring(fileDataStart, fileDataEnd);

                // Save file
                const savePath = path.join(uploadsDir, filename);
                fs.writeFile(savePath, fileData, 'binary', err => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'text/html' });
                        res.end('<h1>500 - Error saving file</h1>');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(`<h1>File uploaded successfully!</h1><a href="/">Go back</a>`);
                    }
                });
                return;
            }
        }
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>400 - No file uploaded</h1>');
    });
}

const server = http.createServer((req, res) => {
    // Handle file upload
    if (req.url === '/upload') {
        handleUpload(req, res);
        return;
    }

    // Prevent directory traversal attacks
    const safePath = path.normalize(req.url).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(publicDir, safePath === "/" ? "index.html" : safePath);

    // Serve files from uploads directory if requested
    if (req.url.startsWith('/uploads/')) {
        filePath = path.join(uploadsDir, req.url.replace('/uploads/', ''));
    }

    serveFile(filePath, res);
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
