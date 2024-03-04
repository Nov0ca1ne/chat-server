'use strict';
const { Controller } = require('egg');
class FavaController extends Controller {
  async create() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      type: {
        type: 'string',
        require: true,
        range: {
          in: ['text', 'image', 'video', 'audio', 'emoji', 'card', 'position'],
        },
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
      },
      name: {
        type: 'string',
        require: true,
        desc: '会话名称',
      },
    });
    const { type, data, options, name } = ctx.request.body;
    await app.model.Fava.create({
      type,
      data,
      options,
      name,
      user_id: current_user_id,
    });
    return ctx.apiSuccess('ok');
  }

  async list() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    const page = ctx.query.page ? parseInt(ctx.query.page) : 1;
    const limit = ctx.query.limit ? parseInt(ctx.query.limit) : 10;
    const offset = (page - 1) * limit;
    const rows = await app.model.Fava.findAll({
      where: {
        user_id: current_user_id,
      },
      offset,
      limit,
      order: [['id', 'DESC']],
    });
    return ctx.apiSuccess(rows);
  }

  // 删除收藏
  async destroy() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // ctx.validate({
    //   type: {
    //     type: 'string',
    //     require: true,
    //     range: {
    //       in: ['text', 'image', 'video', 'audio', 'emoji', 'card', 'position'],
    //     },
    //     desc: '消息类型',
    //   },
    // });
    // eslint-disable-next-line no-unused-vars
    const { data, type, id } = ctx.request.body;
    // const types = ['image', 'video', 'audio'];
    // if (types.includes(type)) {
    //   const fileName = this.getFileName(data);
    //   // 删除fava中的文件
    //   await ctx.app.minio.removeObject(ctx.app.config.minio.bucket3, fileName);
    // }
    await app.model.Fava.destroy({
      where: {
        id,
        user_id: current_user_id,
      },
    });

    return ctx.apiSuccess('ok');
  }

  getFileName(url) {
    const urlParts = url.split('?');
    // 获取数组中第一个元素，即文件名部分
    const fileName = urlParts[0].split('/').pop();
    return fileName;
  }
}
module.exports = FavaController;
