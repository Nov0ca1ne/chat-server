'use strict';
const { Controller } = require('egg');
const SortWord = require('sort-word');
class FriendController extends Controller {
  // 获取好友列表
  async getList() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    const friends = await ctx.model.Friend.findAndCountAll({
      where: { user_id: current_user_id },
      include: [
        {
          model: app.model.User,
          as: 'friendInfo',
          attributes: ['id', 'username', 'nickname', 'avatar'],
        },
      ],
    });
    const res = friends.rows.map(item => {
      let name = item.friendInfo.nickname || item.friendInfo.username;
      // 如果有备注
      if (item.nickname) {
        name = item.nickname;
      }
      return {
        id: item.id,
        user_id: item.friendInfo.id,
        name,
        username: item.friendInfo.username,
        avatar: item.friendInfo.avatar,
      };
    });
    // 排序
    if (res.length > 0) {
      friends.rows = new SortWord(res, 'name');
    }

    ctx.apiSuccess(friends);
  }
  //   查看用户资料
  async getInfo() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    const { id } = ctx.params;
    const user = await ctx.model.User.findOne({
      where: {
        id,
        status: 1,
      },
      attributes: {
        exclude: ['password'],
      },
    });
    if (!user) {
      ctx.throw('用户不存在');
    }
    const res = {
      id: user.id,
      username: user.username,
      nickname: user.nickname ? user.nickname : user.username,
      avatar: user.avatar,
      sex: user.sex,
      sign: user.sign,
      area: user.area,
      friend: false,
    };
    const friend = await ctx.model.Friend.findOne({
      where: {
        user_id: current_user_id,
        friend_id: id,
      },
      include: [
        {
          model: app.model.Tag,
          attributes: ['name'],
        },
      ],
    });

    // 如果是好友，返回信息不同
    let data = {};
    if (friend) {
      data = {
        ...res,
        nickname: friend.nickname ? friend.nickname : res.nickname,
        friend: true,
        lookhim: friend.lookhim,
        lookme: friend.lookme,
        focus: friend.focus,
        isblack: friend.isblack,
        tags: friend.tags.map(item => item.name),
      };
      ctx.apiSuccess(data);
      return;
    }
    ctx.apiSuccess(res);
  }
  // 拉黑好友
  async setBlack() {
    const { ctx } = this;
    const current_user_id = ctx.authUser.id;
    const { id } = ctx.params;
    // 参数验证
    ctx.validate({
      isblack: {
        type: 'int',
        required: true,
        range: [0, 1],
        desc: '移入/移出黑名单',
      },
    });
    const friend = await ctx.model.Friend.findOne({
      where: { user_id: current_user_id, friend_id: id },
    });

    if (!friend) {
      ctx.throw('该用户不是你的好友');
    }

    const { isblack } = ctx.request.body;
    // friend.isblack = isblack;
    // await friend.save();
    await friend.update({ isblack });

    ctx.apiSuccess('ok');
  }
  // 设置特别关心
  async setFocus() {
    const { ctx } = this;
    const current_user_id = ctx.authUser.id;
    const { id } = ctx.params;

    // 参数验证
    ctx.validate({
      focus: {
        type: 'int',
        required: true,
        range: [0, 1],
        desc: '特别关心',
      },
    });
    const friend = await ctx.model.Friend.findOne({
      where: { user_id: current_user_id, friend_id: id, isblack: 0 },
    });

    if (!friend) {
      ctx.throw('该用户不是你的好友或该好友已被拉黑');
    }

    const { focus } = ctx.request.body;

    await friend.update({ focus });

    ctx.apiSuccess('ok');
  }
  // 设置动态权限
  async setMomentAuth() {
    const { ctx } = this;
    const current_user_id = ctx.authUser.id;
    const { id } = ctx.params;
    // 参数验证
    ctx.validate({
      lookme: {
        type: 'int',
        required: true,
        range: [0, 1],
        desc: '看我',
      },
      lookhim: {
        type: 'int',
        required: true,
        range: [0, 1],
        desc: '看他',
      },
    });
    const friend = await ctx.model.Friend.findOne({
      where: { user_id: current_user_id, friend_id: id, isblack: 0 },
    });

    if (!friend) {
      ctx.throw('该用户不是你的好友或该好友已被拉黑');
    }

    const { lookme, lookhim } = ctx.request.body;

    await friend.update({ lookme, lookhim });

    ctx.apiSuccess('ok');
  }
  // 获取用户所有标签
  async getAllTag() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    const tags_arr = await app.model.Tag.findAll({
      where: { user_id: current_user_id },
      attributes: ['name'],
    });
    ctx.apiSuccess(tags_arr);
  }
  // 设置备注和标签
  async setRemarkAndTag() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    const { id } = ctx.params;
    // 参数验证
    ctx.validate({
      nickname: {
        type: 'string',
        require: false,
        desc: '备注',
        defValue: '',
      },
      tags: {
        type: 'string',
        required: false,
        desc: '标签',
      },
    });
    // 查看该好友是否存在
    const friend = await ctx.model.Friend.findOne({
      where: { user_id: current_user_id, friend_id: id, isblack: 0 },
      include: [{ model: app.model.Tag }],
    });
    if (!friend) {
      ctx.throw('该用户不是你的好友或该好友已被拉黑');
    }
    const { nickname = '', tags = '' } = ctx.request.body;
    // 设置备注
    friend.nickname = nickname;
    await friend.save();
    // 获取当前用户所有标签
    const tags_arr = await app.model.Tag.findAll({
      where: { user_id: current_user_id },
    });
    // 获取标签名
    const allTagsName = tags_arr.map(item => item.name);
    // 传入的标签字符串转成数组
    const newTags = tags.split(',');
    // 需要添加的标签
    const addTags = newTags.filter(name => !allTagsName.includes(name));
    // 写入tag表数据
    const insertDatas = addTags.map(name => ({ name, user_id: current_user_id }));
    await app.model.Tag.bulkCreate(insertDatas);
    // 新插入的数据
    const _Tags = await app.model.Tag.findAll({
      where: { user_id: current_user_id, name: newTags },
    });
    // 旧标签id
    const oldTagsId = friend.tags.map(v => v.id);
    // 新标签id
    const newTagsId = _Tags.map(v => v.id);
    // 需要添加的标签
    const needTagIds = newTagsId.filter(id => !oldTagsId.includes(id));
    // 组装数据
    const friend_tags = needTagIds.map(tag_id => ({ tag_id, friend_id: friend.id }));
    console.log(friend_tags);
    // 写入FriendTag表
    await app.model.FriendTag.bulkCreate(friend_tags);
    // 需要删除的标签
    const delTagIds = oldTagsId.filter(id => !newTagsId.includes(id));
    await app.model.FriendTag.destroy({ where: { tag_id: delTagIds, friend_id: friend.id } });
    ctx.apiSuccess('ok');
  }
  // 删除好友
  async destroy() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    ctx.validate({
      friend_id: {
        type: 'int',
        required: true,
        desc: '好友id',
      },
    });
    const { friend_id } = ctx.request.body;
    // 删除自己好友
    await app.model.Friend.destroy({ where: { user_id: current_user_id, friend_id } });
    ctx.apiSuccess('ok');

    // 删除apply表对应数据
    app.model.Apply.destroy({ where: { user_id: current_user_id, friend_id } });
  }
}
module.exports = FriendController;
