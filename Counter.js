const mqtt = require('mqtt');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const schedule = require('node-schedule');
const { sendsmtp } = require('./smtp');
const { findmodel } = require('./model');
const errlog = require("./errorlog");

const sourcefile = path.basename(__filename);

const os = require('os');
const hostname = os.hostname();

let rule = new schedule.RecurrenceRule();
rule.dayOfWeek = [0, new schedule.Range(1, 6)];
rule.hour = [3, 15];
rule.minute = 0;
rule.tz = 'America/Denver';

const csvFileDir = path.join(__dirname, 'csvFiles');

// const countersFile = path.join(csvFileDir, 'counters.json');
const countersFile = path.join(__dirname, './jsonfiles/TotalUnits.json');


const KeyenceSerials = path.join(csvFileDir, 'KeyenceSerials.csv');
const SickSerials = path.join(csvFileDir, 'SickSerials.csv');
const SorterSerials = path.join(csvFileDir, 'SorterSerials.csv');
const QRASerials = path.join(csvFileDir, 'QRASerials.csv');
const NoRa = path.join(csvFileDir, 'NoRa.csv');
const AllSerials = path.resolve(csvFileDir, 'serials.csv');

const options = {
  host: 'pcv1engmqtt01',
  port: 1883,
  protocol: 'mqtt',
  rejectUnauthorized: false,
  clientId: `client${hostname}PLC${uuidv4()}`,
};

let client = mqtt.connect(options);
let isConnected = false;

// Function to subscribe to topics
function subscribeToTopics() {
  client.subscribe('ELP/Returns/PROXY/SickClarify/DDATA', { qos: 2 });
  client.subscribe('ELP/Returns/PROXY/Keyence/DDATA', { qos: 2 });
  client.subscribe('ELP/Returns/PROXY/Receiver_Sorter/DDATA', { qos: 2 });
  client.subscribe('ELP/QRA/+/DDATA', { qos: 2 });
}

let uniqueSerialsset = new Set();
let SickSerialsSet = new Set();
let KeyenceSerialsSet = new Set();
let SorterSerialsSet = new Set();
let QRASerialsSet = new Set();
let NoRaSet = new Set();

const counters = {
  Cameras: {},
  Models: {},
};

let connectionAttempts = 0;
const maxAttempts = 10;
let connectionInterval = null;
let messageQueue = [];

client.on('connect', () => {
  isConnected = true;
  if (connectionInterval) {
    clearInterval(connectionInterval);
    connectionInterval = null;
  }
  subscribeToTopics();
});

client.on('message', (topic, message) => {
  messageQueue.push({ topic, message });
});

client.on('close', () => {
  if (!connectionInterval) {
    connectionInterval = setInterval(attemptReconnect, 5000);
    errlog.logError(`Mqtt disconected`, sourcefile, `client.on('close', () => {`)
  }
});

loadModelsFromFile(AllSerials, uniqueSerialsset);
loadSerialsFromFile(AllSerials, uniqueSerialsset);
loadSerialsFromFile(SickSerials, SickSerialsSet);
loadSerialsFromFile(KeyenceSerials, KeyenceSerialsSet);
loadSerialsFromFile(SorterSerials, SorterSerialsSet);
loadSerialsFromFile(QRASerials, QRASerialsSet);
loadSerialsFromFile(NoRa, NoRaSet);
getallcount();

async function loadModelsFromFile(filePath, set) {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const serials = data.split('\n').filter(serial => serial.trim() !== '');
      for (const serial of serials) {
        let model = await findmodel(serial);
        counters.Models[model] = (counters.Models[model] || 0) + 1;
      }
      console.log(`Loaded ${Object.keys(counters.Models).length} models from file ${filePath}.`);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      errlog.logError(error, sourcefile, `loadModelsFromFile`)
    }
  }
}

function loadSerialsFromFile(filePath, set) {
  if (fs.existsSync(filePath)) {
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      const serials = data.split('\n').filter(serial => serial.trim() !== '');
      for (const serial of serials) {
        set.add(serial);
      }
      console.log(`Loaded ${set.size} unique serial numbers from file ${filePath}.`);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      errlog.logError(error, sourcefile, `loadSerialsFromFile`)
    }
  }
}

function getallcount() {
  counters.Cameras.TotalReceiversScan = uniqueSerialsset.size;
  counters.Cameras.TotalSickClarify = SickSerialsSet.size;
  counters.Cameras.TotalKeyenceClarify = KeyenceSerialsSet.size;
  counters.Cameras.TotalQRA = QRASerialsSet.size;
  counters.Cameras.TotalSorter = SorterSerialsSet.size;
  counters.Cameras.TotalNoRAReceivers = NoRaSet.size;

  writeDataToFile(countersFile, counters);
}

function writeDataToFile(file, data) {
  writeFileAtomic(file, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error(`Error writing file ${file}:`, err);
      errlog.logError(err, sourcefile, `writeDataToFile`)
    }
  });
}

let clearDataJob = schedule.scheduleJob(rule, function () {
  try {
    uniqueSerialsset.clear();
    SickSerialsSet.clear();
    KeyenceSerialsSet.clear();
    SorterSerialsSet.clear();
    QRASerialsSet.clear();
    NoRaSet.clear();
    counters.Models = {};

    fs.writeFileSync(AllSerials, '');
    fs.writeFileSync(SickSerials, '');
    fs.writeFileSync(KeyenceSerials, '');
    fs.writeFileSync(SorterSerials, '');
    fs.writeFileSync(QRASerials, '');
    fs.writeFileSync(NoRa, '');
    fs.writeFileSync(countersFile, JSON.stringify(counters, null, 2));
    console.log('Data has been cleared.');
  } catch (error) {
    console.error('Error clearing data:', error);
    errlog.logError(error, sourcefile, `clearDataJob`)
  }
});

async function processMessageQueue() {
  if (messageQueue.length > 0) {
    const { topic, message } = messageQueue.shift();
    // Process the message here
    try {
      const msg = JSON.parse(message.toString());

      let serial;
      if ('troubleshoot' in msg && 'Serial Number' in msg.troubleshoot.ReceiverData) {
        serial = msg.troubleshoot.ReceiverData['Serial Number'];
      }  else if ('serial' in msg) {
        serial = msg.serial;
      }

      let  model = await findmodel(serial);
  
      // console.log(model)
      // console.log(serial)
      // console.log(topic)



        if (model !== 'undefined') {

          if (!uniqueSerialsset.has(serial)) {

            counters.Models[model] = (counters.Models[model] || 0) + 1;
            uniqueSerialsset.add(serial);
            fs.appendFileSync(AllSerials, serial + '\n');
          }
 
          if (topic.includes('SickClarify')) {
            SickSerialsSet.add(serial);
            fs.appendFileSync(SickSerials, serial + '\n');
          } else if (topic.includes('Keyence')) {
            KeyenceSerialsSet.add(serial);
            fs.appendFileSync(KeyenceSerials, serial + '\n');
          } else if (topic.includes('Receiver_Sorter')) {
            SorterSerialsSet.add(serial);
            fs.appendFileSync(SorterSerials, serial + '\n');
          } else if (topic.includes('QRA')) {
            QRASerialsSet.add(serial);
            fs.appendFileSync(QRASerials, serial + '\n');
  
            if (msg.troubleshoot.ReceiverResultData['TestResult'] !== 'QRA|WHS') {
              NoRaSet.add(serial);
              fs.appendFileSync(NoRa, serial + '\n');
            }
          }
        } else {
        fs.appendFileSync(path.join(csvFileDir, 'undefined.csv'), `${serial}\n`);
      }

      getallcount();

    } catch (error) {
      console.error('Error processing message:', error);
      errlog.logError(error, sourcefile, `processMessageQueue`)
    }
  }
  // Wait for some time before processing the next message
  setTimeout(processMessageQueue, 100);  // Adjust the delay as needed
}

processMessageQueue();
sendsmtp('counter service Returns Start, Display name: Bastian Receivers Count server');