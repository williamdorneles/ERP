module.exports = {
  apps: [
    {
      name: 'erp-api',
      script: '../../node_modules/.bin/tsx',
      args: 'src/server.ts',
      cwd: '/var/www/erp/apps/api',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3333,
      },
      error_file: '/var/log/pm2/erp-api-error.log',
      out_file: '/var/log/pm2/erp-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
