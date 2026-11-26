import { Sequelize, DataTypes } from 'sequelize';
import { env } from '../config/env.js';

const needsSsl = /sslmode=require/.test(env.databaseUrl) || (env.isProd && !/localhost|127\.0\.0\.1/.test(env.databaseUrl));

export const sequelize = new Sequelize(env.databaseUrl, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: needsSsl
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
  pool: { max: 8, min: 0, idle: 10000, acquire: 30000 },
  define: {
    timestamps: false,
    freezeTableName: true,
    underscored: true
  }
});

export const User = sequelize.define(
  'app_users',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    full_name: { type: DataTypes.STRING(150), allowNull: false },
    email: { type: DataTypes.STRING(160), allowNull: false, unique: true },
    password_hash: { type: DataTypes.STRING(255), allowNull: false },
    role: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'visitor' },
    institution: { type: DataTypes.STRING(150), allowNull: true },
    phone: { type: DataTypes.STRING(30), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    tableName: 'app_users',
    indexes: [{ fields: ['role'] }]
  }
);

export const SurveyCategory = sequelize.define(
  'survey_categories',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    code: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  { tableName: 'survey_categories' }
);

export const Survey = sequelize.define(
  'surveys',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
    creator_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'draft' },
    estimated_minutes: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 5 },
    is_anonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    tableName: 'surveys',
    indexes: [{ fields: ['creator_id'] }, { fields: ['category_id'] }, { fields: ['status'] }]
  }
);

export const Question = sequelize.define(
  'questions',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    survey_id: { type: DataTypes.INTEGER, allowNull: false },
    question_text: { type: DataTypes.TEXT, allowNull: false },
    question_type: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'single_choice' },
    order_num: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    hint: { type: DataTypes.STRING(255), allowNull: true }
  },
  {
    tableName: 'questions',
    indexes: [{ fields: ['survey_id'] }]
  }
);

export const AnswerOption = sequelize.define(
  'answer_options',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    option_text: { type: DataTypes.STRING(255), allowNull: false },
    order_num: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }
  },
  {
    tableName: 'answer_options',
    indexes: [{ fields: ['question_id'] }]
  }
);

export const SurveyResult = sequelize.define(
  'survey_results',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    survey_id: { type: DataTypes.INTEGER, allowNull: false },
    question_id: { type: DataTypes.INTEGER, allowNull: false },
    option_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    text_answer: { type: DataTypes.TEXT, allowNull: true },
    rating_value: { type: DataTypes.INTEGER, allowNull: true },
    session_id: { type: DataTypes.STRING(64), allowNull: false },
    is_anonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    answered_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    tableName: 'survey_results',
    indexes: [
      { fields: ['survey_id'] },
      { fields: ['session_id'] },
      { fields: ['question_id'] },
      { fields: ['user_id'] }
    ]
  }
);

SurveyCategory.hasMany(Survey, { foreignKey: 'category_id', as: 'surveys' });
Survey.belongsTo(SurveyCategory, { foreignKey: 'category_id', as: 'category' });

User.hasMany(Survey, { foreignKey: 'creator_id', as: 'createdSurveys' });
Survey.belongsTo(User, { foreignKey: 'creator_id', as: 'creator' });

Survey.hasMany(Question, { foreignKey: 'survey_id', as: 'questions' });
Question.belongsTo(Survey, { foreignKey: 'survey_id', as: 'survey' });

Question.hasMany(AnswerOption, { foreignKey: 'question_id', as: 'options' });
AnswerOption.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

Survey.hasMany(SurveyResult, { foreignKey: 'survey_id', as: 'results' });
SurveyResult.belongsTo(Survey, { foreignKey: 'survey_id', as: 'survey' });

Question.hasMany(SurveyResult, { foreignKey: 'question_id', as: 'results' });
SurveyResult.belongsTo(Question, { foreignKey: 'question_id', as: 'question' });

AnswerOption.hasMany(SurveyResult, { foreignKey: 'option_id', as: 'results' });
SurveyResult.belongsTo(AnswerOption, { foreignKey: 'option_id', as: 'chosenOption' });

User.hasMany(SurveyResult, { foreignKey: 'user_id', as: 'responses' });
SurveyResult.belongsTo(User, { foreignKey: 'user_id', as: 'respondent' });

export const models = { User, SurveyCategory, Survey, Question, AnswerOption, SurveyResult };
