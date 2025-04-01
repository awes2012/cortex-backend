const nodemailer = require('nodemailer');

const emailUser = process.env.EMAIL_USER
const emailPassword = process.env.EMAIL_PASSWORD
const { Log } = require('@app/services/log.service')

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: emailUser,
        pass: emailPassword
    }
});

const demoOptions = {
    from: 'hello@example.com',
    to: 'reciever@gmail.com',
    subject: 'Subject',
    text: 'Email content'
};

function sendEmail(mailOptions) {
    const emailOptions = {
        ...mailOptions,
        from: emailUser,
    }
    return new Promise((resolve, reject) => {
        transporter.sendMail(emailOptions, function (error, info) {
            if (error) {
                Log.info('=== sending email error ===', error)
                reject(error)
            } else {
                resolve(info.response)
            }
        });
    })

}
module.exports = {
    sendEmail
}

