'use strict';
const { Controller } = require('egg');
const { compareSync } = require('../utils/bcrypt');
// eslint-disable-next-line no-unused-vars
const fs = require('fs');
class UserController extends Controller {
  // 注册
  async register() {
    const { ctx, app } = this;

    ctx.validate(
      {
        username: {
          type: 'string',
          range: { min: 5, max: 20 },
          required: true,
          desc: '用户名',
        },
        password: { type: 'string', required: true, desc: '密码', range: { min: 6, max: 20 } },
        yzm: { type: 'string', required: true, desc: '验证码' },
        email: { type: 'string', required: true, desc: '邮箱' },
        repassword: { type: 'string', required: true, desc: '确认密码', range: { min: 6, max: 20 } },
      },
      { equals: [['password', 'repassword']] }
    );
    const { username, password, yzm, email } = ctx.request.body;
    const isYzm = await this.service.yzm.judgeMail(yzm, email);
    if (!isYzm) {
      ctx.throw('验证码错误');
    }
    const user = await app.model.User.findOne({ where: { username } });
    if (user) {
      ctx.throw('用户名已存在');
    }

    const newUser = await app.model.User.create({ username, password, email });
    if (!newUser) {
      ctx.throw('注册失败');
    }
    ctx.apiSuccess(newUser);
  }
  // 登录
  async login() {
    const { ctx, app } = this;
    ctx.validate({
      username: {
        type: 'string',
        range: { min: 5, max: 20 },
        required: true,
        desc: '用户名',
      },
      password: { type: 'string', required: true, desc: '密码' },
    });
    const { username, password } = ctx.request.body;
    // 验证用户是否存在或状态是否可用
    let user = await app.model.User.findOne({ where: { username, status: 1 } });
    if (!user) {
      ctx.throw('用户不存在或已禁用');
    }
    if (!compareSync(password, user.password)) {
      ctx.throw('密码错误');
    }

    user = user.toJSON();
    delete user.password;
    // 生成Token
    const token = ctx.getToken(user);
    user.token = token;
    // 加入缓存
    if (!(await this.service.cache.set('user_' + user.id, token))) {
      ctx.throw(400, '登录失败');
    }
    // 返回用户信息和token
    ctx.apiSuccess(user);
  }
  // 退出登录
  async logout() {
    const { ctx, service } = this;
    // 拿到当前用户id
    const current_user_id = ctx.authUser.id;
    // 移除redis数据
    if (!(await service.cache.remove('user_' + current_user_id))) {
      ctx.throw(400, '退出登录失败');
    }
    ctx.apiSuccess('退出登录成功');
  }
  // 用户名是否存在
  async checkUserName() {
    const { ctx } = this;
    // 参数验证
    ctx.validate({ username: { type: 'string', required: true, desc: '用户名' } });
    const { username } = ctx.request.body;
    const data = await this.ctx.model.User.findOne({ where: { username } });
    if (!data) {
      ctx.apiSuccess(false);
    } else {
      ctx.apiSuccess(true);
    }
  }
  // 邮箱是否存在
  async checkEmail() {
    const { ctx } = this;
    // 参数验证
    ctx.validate({ email: { type: 'string', required: true, desc: '邮箱' } });
    const { email } = ctx.request.body;
    const data = await this.ctx.model.User.findOne({ where: { email } });
    if (!data) {
      ctx.apiSuccess(false);
    } else {
      ctx.apiSuccess(true);
    }
  }
  // 忘记密码
  async forgetPassword() {
    const { ctx } = this;

    ctx.validate(
      {
        password: { type: 'string', required: true, desc: '密码', range: { min: 6, max: 20 } },
        yzm: { type: 'string', required: true, desc: '验证码' },
        email: { type: 'string', required: true, desc: '邮箱' },
        repassword: { type: 'string', required: true, desc: '确认密码', range: { min: 6, max: 20 } },
      },
      { equals: [['password', 'repassword']] }
    );
    const { password, yzm, email } = ctx.request.body;
    const isYzm = await this.service.yzm.judgeMail(yzm, email);
    if (!isYzm) {
      ctx.throw('验证码错误');
    }
    const data = await this.ctx.model.User.findOne({ where: { email } });
    if (!data) {
      ctx.throw('该邮箱未注册');
    }
    let user = await data.update({ password });
    user = user.toJSON();
    delete user.password;

    ctx.apiSuccess(user);
  }
  // 搜索用户
  async searchUser() {
    const { ctx } = this;
    ctx.validate({
      keyword: { type: 'string', required: true, desc: '关键字' },
    });
    const { keyword } = ctx.request.body;
    const data = await this.ctx.model.User.findOne({
      where: { username: keyword },
      attributes: { exclude: ['password'] },
    });
    ctx.apiSuccess(data);
  }
  // 生成个人二维码
  async qrcode() {
    const { ctx } = this;
    ctx.qrcode(
      JSON.stringify({
        id: ctx.params.id,
        type: 'user',
      })
    );
  }
  // 修改用户资料
  async updateInfo() {
    const { ctx } = this;
    ctx.validate({
      avatar: {
        type: 'url',
        required: false,
        defValue: '',
        desc: '头像',
      },
      nickname: {
        type: 'string',
        required: false,
        defValue: '',
        desc: '昵称',
      },
    });
    const { avatar, nickname } = ctx.request.body;
    ctx.authUser.avatar = avatar;
    ctx.authUser.nickname = nickname;

    await ctx.authUser.save();
    return ctx.apiSuccess('ok');
  }
}
module.exports = UserController;
