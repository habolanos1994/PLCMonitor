const sql = require('mssql');
const logError = require('./errorlog').logError;
const fs = require('fs');
const path = require('path');
const sourcefile = path.basename(__filename)

const sqlConfig = {
    user: 'SvcSmart_Ate_Write',
    password: '8kvmduhoyDAkHAlktBwb',
    database: 'SMART_ATE',
    server: 'CHY-MFGSTDSQL1',
    dialect: "mssql",
    options: {
        trustedConnection: true,
        trustServerCertificate: true,
        enableArithAbort: true,
        instancename: ''
    },
    port: 1433
};

let sqlPool;

async function connectToSql() {
  if (!sqlPool) {
    try {
      sqlPool = await sql.connect(sqlConfig);
    } catch (err) {
      logError(err,'connectToSql',sourcefile);
      console.error("Error connecting to SQL: ", err);
      sqlPool = null; // Reset the pool so we will try to connect again next time
      throw err;
    }
  }

  return sqlPool;
}

async function GetReceverydata() {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);

    const result = await request.query(`
            SELECT 
             PART_NUMBER
            ,DESCRIPTION
            ,MODEL
            ,RECOVER
            ,SITE
            
            FROM APE_SCRAP_RECOVERY_STATUS
    `);
    return result
  } catch (err) {
    logError(err,'GetReceverydata',sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function UpdateReceveryData(serial, part_number, model) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('recover', sql.Int, recover);
    request.input('part_number', sql.VarChar, part_number);
    request.input('model', sql.VarChar, model);
    const result = await request.query(`
    UPDATE 
        APE_SCRAP_RECOVERY_STATUS
         SET RECOVER = @recover
         WHERE PART_NUMBER = @part_number AND MODEL = @model
    `);
    return result
  } catch (err) {
    logError(err,'UpdateReceveryData',sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetWAPStatus(serial) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('serial', sql.VarChar, serial);

    const result = await request.query(`
    SELECT 
        failcode.FAILTEXT  AS 'Disposition'
        ,item.[MODEL_CODE] AS 'Model'
    FROM [SMART_ATE].[dbo].[ATE_ACCESSORY_STATIONS_DISPO] dispo
    INNER JOIN [SMART_ATE].[dbo].[ATE_ACCESSORY] item ON item.[ATE_ACCESSORY_ITEMS_MODELS_OBJID] = dispo.[ATE_ACCESSORY_ITEMS_MODELS_OBJID]
    INNER JOIN [SMART_ATE].[dbo].ATE_FAILCODES failcode on dispo.FAILTEXT = failcode.ATE_FAILCODES_OBJID
    where item.SERIAL_NUMBER=@serial and dispo.APE_MAIN_TV_OPERATION_OBJID = '32'
    `);
    return result
  } catch (err) {
    logError(err,'GetWAPStatus',sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}

async function GetEmployeeDetails(ntLogin) {
  try {
    const pool = await connectToSql();
    const request = new sql.Request(pool);
    request.input('nt_login', sql.VarChar, ntLogin);

    const result = await request.query(`
    SELECT TOP (1000) 
        [PERSON_ID],
        [EMPLOYEE_NUMBER],
        [FULL_NAME],
        [FIRST_NAME],
        [LAST_NAME],
        [NT_LOGIN]
    FROM [SMART_ATE].[dbo].[CPER_HR_EMPLOYEE_DETAILS]
    WHERE [NT_LOGIN]=@nt_login
    `);
    return result;
  } catch (err) {
    logError(err, 'GetEmployeeDetails', sourcefile);
    console.error("Error occurred: ", err);
    throw err;
  }
}


module.exports = { GetReceverydata, UpdateReceveryData, GetWAPStatus, GetEmployeeDetails,}
