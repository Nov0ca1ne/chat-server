/* eslint valid-jsdoc: "off" */

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
const path = require('path');
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = (exports = {});

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1706089369944_901';

  // add your middleware config here
  config.middleware = ['errorHandler', 'auth'];
  config.errorHandler = {
    enable: true,
  };
  config.auth = {
    ignore: [
      '/upload',
      '/sendmail',
      '/register',
      '/login',
      '/ws',
      '/check_username',
      '/check_email',
      '/forget_password',
    ],
  };
  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
  };
  config.security = {
    // 关闭 csrf
    csrf: {
      enable: false,
    },
    // 跨域白名单
    domainWhiteList: ['http://localhost:3000'],
  };
  // 参数验证
  config.valparams = {
    locale: 'zh-cn',
    throwError: true,
  };
  config.multipart = {
    mode: 'file',
    fileSize: 104857600, // 设置上传文件的大小限制，单位为字节（104857600 = 100MB）
    fileExtensions: ['.xlsx', '.pdf', '.exe', '.ev6'], // 设置
  };

  config.minio = {
    client: {
      endPoint: 'XXXXXXXXX',
      port: 9001,
      useSSL: false,
      accessKey: 'XXXXXXX',
      secretKey: 'XXXXXXXXXX',
    },
    bucket: 'user-info', // public 权限 不过期 用户信息
    bucket2: 'chat-history', // private 权限（无法直接访问） 七天过期 聊天记录的图片视频
    bucket3: 'fava', // public 权限 不过期 收藏

  };
  // 允许跨域的方法
  config.cors = {
    origin: '*',
    allowMethods: 'GET, PUT, POST, DELETE, PATCH',
  };

  config.jwt = {
    secret: 'qhdgw@45ncashdaksh2!#@3nxjdas*_672',
  };
  config.redis = {
    client: {
      port: 6379, // Redis port
      host: '127.0.0.1', // Redis host
      password: '123456',
      db: 0,
    },
  };
  config.static = {
    prefix: '/public/', // 访问静态资源的url前缀
    dir: path.join(appInfo.baseDir, 'app/public'), // 静态资源的目录
  };
  // 临时文件地址
  config.tempDir = path.join(appInfo.baseDir, 'app/public/temp/'); // 临时目录
  config.sequelize = {
    dialect: 'mysql',
    host: '127.0.0.1',
    username: 'root',
    password: 'XXXXXXXXXXX',
    port: 3306,
    database: 'chat',
    // 中国时区
    timezone: '+08:00',
    define: {
      // 取消数据表名复数
      freezeTableName: true,
      // 自动写入时间戳 created_at updated_at
      timestamps: true,
      // 字段生成软删除时间戳 deleted_at
      // paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      // deletedAt: 'deleted_at',
      // 所有驼峰命名格式化
      underscored: true,
    },
  };
  return {
    ...config,
    ...userConfig,
  };
};
