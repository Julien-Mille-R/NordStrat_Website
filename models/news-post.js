
import { DataTypes } from 'sequelize';

export default function defineNewsPost(sequelize) {
  return sequelize.define('NewsPost', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
      validate: {
        len: [3, 150],
      },
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [20, 50000],
      },
    },

    imageUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'image_url',
    },

    authorId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'author_id',
    },

    publishedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'published_at',
    },

    isVisible: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: 'is_visible',
    },

    category: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'accueil',
      validate: {
        isIn: [['accueil', 'actualites', 'assaut_bruay']],
      },
    },
  }, {
    tableName: 'news_post',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['published_at'] },
      { fields: ['author_id'] },
      {
        fields: ['is_visible', 'category', 'published_at'],
      },
    ],
  });
}
