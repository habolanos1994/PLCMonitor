const fs = require('fs').promises;
const moment = require('moment');
const MAX_LOG_ENTRIES = 5000;

async function logError(errorMessage, sourcefile, sourcefunction) {
    // Format the current time
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');

    // Format the error message with the timestamp, function, and file
    const logMessage = `${timestamp}, ${sourcefile}, ${sourcefunction}, ${errorMessage}`; // removed the \n here

    try {
        // Read the current log file
        const data = await fs.readFile('errorlog.csv', 'utf8');

        // Split the log file into lines
        let logLines = data.split('\n');

        // Check if the log file has reached its maximum number of entries
        if (logLines.length >= MAX_LOG_ENTRIES) {
            // Remove the earliest log entries
            logLines = logLines.slice(logLines.length - MAX_LOG_ENTRIES);
        }

        // Add the new log message
        logLines.push(logMessage);

        // Write the log lines back to the file, adding \n only between entries
        await fs.writeFile('errorlog.csv', logLines.join('\n'));
    } catch(err) {
        console.log('Error handling the log file: ', err);
    }
}

module.exports = { logError }




