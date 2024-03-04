'use strict';
const { Controller } = require('egg');
const { v4: uuidv4 } = require('uuid');
class ApplyController extends Controller {
  // 添加好友
  async addFriend() {
    const { ctx } = this;
    const current_user_id = ctx.authUser.id;
    // 1.参数验证
    ctx.validate({
      friend_id: {
        type: 'int',
        required: true,
        desc: '好友id',
      },
      nickname: { type: 'string', required: false, desc: '备注' },
      lookme: { type: 'int', required: true, range: { in: [0, 1] }, desc: '看我动态' },
      lookhim: { type: 'int', required: true, range: { in: [0, 1] }, desc: '看他动态' },
    });
    const { friend_id, nickname, lookme, lookhim } = ctx.request.body;
    // 2.不能添加自己
    if (current_user_id === friend_id) {
      ctx.throw(400, '不能添加自己');
    }
    // 3.对方是否存在或被禁用
    const user = await ctx.model.User.findOne({
      where: { id: friend_id, status: 1 },
    });
    if (!user) {
      ctx.throw(400, '用户不存在或被禁用');
    }
    //   4.是否申请过了
    const apply = await ctx.model.Apply.findOne({
      where: { user_id: current_user_id, friend_id, status: ['pending', 'agree'] },
    });
    if (apply) {
      ctx.throw(400, '您已申请过了');
    }
    // 5.创建申请
    const result = await ctx.model.Apply.create({
      user_id: current_user_id,
      friend_id,
      nickname,
      lookme,
      lookhim,
    });
    if (!result) {
      ctx.throw(400, '申请失败');
    }
    ctx.apiSuccess(result);

    // 消息推送
    if (this.app.ws.user && this.app.ws.user[friend_id]) {
      this.app.ws.user[friend_id].send(JSON.stringify({ msg: 'updateApplyList' }));
    }
  }
  //   好友申请列表
  async applyList() {
    const { ctx, app } = this;
    let { page, limit } = ctx.query;
    page = page ? parseInt(page) : 1;
    limit = limit ? parseInt(limit) : 1;
    const offset = (page - 1) * limit;
    const current_user_id = ctx.authUser.id;
    const res = await ctx.model.Apply.findAll({
      where: {
        friend_id: current_user_id,
      },
      //   关联User表
      include: [{ model: app.model.User, attributes: ['id', 'username', 'nickname', 'avatar', 'sex'] }],
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });
    const count = await ctx.model.Apply.count({
      where: {
        friend_id: current_user_id,
        status: 'pending',
      },
    });
    ctx.apiSuccess({ list: res, count });
  }
  //   处理好友申请
  async applyHandle() {
    const { ctx, app } = this;
    const { status, nickname, lookhim, lookme } = ctx.request.body;
    const current_user_id = ctx.authUser.id;
    const id = ctx.params.id;
    // 参数验证
    ctx.validate({
      status: {
        type: 'string',
        required: true,
        range: ['refuse', 'agree', 'ignore'],
        desc: '处理结果',
      },
      nickname: { type: 'string', required: false, desc: '备注' },
      lookme: { type: 'int', required: true, range: { in: [0, 1] }, desc: '看我动态' },
      lookhim: { type: 'int', required: true, range: { in: [0, 1] }, desc: '看他动态' },
    });
    // 查询该申请是否存在
    const apply = await ctx.model.Apply.findOne({
      where: {
        id,
        friend_id: current_user_id,
        status: 'pending',
      },
      include: [
        {
          model: app.model.User,
        },
      ],
    });
    if (!apply) {
      ctx.throw('该申请不存在');
    }
    let transaction;
    try {
      // 开启事务
      transaction = await app.model.transaction();

      await apply.update({ status }, { transaction });
      if (status === 'agree') {
        // 查询好友是否存在（避免出现两个人同时点同意，插入两遍的情况）
        // 你的好友是否有对方
        const myFriend = await ctx.model.Friend.findOne({
          where: { user_id: current_user_id, friend_id: apply.user_id },
        });
        // 对方好友是否有你
        const friend = await ctx.model.Friend.findOne({
          where: { user_id: apply.user_id, friend_id: current_user_id },
        });
        // 将对方加入你的好友列表
        if (!myFriend) {
          await ctx.model.Friend.create(
            {
              user_id: current_user_id,
              friend_id: apply.user_id,
              nickname,
              lookme,
              lookhim,
            },
            { transaction }
          );
        }
        // 将自己加入到对方好友列表
        if (!friend) {
          await ctx.model.Friend.create(
            {
              user_id: apply.user_id,
              friend_id: current_user_id,
              nickname: apply.nickname,
              lookme: apply.lookme,
              lookhim: apply.lookhim,
            },
            { transaction }
          );
        }
      }
      // 提交事务
      await transaction.commit();
      // 消息推送
      if (status === 'agree') {
        const message = {
          message_id: uuidv4(), // 唯一id，后端生成唯一id
          from_avatar: ctx.authUser.avatar, // 发送者头像
          from_name: apply.nickname || ctx.authUser.nickname || ctx.authUser.username, // 发送者昵称
          from_id: current_user_id, // 发送者id
          to_id: apply.user_id, // 接收人 id
          to_name: nickname || apply.user.nickname || apply.user.username, // 接收人昵称
          to_avatar: apply.user.avatar, // 接收人头像
          chat_type: 'user', // 接收类型
          type: 'text', // 消息类型
          data: '我通过了你的朋友验证请求，现在我们可以开始聊天了', // 消息内容
          options: '{}', // 其他参数
          create_time: new Date().getTime() / 1000, // 消息创建时间
          isremove: 0, // 是否撤回
        };
        ctx.sendAndSaveMessage(apply.user_id, message);

        // 给自己推送
        ctx.sendAndSaveMessage(current_user_id, message);
      }

      return ctx.apiSuccess('操作成功');
    } catch (e) {
      // 事物回滚
      await transaction.rollback();
      return ctx.apiFail('操作失败');
    }
  }
}
module.exports = ApplyController;
