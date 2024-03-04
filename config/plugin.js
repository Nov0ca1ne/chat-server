/** @type Egg.EggPlugin */
module.exports = {
  // had enabled by egg
  // static: {
  //   enable: true,
  // }
  websocket: {
    enable: true,
    package: 'egg-websocket-plugin',
  },
  // 参数验证
  valparams: {
    enable: true,
    package: 'egg-valparams',
  },
  // 跨域
  cors: {
    enable: true,
    package: 'egg-cors',
  },
  sequelize: {
    enable: true,
    package: 'egg-sequelize',
  },
  jwt: {
    enable: true,
    package: 'egg-jwt',
  },
  redis: {
    enable: true,
    package: 'egg-redis',
  },
  minio: {
    enable: true,
    package: 'egg-minio',
  },
};
