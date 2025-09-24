# Upstash Redis Setup Guide

## 🔑 Required Environment Variables

Add these to your `.env` file:

```env
# Upstash Redis Configuration
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password-from-upstash
```

## 📋 How to Get These Values

### Step 1: Go to Upstash Console
1. Visit https://console.upstash.com/
2. Sign in to your account
3. Click on your Redis database

### Step 2: Get Connection Details
1. Click on the **"Details"** or **"Connect"** tab
2. You'll see something like:

```
Endpoint: redis-12345.upstash.io
Port: 6379
Password: AYHhASQgYjE5YjJhYj...
```

### Step 3: Copy to Your .env File
```env
REDIS_HOST=redis-12345.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=AYHhASQgYjE5YjJhYj...
```

## 🧪 Test Your Connection

Once you've added the variables, test the connection:

```bash
# Start your server
npm start

# You should see:
# ✅ Redis connected
# ✅ Cache Redis connected
# ✅ Queue system initialized with 5 queues
```

## 🔧 Alternative: REST API (Optional)

Upstash also provides a REST API. If you prefer that:

```env
# REST API Configuration (Alternative)
UPSTASH_REDIS_REST_URL=https://your-redis-host.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-rest-token
```

## 🚨 Common Issues

### Issue 1: Connection Refused
- **Check**: REDIS_HOST includes the full domain
- **Check**: REDIS_PORT is 6379
- **Check**: REDIS_PASSWORD is correct

### Issue 2: Authentication Failed
- **Check**: Password is copied correctly (no extra spaces)
- **Check**: Password includes the full token

### Issue 3: SSL/TLS Issues
- **Solution**: Upstash handles SSL automatically
- **Note**: Our Redis client is configured for SSL

## 📊 Verify Connection

After setup, you can verify in your logs:

```
✅ Redis connected
✅ Cache Redis connected
✅ Queue system initialized with 5 queues
✅ AI Worker initialized with 5 queues
```

## 🎯 Next Steps

1. **Add variables to .env**
2. **Restart your server**
3. **Check logs for connection success**
4. **Test the optimized extraction endpoints**
