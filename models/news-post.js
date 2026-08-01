import { DataTypes } from 'sequelize';

export default function defineNewsPost(sequelize) {
  return sequelize.define('NewsPost', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: { len: [3, 150] },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: { len: [20, 10000] },
    },
    imageUrl: { type: DataTypes.TEXT, allowNull: true, field: 'image_url' },
    authorId: { type: DataTypes.INTEGER, allowNull: false, field: 'author_id' },
    publishedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'published_at',
    },
  }, {
    tableName: 'news_post',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['published_at'] },
      { fields: ['author_id'] },
    ],
  });
}
