'use strict';
const { Controller } = require('egg');
const { v4: uuidv4 } = require('uuid');
class GroupController extends Controller {
  async createGroup() {
    const { ctx } = this;
    const current_user_id = ctx.authUser.id;
    ctx.validate({
      ids: {
        type: 'array',
        required: true,
        desc: '用户id',
      },
    });
    const { ids } = ctx.request.body;
    // 验证是否为好友
    const friends = await this.ctx.model.Friend.findAll({
      where: {
        user_id: current_user_id,
        friend_id: ids,
      },
      include: [
        {
          model: this.ctx.model.User,
          as: 'friendInfo',
          attributes: ['nickname', 'username', 'avatar'],
        },
      ],
    });
    if (friends.length === 0) {
      ctx.throw('请选择需要添加的好友');
    }
    // 拿到好友昵称
    const names = friends.map(item => item.friendInfo.nickname || item.friendInfo.username);
    // 加入自己的名字
    names.push(ctx.authUser.nickname || ctx.authUser.username);
    const groupName = names.join('，');
    // 拿到加入的用户的头像，生成群头像
    let avatars = friends.map(item => item.friendInfo.avatar);
    // 加入自己的头像
    avatars.push(ctx.authUser.avatar);
    // 过滤有效头像（没头像的去掉）
    avatars = avatars.filter(item => item);
    // 如果大于9张则随机取9张
    if (avatars.length > 9) {
      avatars = avatars.sort(() => Math.random() - 0.5).slice(0, 9);
    }

    // 生成群头像
    const avatar = await this.ctx.service.groupAvatar.generateGripImage(avatars);
    // 创建群聊
    const group = await this.ctx.model.Group.create({
      name: groupName,
      avatar,
      user_id: current_user_id,
    });

    // 加入群聊的用户
    const groupUser = friends.map(item => {
      return {
        user_id: item.friend_id,
        group_id: group.id,
      };
    });
    // 加入自己
    groupUser.unshift({ user_id: current_user_id, group_id: group.id });
    // 创建
    await this.ctx.model.GroupUser.bulkCreate(groupUser);
    // 获取群成员头像
    const avatarList = friends.map(item => {
      return {
        user_id: item.friend_id,
        avatar: item.friendInfo.avatar,
      };
    });
    // 加入自己
    avatarList.unshift({ user_id: current_user_id, avatar: ctx.authUser.avatar });
    // 消息推送
    const message = {
      message_id: uuidv4(), // 唯一id，后端生成唯一id
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name: ctx.authUser.nickname || ctx.authUser.username, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人 id
      to_name: group.name, // 接收人昵称
      to_avatar: group.avatar, // 接收人头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: '创建群聊成功，可以开始聊天啦', // 消息内容
      options: '{}', // 其他参数
      create_time: new Date().getTime() / 1000, // 消息创建时间
      isremove: 0, // 是否撤回
      group,
      avatarList,
    };
    groupUser.forEach(item => {
      // 发送消息
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    ctx.apiSuccess('创建群聊成功');
  }
  async joinGroup() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
    });
    const { id } = ctx.request.body;
    // 群聊是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
        status: 1,
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
    // 是否是群成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);

    if (index !== -1) {
      return ctx.apiFail('您已是该群成员');
    }

    // 加入群聊
    const groupUser = await app.model.GroupUser.create({
      group_id: id,
      user_id: current_user_id,
    });

    if (!groupUser) {
      return ctx.apiFail('加入群聊失败');
    }
    // 消息推送
    const from_name = ctx.authUser.nickname || ctx.authUser.username;
    const message = {
      message_id: uuidv4(), // 唯一id，后端生成唯一id
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人 id
      to_name: group.name, // 接收人昵称
      to_avatar: group.avatar, // 接收人头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: `${from_name} 加入群聊`, // 消息内容
      options: '{}', // 其他参数
      create_time: new Date().getTime() / 1000, // 消息创建时间
      isremove: 0, // 是否撤回
      group,
    };
    group.group_users.forEach(item => {
      // 发送消息
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    // 向自己推送消息
    ctx.sendAndSaveMessage(current_user_id, message);

    ctx.apiSuccess('ok');
  }
  async getGroupList() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    let { page = 1, limit = 10 } = ctx.query;
    page = page ? parseInt(page) : 1;
    limit = limit ? parseInt(limit) : 1;
    const offset = (page - 1) * limit;
    const rows = await app.model.Group.findAll({
      where: { status: 1 },
      include: [
        {
          model: app.model.GroupUser,
          where: { user_id: current_user_id },
        },
      ],
      offset,
      limit,
    });

    return ctx.apiSuccess(rows);
  }
  // 群聊人数
  async getGroupNum() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 验证参数
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
    });
    const { id } = ctx.params;
    // 群聊是否存在
    const group = await app.model.Group.findOne({
      where: {
        status: 1,
        id,
      },
      include: [
        {
          model: app.model.GroupUser,
          attributes: ['user_id'],
        },
      ],
    });

    if (!group) {
      return ctx.apiFail('群聊不存在或已被封禁');
    }

    // 当前用户是否是该群成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) {
      return ctx.apiFail('您不是该群成员');
    }
    ctx.apiSuccess(group.group_users.length);
  }
  // 群聊信息
  async getGroupInfo() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 验证参数
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
    });
    const { id } = ctx.params;
    // 群聊是否存在
    const group = await app.model.Group.findOne({
      where: {
        status: 1,
        id,
      },
      include: [
        {
          model: app.model.GroupUser,
          attributes: ['user_id', 'nickname'],
          include: [
            {
              model: app.model.User,
              attributes: ['id', 'nickname', 'avatar', 'username'],
            },
          ],
        },
      ],
    });

    if (!group) {
      return ctx.apiFail('群聊不存在或已被封禁');
    }

    // 当前用户是否是该群成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) {
      return ctx.apiFail('您不是该群成员');
    }

    ctx.apiSuccess(group);
  }

  // 群聊信息（扫码）
  async getGroupInfoByCode() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 验证参数
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
    });
    const { id } = ctx.params;
    // 群聊是否存在
    const group = await app.model.Group.findOne({
      where: {
        status: 1,
        id,
      },
      include: [
        {
          model: app.model.GroupUser,
          attributes: ['user_id', 'nickname'],
          include: [
            {
              model: app.model.User,
              attributes: ['id', 'nickname', 'avatar', 'username'],
            },
          ],
        },
      ],
    });

    if (!group) {
      return ctx.apiFail('群聊不存在或已被封禁');
    }
    let isGroupUser = true;
    // 当前用户是否是该群成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) {
      isGroupUser = false;
    }
    // group.isGroupUser = isGroupUser;
    ctx.apiSuccess({ group, isGroupUser });
  }
  // 修改群名字
  async rename() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
      name: {
        required: true,
        type: 'string',
        desc: '群聊名称',
      },
    });
    const { id, name } = ctx.request.body;
    // 群聊是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
        status: 1,
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
    // 是否是群成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);

    if (index === -1) {
      return ctx.apiFail('您不是该群成员');
    }
    if (group.user_id !== current_user_id) {
      return ctx.apiFail('只有群主才能修改群名称');
    }
    // 修改群名称
    group.name = name;
    await group.save();

    // 消息推送
    const from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
    const message = {
      message_id: uuidv4(), // 唯一id，后端生成唯一id
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人 id
      to_name: group.name, // 接收人昵称
      to_avatar: group.avatar, // 接收人头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: `${from_name} 修改群名称为 ${name}`, // 消息内容
      options: '{}', // 其他参数
      create_time: new Date().getTime() / 1000, // 消息创建时间
      isremove: 0, // 是否撤回
      group,
    };
    group.group_users.forEach(item => {
      // 发送消息
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    ctx.apiSuccess('ok');
  }
  // 修改我在本群中的昵称
  async updateNickname() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
      nickname: {
        required: false,
        type: 'string',
        desc: '在本群昵称',
        defValue: '',
      },
    });
    const { id, nickname } = ctx.request.body;
    const group = await app.model.Group.findOne({
      where: {
        id,
        status: 1,
      },
      include: [
        {
          model: app.model.GroupUser,
          attributes: ['user_id', 'nickname'],
        },
      ],
    });
    if (!group) {
      return ctx.apiFail('该群聊不存在或已被封禁');
    }
    // 是否是该群聊成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) {
      return ctx.apiFail('您不是该群聊成员');
    }
    // 修改昵称
    const group_user = await app.model.GroupUser.findOne({
      where: {
        user_id: current_user_id,
        group_id: group.id,
      },
    });
    if (group_user) {
      await group_user.update({
        nickname,
      });
    }
    return ctx.apiSuccess('ok');
  }
  // 解散并退出群聊
  async quitGroup() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      id: {
        required: true,
        type: 'int',
        desc: '群聊id',
      },
    });
    const { id } = ctx.request.body;
    // 群聊是否存在
    const group = await app.model.Group.findOne({
      where: {
        id,
      },
      include: [
        {
          model: app.model.GroupUser,
          attributes: ['user_id', 'nickname'],
        },
      ],
    });
    if (!group) {
      return ctx.apiFail('该群聊不存在');
    }
    // 你是否是该群聊成员
    const index = group.group_users.findIndex(item => item.user_id === current_user_id);
    if (index === -1) {
      return ctx.apiFail('您不是该群聊成员');
    }
    // 消息推送
    const from_name = group.group_users[index].nickname || ctx.authUser.nickname || ctx.authUser.username;
    const message = {
      message_id: uuidv4(), // 唯一id，后端生成唯一id
      from_avatar: ctx.authUser.avatar, // 发送者头像
      from_name, // 发送者昵称
      from_id: current_user_id, // 发送者id
      to_id: group.id, // 接收人 id
      to_name: group.name, // 接收人昵称
      to_avatar: group.avatar, // 接收人头像
      chat_type: 'group', // 接收类型
      type: 'system', // 消息类型
      data: '', // 消息内容
      options: '{}', // 其他参数
      create_time: new Date().getTime() / 1000, // 消息创建时间
      isremove: 0, // 是否撤回
      group,
    };
    if (group.user_id === current_user_id) {
      // 解散群
      await app.model.Group.destroy({
        where: {
          id: group.id,
        },
      });
      message.data = '该群已被解散';
    } else {
      // 退出群
      await app.model.GroupUser.destroy({
        where: {
          user_id: current_user_id,
          group_id: group.id,
        },
      });
      message.data = `${from_name} 退出该群聊`;
    }
    group.group_users.forEach(item => {
      // 发送消息
      ctx.sendAndSaveMessage(item.user_id, message);
    });
    ctx.apiSuccess('ok');
  }

  // 生成群二维码
  async qrcode() {
    const { ctx } = this;
    ctx.qrcode(
      JSON.stringify({
        id: ctx.params.id,
        type: 'group',
        event: 'navigateTo',
      })
    );
  }
}
module.exports = GroupController;
