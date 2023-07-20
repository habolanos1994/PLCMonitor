const fs = require("fs").promises;
const path = require("path");
const util = require('util');
const exec = util.promisify(require('child_process').exec);


async function readConfigAndTagFiles() {
    const configData = await fs.readFile(path.join(__dirname, "plc-configs.json"));
    const plcConfigs = JSON.parse(configData);
    const results = [];
  
    for (const config of plcConfigs) {
      const rawData = await fs.readFile(path.join(__dirname, config.tagConfigsFile));
      const tagData = JSON.parse(rawData);
      results.push({
        plcName: config.plcName,
        tagData
      });
    }
  
    return results;  // Return the result
  }
  

  async function DataCollectorStatus() {
    try {
      const { stdout, stderr } = await exec("sudo systemctl status DataCollectorPLC.service");
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return stderr;
      }
      return stdout;
    } catch (error) {
      console.error(`exec error: ${error}`);
      return error.message;
    }
}

  async function DataCollectorRestart() {
    try {
      const { stdout, stderr } = await exec("sudo systemctl restart DataCollectorPLC.service");
      if (stderr) {
        console.error(`stderr: ${stderr}`);
        return stderr;
      }
      return stdout;
    } catch (error) {
      console.error(`exec error: ${error}`);
      return error.message;
    }
  }
  
  
module.exports = {readConfigAndTagFiles, DataCollectorStatus, DataCollectorRestart}