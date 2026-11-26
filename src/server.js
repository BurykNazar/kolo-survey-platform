import dotenv from 'dotenv';
dotenv.config();

const { default: app } = await import('./app.js');
const { sequelize } = await import('./db/models.js');
const { env } = await import('./config/env.js');

async function bootstrap() {
  try {
    await sequelize.authenticate();
    console.log('');
    console.log('  Kolo — опитування для команд і спільнот');
    console.log(`  середовище: ${env.nodeEnv}`);
    console.log(`  адреса: ${env.appOrigin}`);
    console.log('');

    const server = app.listen(env.port, () => {
      console.log(`  сервер слухає порт ${env.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`\n${signal}: завершуємо роботу`);
      server.close(async () => {
        await sequelize.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('Не вдалося запустити Kolo:', error.message);
    process.exit(1);
  }
}

bootstrap();
