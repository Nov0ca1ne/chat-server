'use strict';
const fs = require('fs');
const { Controller } = require('egg');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
class MinioServiceController extends Controller {
  async upload() {
    const { ctx } = this;
    const { bucket } = ctx.request.body;
    const file = ctx.request.files[0]; // 获取上传的文件
    console.log(file);

    const filePath = file.filepath; // 获取文件路径
    // 截取文件后缀
    const fileExt = file.filename.substring(file.filename.lastIndexOf('.'));
    const filename = uuidv4() + fileExt; // 生成新的文件名
    const stream = fs.createReadStream(filePath); // 创建可读取的流
    // 视频封面
    let cover = '';
    // 如果文件为视频格式
    if (['.mp4', '.avi', '.flv', '.wmv', '.rmvb'].includes(fileExt)) {
      cover = await this.ctx.service.minio.captureVideoThumbnail(filePath);
    }
    if (bucket === 'chat_history') {
      await ctx.app.minio.putObject(this.app.config.minio.bucket2, filename, stream);
      const presignedUrl = await this.ctx.service.minio.presignedUrl(this.app.config.minio.bucket2, filename);
      ctx.apiSuccess({ url: presignedUrl, cover });
    } else {
      await ctx.app.minio.putObject(this.app.config.minio.bucket, filename, stream);
      const url = await this.ctx.service.minio.getUrl(this.app.config.minio.bucket, filename);
      ctx.apiSuccess({ url, cover });
    }
  }
  async uploadBase64() {
    const { ctx } = this;
    const { str } = this.ctx.request.body;
    const matches = str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const buffer = Buffer.from(matches[2], 'base64'); // 将base64转换为二进制数据
    // 取得文件名 后缀
    const fileExt = matches[1].split('/')[1];
    const filename = `${uuidv4()}.${fileExt}`;
    // 创建可读取的流
    const stream = Readable.from(buffer)
    // 存入minio
    await ctx.app.minio.putObject(this.app.config.minio.bucket, filename, stream)
    const url = await ctx.service.minio.getUrl(this.app.config.minio.bucket, filename)
    ctx.apiSuccess(url)
  }
}
module.exports = MinioServiceController;
