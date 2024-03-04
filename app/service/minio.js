const { Service } = require('egg');
const axios = require('axios');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

class MinioService extends Service {
  // public权限
  async getUrl(bucket, filename) {
    const endPoint = this.app.config.minio.client.endPoint;
    const port = this.app.config.minio.client.port;
    const url = `http://${endPoint}:${port}/${bucket}/${filename}`;
    return url;
  }
  // private权限
  async presignedUrl(bucket, filename) {
    const { ctx } = this;
    const result = await ctx.app.minio.presignedUrl('GET', bucket, filename, 60 * 60 * 24 * 7);
    return result;
  }
  // 下载图片到临时地址 再传minio
  async download(url) {
    const response = await axios.get(url, { responseType: 'stream' });
    // 文件类型
    const fileType = url.split('.').pop();
    const name = uuidv4() + '.' + fileType;
    // 响应结果存入临时地址
    const path = this.app.config.tempDir + name;
    const writer = fs.createWriteStream(path);
    // response.data.pipe(writer);
    // return path;
    // 文件写入是异步的，需要等待写入完成才能返回path，否则找不到文件
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        resolve(path);
      });
      writer.on('error', err => {
        reject(err);
      });
      response.data.pipe(writer);
    });
  }

  // 截取视频封面
  async captureVideoThumbnail(videoPath) {
    return new Promise((resolve, reject) => {
      let filename = null;
      ffmpeg(videoPath)
        .on('filenames', async filenames => {
          // 文件名
          filename = filenames[0];
        })
        .on('error', err => {
          reject(err);
        })
        .on('end', async () => {
          const path = this.app.config.tempDir + filename;
          // 拿到当前文件路径，读取流
          const thumbnailStream = fs.createReadStream(path);
          // 上传minio
          await this.ctx.app.minio.putObject(this.app.config.minio.bucket2, filename, thumbnailStream);
          // 取得上传后的文件名
          const presignedUrl = await this.presignedUrl(this.app.config.minio.bucket2, filename);
          resolve(presignedUrl);
        })
        .screenshots({
          count: 1, // 取第一帧
          folder: this.app.config.tempDir, // 保存封面的文件夹
          size: '320x240', // 封面尺寸
          filename: 'thumbnail-%b.png', // 封面文件名
        });
    });
  }
}

module.exports = MinioService;
