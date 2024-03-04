/* eslint-disable no-unused-vars */
'use strict';

module.exports = app => {
  const { STRING, INTEGER, DATE, ENUM } = app.Sequelize;
  // 配置
  const Apply = app.model.define('apply', {
    id: {
      type: INTEGER(20).UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    user_id: {
      type: INTEGER(20).UNSIGNED,
      allowNull: false,
      comment: '申请人id',
      //  定义外键
      references: {
        model: 'user', // 对应表名称（数据表名称）
        key: 'id', // 对应表的主键
      },
      onUpdate: 'restrict', // 更新时操作
      onDelete: 'cascade', // 删除时操作
    },
    friend_id: {
      type: INTEGER(20).UNSIGNED,
      allowNull: false,
      comment: '好友id',
      //  定义外键
      references: {
        model: 'user', // 对应表名称（数据表名称）
        key: 'id', // 对应表的主键
      },
      onUpdate: 'restrict', // 更新时操作
      onDelete: 'cascade', // 删除时操作
    },
    nickname: {
      type: STRING(30),
      allowNull: false,
      defaultValue: '',
      comment: '备注',
    },
    lookme: {
      type: INTEGER(1),
      allowNull: false,
      defaultValue: 1,
      comment: '看我',
    },
    lookhim: {
      type: INTEGER(1),
      allowNull: false,
      defaultValue: 1,
      comment: '看他',
    },
    status: {
      type: ENUM,
      values: ['pending', 'refuse', 'agree', 'ignore'],
      allowNull: false,
      defaultValue: 'pending',
      comment: '申请状态',
    },
    created_at: DATE,
    updated_at: DATE,
  });
  // 模型关联
  Apply.associate = function (models) {
    // 多对一 user foreignKey: user_id(默认填) 没有foreignKey 默认会模型user + _id
    Apply.belongsTo(app.model.User);
  };
  return Apply;
};
