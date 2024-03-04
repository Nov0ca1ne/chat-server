const nodemailer = require('nodemailer');
const config = {
  host: 'smtp.qq.com',
  port: 465,
  auth: {
    user: '1833268234@qq.com', // 你的qq邮箱账号
    pass: 'txvdcjkoxvinbdhe', // 邮箱的授权码
  },
};

// 创建一个SMTP客户端对象
exports.transporter = nodemailer.createTransport(config);
