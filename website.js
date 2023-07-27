// Imports
const express = require('express');
var ntlm = require('express-ntlm');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const https = require('https'); // Import the HTTPS module
const APIfuntions = require('./APIrequest')
const logError = require('./errorlog').logError;
const os = require('os'); // Assuming you forgot to import os
const mongofunction = require('./mongo');
const sqlModule = require('./sql.js'); // import the module
const session = require('express-session');
const passport = require('passport');
const CustomStrategy = require('passport-custom').Strategy;


// Variables
const app = express();
const port = 443;
const sourcefile = path.basename(__filename);
const hostname = os.hostname();

// Your server's SSL configuration
let sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'certs', 'server.key')), // Include your .key file
  cert: fs.readFileSync(path.join(__dirname, 'certs', 'IOTVLANServices_bundle.pem')) // Include your .crt file
};

// Middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(ntlm());
app.use(session({ secret: 'your session secret', resave: false, saveUninitialized: false }));

// Remove the following line:
app.use('/js', express.static(path.join(__dirname, 'node_modules', 'papaparse', 'dist')));

// Replace it with the following line:
app.use('/papaparse', express.static(path.join(__dirname, 'node_modules', 'papaparse', 'dist')));


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css'))); // this line is added
app.use('/js/papaparse', express.static(path.join(__dirname, 'node_modules', 'papaparse')));
app.use('/libs', express.static(path.join(__dirname, 'node_modules')));
app.use('/lib', express.static(path.join(__dirname, 'lib')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/js', express.static(path.join(__dirname, 'public')));



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






// Assuming you've already defined the GetEmployeeDetails function and the custom authentication strategy.;

passport.use('custom', new CustomStrategy(
  async function(req, done) {
    try {
      // get the NT Login from the request
      const ntLogin = req.body.nt_login;
      console.log("NT Login:", ntLogin); // Log the NT login
      // query the database with the provided NT Login
      const employee = await sqlModule.GetEmployeeDetails(ntLogin);
      // if no matching user was found, fail the authentication
      if (employee.recordset.length === 0) {
        return done(null, false, { message: 'Incorrect NT Login.' });
      }
      // if a matching user was found, pass it to the done callback
      done(null, employee.recordset[0]);
    } catch (err) {
      done(err);
    }
  }
));

app.use(passport.initialize());
app.use(passport.session());


passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

app.get('/ntlogin', (req, res) => {
  // Access the Windows username from the ntlm object provided by the middleware
  const windowsUsername = req.ntlm.UserName;
  res.json({ windows_username: windowsUsername });
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

app.get('/PLCdata', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'PLCdata.html'));
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

// Route to get all records
app.get('/api/recovery/getRecords', async (req, res) => {
  try {
    const result = await sqlModule.GetReceverydata();
    res.send(result.recordset); // Send only the recordset which contains the actual rows
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error'); // Send a generic error message
  }
});

app.get('/recovery', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'recovery.html'));
});

// Route to update a record
app.post('/api/recovery/updateRecord', async (req, res) => {
  let { recover, part_number, model } = req.body;
  try {
    const result = await sqlModule.UpdateReceveryData(recover, part_number, model);
    res.send(result); // Send the result back
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error'); // Send a generic error message
  }
});

app.post('/api/wap/GetWAPStatus', async (req, res) => {
  let { serial } = req.body;
  try {
    const result = await sqlModule.GetWAPStatus(serial)
    res.send(result); // Send the result back
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error'); // Send a generic error message
  }
});

app.get('/wap', (req, res) => {

  res.sendFile(path.join(__dirname, 'public', 'WAP.html'));
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
