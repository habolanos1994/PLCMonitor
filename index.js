const fs = require("fs");
const path = require("path");
const { Worker } = require("worker_threads");
const errlog = require("./errorlog");

const sourcefile = path.basename(__filename);

const plcConfigsFile = path.join(__dirname, "plc-configs.json");
const plcConfigs = JSON.parse(fs.readFileSync(plcConfigsFile));

plcConfigs.forEach((config) => {
  const { plcName, plcIpAddress, tagConfigsFile, emissionFrequency, Plant, Area, Line, ControllerType } = config;

  const tagConfigsFilepath = path.join(__dirname, tagConfigsFile);
  const tagConfigs = JSON.parse(fs.readFileSync(tagConfigsFilepath));

  let workerScript;

  if (ControllerType === "ControlLogix") {
    workerScript = "plc-worker.js";
  } else if (ControllerType === "AnotherType") {
    workerScript = "another-worker.js"; // replace with your actual script
  } else {
    errlog.logError('Skip if controller type function does not exist', sourcefile, `plcConfigs.forEach`)
    return; // Skip if controller type function does not exist
  }

  const worker = new Worker(path.join(__dirname, workerScript), {
    workerData: {
      plcName,
      plcIpAddress,
      tagConfigs,
      emissionFrequency,
      Plant,
      Area,
      Line,
    },
  });

  worker.on("error", (error) => {
    console.error(`Error in PLC ${plcName}:`, error);
    errlog.logError(error, sourcefile, `Error in PLC ${plcName}:`)
  });

  worker.on("exit", (code) => {
    if (code !== 0) {
      console.error(`PLC ${plcName} worker stopped with exit code ${code}`);
      errlog.logError(code, sourcefile, `PLC ${plcName} worker stopped with exit code ${code}`)
    }
  });
});

