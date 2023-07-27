const nodemailer = require("nodemailer");
const fs = require('fs');
const path = require('path');

let emailfile = path.join(__dirname, "./jsonfiles/smtpconf.json");

async function sendsmtp(smtpmessage) {
  //console.log(smtpmessage)
  let emailsetup = fs.readFileSync(emailfile, 'utf-8');
  let smtpConfig = JSON.parse(emailsetup);
  let smtpto = smtpConfig.Sendto.map(item => item.email).join(', ');

  // SMTP config
  const transporter = nodemailer.createTransport({
    host: "smtp.global.dish.com",
    tls: {
      rejectUnauthorized: false,
    },
    port: 25,
    secure: false,
    auth: {
      user: "", // Your Ethereal Email address
      pass: "", // Your Ethereal Email password
    },
  }); 

  // Send the email
  let info = await transporter.sendMail({
    from: '"Test2Engineer" <smtp@ElpTE.dish.com>',
    to: smtpto, // Test email addresses from the JSON file
    subject: "automated smtep email from CHY-ELPLABVEWP1.echostar.com",
    text: smtpmessage,
  });
  
  const result = info.accepted.toString();
  console.log("Message sent: %s", info.messageId); // Output message ID
}

module.exports = { sendsmtp }
