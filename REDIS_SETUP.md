# Redis Setup Guide

## 🚀 Quick Setup Options

### Option 1: Redis Cloud (Recommended for Production)
1. Go to https://redis.com/try-free/
2. Sign up for free account
3. Create a new database
4. Copy the connection details
5. Update your `.env` file:

```env
REDIS_HOST=your-redis-host.rediscloud.com
REDIS_PORT=12345
REDIS_PASSWORD=your-redis-password
```

### Option 2: Upstash Redis (Serverless)
1. Go to https://upstash.com/
2. Sign up and create a database
3. Copy the REST URL and token
4. Update your `.env` file:

```env
REDIS_HOST=your-upstash-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-upstash-token
```

### Option 3: Railway Redis
1. Go to https://railway.app/
2. Create a new project
3. Add Redis service
4. Copy connection string
5. Update your `.env` file

## 🔧 Local Development (Optional)

If you want to run Redis locally for development:

### Using Docker:
```bash
docker run -d --name redis-dev -p 6379:6379 redis:alpine
```

### Using Docker Compose:
Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

Then run:
```bash
docker-compose up -d
```

## 🧪 Testing Without Redis

For testing, the services are designed to work in "fallback mode" when Redis is not available. The system will:
- Log warnings about Redis connection
- Continue to work with reduced functionality
- Cache operations will be skipped
- Queue operations will be processed synchronously

## 📊 Monitoring Redis

Once Redis is set up, you can monitor it:
- **Redis Cloud**: Built-in monitoring dashboard
- **Upstash**: Console with metrics
- **Railway**: Service logs and metrics

## 🔒 Security Notes

- Always use strong passwords
- Enable SSL/TLS when possible
- Restrict access to your application IPs
- Regularly rotate credentials
