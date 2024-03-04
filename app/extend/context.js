const qr = require('qr-image');

// 封装api返回格式
module.exports = {
  // 成功提示
  apiSuccess(data = '', msg = 'ok', code = 200) {
    this.body = { msg, data };
    this.status = code;
  },
  // 失败提示
  apiFail(data = '', msg = 'fail', code = 400) {
    this.body = { msg, data };
    this.status = code;
  },
  // 生成Token
  getToken(user) {
    return this.app.jwt.sign(user, this.app.config.jwt.secret);
  },
  // 验证Token
  verifyToken(token) {
    return this.app.jwt.verify(token, this.app.config.jwt.secret);
  },

  async sendAndSaveMessage(to_id, message, msg = 'ok') {
    const { app, service } = this;
    const current_user_id = this.authUser.id;
    // 拿到对方的socket
    const socket = app.ws.user[to_id];
    // 用户是否进入后台
    const backstage = await service.cache.get(`backstage_${to_id}`);
    // 验证对方是否在线，不在线记录到待接收消息队列中 在线：消息推送 存储到对方的聊天记录中 chatlog_对方用户id_user_当前用户id
    if (!socket || backstage) {
      service.cache.setList('getmessage_' + to_id, message);
    }
    if (socket) {
      // 消息推送
      socket.send(
        JSON.stringify({
          msg,
          data: message,
        })
      );
      // 存到对方聊天记录中
      service.cache.setList(`chatlog_${to_id}_user_${current_user_id}`, message);
    }
    // 存储到自己的聊天记录中
    service.cache.setList(`chatlog_${current_user_id}_user_${to_id}`, message);
  },

  // 生成二维码
  qrcode(data) {
    const image = qr.image(data, { size: 10 });
    this.response.type = 'image/png';
    this.body = image;
  },
};
