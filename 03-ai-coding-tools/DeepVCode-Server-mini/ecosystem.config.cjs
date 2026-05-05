/**
 * PM2 Production Deployment Configuration
 *
 * PM2 is a Node.js process manager that:
 * - Automatically restarts crashed applications
 * - Manages application startup on system boot
 * - Provides centralized logging
 * - Enables zero-downtime reloads
 * - Monitors CPU, memory, and other metrics
 *
 * Installation: npm install -g pm2
 *
 * Usage:
 *   pm2 start ecosystem.config.js                    # Start all apps
 *   pm2 start ecosystem.config.js --only production  # Start specific app
 *   pm2 monit                                        # Monitor in real-time
 *   pm2 logs                                         # View logs
 *   pm2 restart production                           # Restart app
 *   pm2 delete production                            # Stop and delete app
 *   pm2 save                                         # Save PM2 config
 *   pm2 startup                                      # Enable auto-startup on boot
 */

module.exports = {
  apps: [
    {
      name: 'deepx-mini-server',
      script: './dist/index.js',
      instances: 4,  // 4 instances for small business use
      exec_mode: 'cluster',  // Cluster mode for load balancing
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },

      // Process management
      merge_logs: true,  // Merge cluster mode logs
      autorestart: true,  // Auto-restart on crash
      watch: false,  // Don't watch files in production
      ignore_watch: ['node_modules', 'dist', '.git'],
      max_memory_restart: '1G',  // Restart if memory exceeds 1GB

      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/error.log',
      out_file: './logs/out.log',

      // Graceful shutdown
      kill_timeout: 5000,  // Wait 5 seconds before force kill
      wait_ready: true,  // Wait for ready message
      listen_timeout: 10000,

      // Performance tuning
      max_restarts: 15,  // Max restart attempts in 1 minute
      min_uptime: '10s'  // Minimum uptime before count as crash
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-production-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:yourorg/deepx-mini-server.git',
      path: '/var/www/deepx-mini-server',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
