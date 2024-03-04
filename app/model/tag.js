'use strict';
module.exports = app => {
  const { STRING, INTEGER, DATE } = app.Sequelize;
  // 配置
  const Tag = app.model.define('tag', {
    id: {
      type: INTEGER(20).UNSIGNED,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: STRING(30),
      allowNull: false,
      defaultValue: '',
      comment: '标签名称',
    },
    user_id: {
      type: INTEGER(20).UNSIGNED,
      allowNull: false,
      comment: '用户id',
      //  定义外键（重要）
      references: {
        model: 'user', // 对应表名称（数据表名称）
        key: 'id', // 对应表的主键
      },
      onUpdate: 'restrict', // 更新时操作
      onDelete: 'cascade', // 删除时操作
    },
    created_at: DATE,
    updated_at: DATE,
  });
  return Tag;
};
