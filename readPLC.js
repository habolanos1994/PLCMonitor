const { Controller } = require("st-ethernet-ip");
const fs = require("fs");
const encoder = new TextDecoder();
const { sendsmtp } = require("./smtp");
const EventEmitter = require('events');
const errlog = require("./errorlog");
const path = require('path');
const sourcefile = path.basename(__filename);



class PLC extends EventEmitter {
  constructor(plcName, plcIpAddress, tagConfigs, emissionFrequency, reconnectAttempts = 10, maxReconnectDelay = 1200000) {
    super();  // important: call the parent constructor
    this.PLC = new Controller({ timeout: 5000 });
    this.plcName = plcName; // added plcName property
    this.plcIpAddress = plcIpAddress;
    this.tagConfigs = tagConfigs;
    this.tags = tagConfigs.map((config) => this.PLC.newTag(config.name));
    this.reconnectAttempts = reconnectAttempts;
    this.maxReconnectDelay = maxReconnectDelay;
    this.values = {};
    this.ErrorSet = new Set();
    this.groupCounters = {};
    this.emissionFrequency = emissionFrequency;

    this.PLC.on('Disconnected', () => {
      sendsmtp(`Mqtt service plc Report Plc disconnected`)
      this.emit('disconnected');
    });

    this.PLC.on('Error', (err) => {
      sendsmtp(`Mqtt service plc Report Plc Error: ${err}`)
      errlog.logError(err, sourcefile, ' this.PLC.on(Error')
      this.reconnectAttempts++;
      this.emit('error', err);
    });
  }

  async readTagsAndUpdateValues() {
    // Reset this.values at the start of each read cycle
    this.values = {};
    
    for (let i = 0; i < this.tags.length; i++) {
        const tag = this.tags[i];
        const config = this.tagConfigs[i];
        const Index1 = config.Index1;
        const Index2 = config.Index2;
        const stationName = config.StationName;
        let tagValue;

        // Initialize if undefined
        if (!this.values[stationName]) {
            this.values[stationName] = {};
        }

        if (Index1 && !this.values[stationName][Index1]) {
            this.values[stationName][Index1] = { values: {} };
        }

        if (Index2 && !this.values[stationName][Index1].values[Index2]) {
            this.values[stationName][Index1].values[Index2] = {};
        }

        try {
            // Read tag
            await this.PLC.readTag(tag);

            if (tag.value instanceof Buffer) {
                const arr = new Uint8Array(tag.value);
                const slicedArr = arr.slice(1); // Slice the array starting from the second byte
                const filteredArr = slicedArr.filter(byte => byte !== 0); // Remove all null bytes (0x00)
                const str = encoder.decode(filteredArr);
                tagValue = str;
            } else {
                tagValue = tag.value;
            }
        } catch (error) {
             errlog.logError(error, sourcefile, 'readTagsAndUpdateValues')
            const errorMessage = `PLC ${this.plcName}: Error reading tag '${config.name}': ${error.message}`;
            this.ErrorSet.add(errorMessage);
            console.error(errorMessage);
            tagValue = null; // assign null value if there is an error
        }

        if (Index2) {
            this.values[stationName][Index1].values[Index2][config.alias] = tagValue;
        } else {
            this.values[stationName][Index1].values[config.alias] = tagValue;
        }
    }

    if (Object.keys(this.values).length === 0) {
        console.log('No tags were read. Attempting to reconnect...');
        errlog.logError('No tags were read. Attempting to reconnect...', sourcefile, 'readTagsAndUpdateValues')
        this.ErrorSet.add('No tags were read. Attempting to reconnect...');
        this.emit('error', new Error('No tags were read. Attempting to reconnect...'));
    } else {
        // Emit 'tagsRead' event for each station
        for (const stationName in this.values) {
            const data = {
                StationName: stationName,
                ...this.values[stationName],
            };
            this.emit('tagsRead', data);
        }
    }

    // Schedule the next reading
    setTimeout(() => {
        this.readTagsAndUpdateValues();
    }, this.emissionFrequency);
}

  
  

  async connectToPLC() {
    try {
      await this.PLC.connect(this.plcIpAddress, 0);
      await this.readTagsAndUpdateValues();
      console.log(`Connected to PLC ${this.plcName}`);
    } catch (error) {
      errlog.logError(error, sourcefile, 'connectToPLC')
      if(this.reconnectAttempts > 0) {
        this.reconnectAttempts--;
        console.log(`Retrying connection. Attempts remaining: ${this.reconnectAttempts}`);
        // Wait for some delay before reconnecting, can use your maxReconnectDelay or some other value
        setTimeout(() => this.connectToPLC(), this.maxReconnectDelay);
      } else {
        sendsmtp(`Mqtt service plc Report Plc Error: ${error}`);
        this.emit('error', error);
      }
    }
}

}

module.exports = PLC;
