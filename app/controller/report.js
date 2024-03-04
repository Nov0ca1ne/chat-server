'use strict';
const { Controller } = require('egg');
class ReportController extends Controller {
  async reportFriend() {
    const { ctx, app } = this;
    const current_user_id = ctx.authUser.id;
    // 参数验证
    ctx.validate({
      reported_id: {
        type: 'int',
        required: true,
        desc: '被举报用户id',
      },
      reported_type: {
        type: 'string',
        required: true,
        range: ['user', 'group'],
        desc: '举报类型',
      },
      content: {
        type: 'string',
        required: true,
        desc: '举报内容',
      },
      category: {
        type: 'string',
        required: true,
        desc: '举报分类',
      },
    });

    const { reported_id, reported_type, content, category } = ctx.request.body;
    // 不能举报自己
    if (reported_type === 'user' && reported_id === current_user_id) {
      ctx.throw('不能举报自己');
    }

    // 举报人是否存在
    const user = await app.model.User.findOne({
      where: { id: reported_id, status: 1 },
    });

    if (!user) {
      ctx.throw('被举报用户不存在');
    }

    // 是否被举报过
    const report = await app.model.Report.findOne({
      where: {
        reported_id,
        reported_type,
        status: 'pending',
      },
    });
    if (report) {
      ctx.throw('该用户已举报过，请耐心等待处理结果');
    }

    // 创建举报记录
    await app.model.Report.create({ user_id: current_user_id, reported_id, reported_type, content, category });
    ctx.apiSuccess('举报成功');
  }
}
module.exports = ReportController;
