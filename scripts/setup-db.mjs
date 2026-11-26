import { sequelize } from '../src/db/models.js';
import { seed } from './seed.mjs';

const reset = process.argv.includes('--reset');

try {
  await sequelize.authenticate();
  console.log('Підключення до бази даних встановлено.');

  if (reset) {
    console.log('Перестворення схеми (--reset)...');
    await sequelize.sync({ force: true });
  } else {
    await sequelize.sync();
  }

  await seed();
  console.log('Схема готова.');
} catch (error) {
  console.error('Не вдалося підготувати базу даних:', error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
