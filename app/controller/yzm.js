'use strict';

const { Controller } = require('egg');

class YzmController extends Controller {
  async sendMail() {
    const { ctx } = this;
    const { email } = ctx.query;
    const data = await this.app.model.Yzm.findOne({
      where: { email },
    });
    if (data) {
      ctx.throw('短时间无法重复发送');
    }
    const result = await ctx.service.yzm.sendMail(email);
    ctx.apiSuccess(result);
  }
}

module.exports = YzmController;
