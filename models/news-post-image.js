
import { DataTypes } from 'sequelize';

export default function defineNewsPostImage(sequelize) {
  return sequelize.define('NewsPostImage', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    newsPostId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'news_post_id',
    },

    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'image_url',
      validate: {
        notEmpty: true,
      },
    },

    displayOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'display_order',
      validate: {
        min: 0,
      },
    },
  }, {
    tableName: 'news_post_image',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        fields: ['news_post_id', 'display_order', 'id'],
      },
    ],
  });
}
