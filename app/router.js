'use strict';

/**
 * @param {Egg.Application} app - egg application
 */
module.exports = app => {
  const { router, controller } = app;
  // 配置 WebSocket 全局中间件
  app.ws.use(async (ctx, next) => {
    // ctx.query.token
    // 验证用户token
    let user = {};
    const token = ctx.query.token;
    try {
      user = ctx.verifyToken(token);
      // 验证用户状态
      const userCheck = await app.model.User.findByPk(user.id);
      if (!userCheck) {
        ctx.websocket.send(
          JSON.stringify({
            msg: 'fail',
            data: '用户不存在',
          })
        );
        return ctx.websocket.close();
      }
      if (!userCheck.status) {
        ctx.websocket.send(
          JSON.stringify({
            msg: 'fail',
            data: '你已被禁用',
          })
        );
        return ctx.websocket.close();
      }
      // 用户上线
      app.ws.user = app.ws.user ? app.ws.user : {};
      // 下线其他设备
      if (app.ws.user[user.id]) {
        app.ws.user[user.id].send(
          JSON.stringify({
            msg: 'fail',
            data: '你的账号在其他设备登录',
          })
        );
        app.ws.user[user.id].close();
      }
      // 记录当前用户id
      ctx.websocket.user_id = user.id;
      app.ws.user[user.id] = ctx.websocket;
      await next();
    } catch (err) {
      console.log(err);
      const fail = err.name === 'TokenExpiredError' ? 'token 已过期! 请重新获取令牌' : 'Token 令牌不合法!';
      ctx.websocket.send(
        JSON.stringify({
          msg: 'fail',
          data: fail,
        })
      );
      // 关闭连接
      ctx.websocket.close();
    }
  });
  app.ws.route('/ws', controller.chat.connect);
  // 发送邮箱验证码
  router.get('/sendmail', controller.yzm.sendMail);
  // 注册
  router.post('/register', controller.user.register);
  // 登录
  router.post('/login', controller.user.login);
  // 退出登录
  router.post('/logout', controller.user.logout);
  // 用户名是否存在
  router.post('/check_username', controller.user.checkUserName);
  // 邮箱是否存在
  router.post('/check_email', controller.user.checkEmail);
  // 忘记密码
  router.post('/forget_password', controller.user.forgetPassword);
  // 搜索用户
  router.post('/search_user', controller.user.searchUser);
  // 添加好友
  router.post('/apply/add_friend', controller.apply.addFriend);
  // 获取申请列表
  router.get('/apply/apply_list', controller.apply.applyList);
  // 处理申请
  router.post('/apply/apply_handle/:id', controller.apply.applyHandle);
  // 获取好友列表
  router.get('/friend/get_list', controller.friend.getList);
  // 获取好友信息
  router.get('/friend/get_info/:id', controller.friend.getInfo);
  // 设置黑名单
  router.post('/friend/set_black/:id', controller.friend.setBlack);
  // 设置特别关心
  router.post('/friend/set_focus/:id', controller.friend.setFocus);
  // 设置动态权限
  router.post('/friend/set_moment_auth/:id', controller.friend.setMomentAuth);
  // 举报好友
  router.post('/report/friend', controller.report.reportFriend);
  // 获取用户所有标签
  router.get('/friend/get_alltag', controller.friend.getAllTag);
  // 设置备注和标签
  router.post('/friend/set_remark_tag/:id', controller.friend.setRemarkAndTag);
  // 删除好友
  router.post('/friend/destroy', controller.friend.destroy);
  // 发送消息
  router.post('/chat/send', controller.chat.send);
  // 文件上传
  router.post('/upload', controller.minio.upload);
  router.post('/upload_base64', controller.minio.uploadBase64);
  // 创建收藏
  router.post('/favorite/create', controller.fava.create);
  // 获取收藏
  router.get('/favorite/get_list', controller.fava.list);
  // 删除收藏
  router.post('/favorite/destroy', controller.fava.destroy);
  // 修改用户资料
  router.post('/user/update_info', controller.user.updateInfo);
  // 创建群聊
  router.post('/group/create', controller.group.createGroup);
  // 加入群聊
  router.post('/group/join_group', controller.group.joinGroup);
  // 获取群聊列表
  router.get('/group/get_list', controller.group.getGroupList);
  // 获取群人数
  router.get('/group/get_num/:id', controller.group.getGroupNum);
  // 获取群信息
  router.get('/group/get_info/:id', controller.group.getGroupInfo);
  // 获取群信息（扫码）
  router.get('/group/get_info_code/:id', controller.group.getGroupInfoByCode);
  // 修改群名称
  router.post('/group/rename', controller.group.rename);
  // 生成群二维码
  router.get('/group/qrcode/:id', controller.group.qrcode);
  // 生成个人二维码
  router.get('/user/qrcode/:id', controller.user.qrcode);
  // 解散或退出群聊
  router.post('/group/quit_group', controller.group.quitGroup);
  // 修改在群聊的昵称
  router.post('/group/update_nickname', controller.group.updateNickname);
  // 获取离线消息
  router.post('/chat/getmessage', controller.chat.getmessage);
  // 进入后台
  router.post('/chat/backstage', controller.chat.backstage);
};
