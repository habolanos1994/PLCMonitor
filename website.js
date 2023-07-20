// Imports
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const https = require('https'); // Import the HTTPS module
const APIfuntions = require('./APIrequest')
const logError = require('./errorlog').logError;
const os = require('os'); // Assuming you forgot to import os
const mongofunction = require('./mongo');
// Variables
const app = express();
const port = 443;
const sourcefile = path.basename(__filename);
const hostname = os.hostname();

// Your server's SSL configuration
let sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'ReturnsVlanServices.key')), // Include your .key file
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'certificate_chain.pem')) // Include your .crt file
};

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());



// Remove the following line:
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'papaparse', 'dist')));

// Replace it with the following line:
app.use('/papaparse', express.static(path.join(__dirname, 'node_modules', 'papaparse', 'dist')));


app.use(express.static(path.join(__dirname, 'public')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'))); // this line is added
app.use('/js/papaparse', express.static(path.join(__dirname, 'node_modules', 'papaparse')));
app.use('/libs', express.static(path.join(__dirname, 'node_modules')));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));


// Middleware to set headers
app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'Cache-Control');
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Server', 'Linux/Rocky8');
    res.setHeader('X-Nodejs-Version', '18.15.0');
    res.setHeader('X-Powered-By', 'Node.js, Express');
    next();
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/ConfigPLC', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'configplc.html'));
});

app.get('/DataCollector', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'DataCollector.html'));
});

app.get('/errorLog', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'errorLog.html'));
});

app.get('/getErrorLog', (req, res) => {
  fs.readFile('errorlog.csv', 'utf8', (err, data) => {
    if (err) {
      logError(err, 'getErrorLog', sourcefile);
      res.status(500).send("Error reading error log");
    } else {
      res.type('text/csv');
      res.send(data);
    }
  });
});

app.post('/clearErrorLog', (req, res) => {
  fs.writeFile('errorlog.csv', '', (err) => {
    if (err) {
        logError(err, 'clearErrorLog', sourcefile);
      res.status(500).send("Error clearing error log");
    } else {
      res.sendStatus(200);
    }
  });
});

app.get('/api/getjson', async (req, res) => {
  try {
    const data = await APIfuntions.readConfigAndTagFiles();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.toString() });
  }
});

app.get('/api/mongo/getTagConfigs', async (req, res) => {

  try {
    await mongofunction.connectDB();

    const data = await mongofunction.getTagConfigs()
    res.send(data)

  } catch (err) {
    console.error('An error occurred:', err);
    res.status(500).send('Server error');
  }

});

app.get('/api/DataCollector/Status', async (req, res) => {

  try {

    const data = await APIfuntions.DataCollectorStatus()
    res.send(data)

  } catch (err) {
    console.error('An error occurred:', err);
    res.status(500).send('Server error');
  }

});

app.get('/api/DataCollector/Restart', async (req, res) => {

  try {

    const data = await APIfuntions.DataCollectorRestart()
    res.send(data)

  } catch (err) {
    console.error('An error occurred:', err);
    res.status(500).send('Server error');
  }

});




// Middleware for handling 404 errors
app.use((req, res, next) => {
  let errMsg = `errorApiNotFound:${req.originalUrl},Requestor:${req.ip}`;
  res.status(404).send('Cannot GET /');
  logError(errMsg, 'errorApiNotFound', sourcefile);
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    logError(err.message, 'middleware', sourcefile);
    console.error(`Error: ${err.message}`);
    res.status(500).send('Server error');
});

// Create and start the HTTPS server
https.createServer(sslOptions, app).listen(port, () => {
console.log(`Server running at https://${hostname}:${port}/`);
});
