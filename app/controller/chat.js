/* eslint-disable no-undef */
/* eslint-disable prefer-const */
// app/controller/chat.js
const Controller = require('egg').Controller;
const { v4: uuidv4 } = require('uuid');
class ChatController extends Controller {
  // 连接socket
  async connect() {
    const { ctx, app } = this;
    if (!ctx.websocket) {
      ctx.throw(400, '非法访问');
    }
    ctx.websocket.on('close', (code, reason) => {
      // 用户下线
      console.log('用户下线', code, reason);
      let user_id = ctx.websocket.user_id;
      if (app.ws.user && app.ws.user[user_id]) {
        delete app.ws.user[user_id];
      }
    });
  }
  // 发送消息
  async send() {
    const { ctx, app } = this;
    // 用户id
    let current_user_id = ctx.authUser.id;
    // 验证参数
    ctx.validate({
      to_id: {
        type: 'int',
        require: true,
        desc: '接收人/群id',
      },
      chat_type: {
        type: 'string',
        require: true,
        range: { in: ['user', 'group'] },
        desc: '接收类型',
      },
      type: {
        type: 'string',
        require: true,
        range: { in: ['text', 'image', 'video', 'audio', 'emoji', 'card', 'position'] },
        desc: '消息类型',
      },
      data: {
        type: 'string',
        require: true,
        desc: '消息内容',
      },
      options: {
        type: 'string',
        require: true,
        desc: '其他',
      },
    });
    // 获取参数
    let { to_id, chat_type, type, data, options } = ctx.request.body;
    // 私聊
    if (chat_type === 'user') {
      // 验证好友是否存在，并且对方没有把你拉黑
      let Friend = await app.model.Friend.findOne({
        where: {
          user_id: to_id,
          friend_id: current_user_id,
          isblack: 0,
        },
        include: [
          {
            model: app.model.User,
            as: 'userInfo',
          },
          {
            model: app.model.User,
            as: 'friendInfo',
          },
        ],
      });
      let MyFriend = await app.model.Friend.findOne({
        where: {
          user_id: current_user_id,
          friend_id: to_id,
          isblack: 0,
        },
        include: [
          {
            model: app.model.User,
            as: 'userInfo',
          },
          {
            model: app.model.User,
            as: 'friendInfo',
          },
        ],
      });
      if (!MyFriend) {
        return ctx.apiFail('对方不是你的好友');
      }
      if (!Friend) {
        return ctx.apiFail('你不是对方的好友');
      }
      // 验证好友是否被禁用
      if (!Friend.userInfo.status) {
        return ctx.apiFail('对方已经被禁用');
      }
      // 构建消息格式
      let from_name = Friend.friendInfo.nickname ? Friend.friendInfo.nickname : Friend.friendInfo.username;
      if (Friend.nickname) {
        from_name = Friend.nickname;
      }
      let message = {
        message_id: uuidv4(), // 唯一id，后端生成唯一id
        from_avatar: Friend.friendInfo.avatar, // 发送者头像
        from_name, // 发送者昵称
        from_id: current_user_id, // 发送者id
        to_id, // 接收人id
        to_name: Friend.userInfo.nickname ? Friend.userInfo.nickname : Friend.userInfo.username, // 接收人/群 名称
        to_avatar: Friend.userInfo.avatar, // 接收人/群 头像
        chat_type: 'user', // 接收类型
        type, // 消息类型
        data, // 消息内容
        options: options || '{}', // 其他参数
        create_time: new Date().getTime() / 1000, // 创建时间
        isremove: 0, // 是否撤回
      };
      // 发送信息
      ctx.sendAndSaveMessage(to_id, message);
      // 返回成功
      return ctx.apiSuccess(message);
    }
    //  群聊
    if (chat_type === 'group') {
      const group = await ctx.model.Group.findOne({
        where: {
          status: 1,
          id: to_id,
        },
        include: [
          {
            model: app.model.GroupUser,
            attributes: ['user_id', 'nickname'],
          },
        ],
      });

      if (!group) {
        return ctx.apiFail('群聊不存在或已被封禁');
      }

      const index = group.group_users.findIndex(item => item.user_id === current_user_id);
      if (index === -1) {
        return ctx.apiFail('你不是该群的成员');
      }

      // 组织数据格式
      const from_name = group.group_users[index].nickname;
      const message = {
        message_id: uuidv4(), // 唯一id，后端生成唯一id
        from_avatar: ctx.authUser.avatar, // 发送人id
        from_name: from_name || ctx.authUser.nickname || ctx.authUser.username, // 发送人昵称
        from_id: current_user_id, // 发送人id
        to_id, // 接收人/群 id
        to_name: group.name, // 接收人/群 名称
        to_avatar: group.avatar, // 接收人/群 头像
        chat_type: 'group', // 接收类型
        type, // 消息类型
        data, // 消息内容
        options: options || '{}', // 其他参数
        create_time: new Date().getTime() / 1000, // 创建时间
        isremove: 0, // 是否撤回
        group,
      };

      // 推送消息
      group.group_users.forEach(item => {
        if (item.user_id !== current_user_id) {
          ctx.sendAndSaveMessage(item.user_id, message);
        }
      });
      ctx.apiSuccess(message);
    }
  }
  // 获取离线消息
  async getmessage() {
    const { ctx, service } = this;
    const current_user_id = ctx.authUser.id;
    const key = 'getmessage_' + current_user_id;
    const list = await service.cache.getList(key);
    // 清除离线消息
    await service.cache.remove(key);
    // 推送
    list.forEach(async item => {
      const message = JSON.parse(item);
      ctx.sendAndSaveMessage(current_user_id, message, 'offline_message');
    });
  }

  // 用户进入后台
  async backstage() {
    const { ctx, service } = this;
    const { backstage } = ctx.request.body;
    const current_user_id = ctx.authUser.id;
    const key = 'backstage_' + current_user_id;
    await service.cache.set(key, backstage);
  }
}
module.exports = ChatController;
