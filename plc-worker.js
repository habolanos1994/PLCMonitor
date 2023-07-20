const fs = require("fs");
const PLC = require("./readPLC");
const errlog = require("./errorlog");
const { mqttpub } = require("./mqttpublish");
const { saveToMongoDB } = require("./mongo")
const { scheduleJob } = require("node-schedule");
const path = require('path');

let Plcdata = new Map(); // use a Map instead of a Set

const sourcefile = path.basename(__filename);

let sendTomongo = false;

const {
  plcName,
  plcIpAddress,
  tagConfigs,
  emissionFrequency,
  Plant,
  Area,
  Line,
} = require("worker_threads").workerData;

let mqttTopicPrefix = `${Plant}/${Area}/${Line}`

let totalUnits = getTotalUnits(); // Read and cache total units initially

// Read and cache total units every 10 seconds
setInterval(() => {
  totalUnits = getTotalUnits();
}, 10000);

function getTotalUnits() {
  try {
    const totalUnits = JSON.parse(fs.readFileSync("TotalUnits.json"));
    return { ...totalUnits };
  } catch (err) {
    errlog.logError(err, sourcefile, 'getTotalUnits')
    console.error("Error reading TotalUnits.json:", err);
    return null;
  }
}


const plcConnection = new PLC(
  plcName,
  plcIpAddress,
  tagConfigs,
  emissionFrequency,
  10,
  120000
);

plcConnection.on("error", (error) => {
  console.error(`Error in PLC ${plcName}:`, error.message);
  errlog.logError(error, sourcefile, `Error in PLC ${plcName}`)
  setTimeout(() => {
    plcConnection.connectToPLC();
  }, 100000);
});

plcConnection.on("disconnected", () => {
  console.log(`Disconnected from PLC ${plcName}. Attempting to reconnect in 10 seconds...`);
  errlog.logError('disconnected', sourcefile, `Disconnected from PLC ${plcName}. Attempting to reconnect in 10 seconds...`)
  setTimeout(() => {
    plcConnection.connectToPLC();
  }, 100000);
});

plcConnection.on("tagsRead", (tagvalues) => {
  const stationname = tagvalues.StationName;
  delete tagvalues.StationName;

  // Move the "values" content one level up for each object
  for(let key in tagvalues) {
    if(tagvalues[key].hasOwnProperty('values')) {
      tagvalues[key] = tagvalues[key].values;
    }
  }

  Plcdata.set(stationname, tagvalues); // use Map's set method to update the data for stationname

  const data = tagvalues;
  if (stationname === 'Mark012') {
    const data2 = {
      ...data,
      ...totalUnits,
    };
    mqttpub(`${mqttTopicPrefix}/${stationname}/DDATA`, data2);
  } else {
    mqttpub(`${mqttTopicPrefix}/${stationname}/DDATA`, data);
  }

  // console.log(Plcdata);
});


const saveToMongoDBJob = scheduleJob("0,30 * * * *", () => {
  Plcdata.forEach((data, key) => { // Map's forEach method provides value first, then key
    if (key === 'Mark012') {
      saveToMongoDB(key, { ...data, ...totalUnits });
    } else {
      saveToMongoDB(key, data);
    }
  });
});




async function start() {
  await plcConnection.connectToPLC();
}

start();
