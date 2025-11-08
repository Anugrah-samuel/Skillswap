# 🚀 Deploy Skillswap to Render

This guide will help you deploy your Skillswap application to Render in just a few minutes!

## 📋 Prerequisites

- GitHub account with your Skillswap repository
- Render account (free): https://render.com

## 🎯 Quick Deploy Steps

### Step 1: Sign Up for Render

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with your GitHub account

### Step 2: Connect Your Repository

1. In Render Dashboard, click "New +"
2. Select "Blueprint"
3. Click "Connect GitHub"
4. Authorize Render to access your repositories
5. Select your `Skillswap` repository

### Step 3: Configure Services

Render will automatically detect the `render.yaml` file and create:

- ✅ **Web Service** - Your Node.js application
- ✅ **PostgreSQL Database** - Managed database
- ✅ **Redis** - Managed cache

### Step 4: Set Environment Variables

Render will auto-generate most variables, but you may want to add:

**Optional Variables:**
- `STRIPE_SECRET_KEY` - For payment processing
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `AWS_ACCESS_KEY_ID` - For S3 file storage
- `AWS_SECRET_ACCESS_KEY` - For S3 file storage
- `AWS_S3_BUCKET` - Your S3 bucket name

To add these:
1. Go to your web service in Render
2. Click "Environment"
3. Add variables
4. Click "Save Changes"

### Step 5: Deploy!

1. Click "Apply" to create all services
2. Render will:
   - Build your application
   - Set up the database
   - Set up Redis
   - Deploy everything
3. Wait 5-10 minutes for the first deployment

### Step 6: Access Your App

Once deployed, you'll get a URL like:
```
https://skillswap-app.onrender.com
```

## 🔧 Manual Deployment (Alternative)

If you prefer manual setup:

### 1. Create PostgreSQL Database

1. Dashboard → "New +" → "PostgreSQL"
2. Name: `skillswap-db`
3. Database: `skillswap`
4. User: `skillswap`
5. Plan: Free
6. Click "Create Database"
7. Copy the "Internal Database URL"

### 2. Create Redis Instance

1. Dashboard → "New +" → "Redis"
2. Name: `skillswap-redis`
3. Plan: Free
4. Click "Create Redis"
5. Copy the "Internal Redis URL"

### 3. Create Web Service

1. Dashboard → "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `skillswap-app`
   - **Region**: Oregon (or closest to you)
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Free

4. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<paste-internal-database-url>
   REDIS_URL=<paste-internal-redis-url>
   JWT_SECRET=<generate-random-string>
   ```

5. Click "Create Web Service"

## 🎉 Post-Deployment

### Run Database Migrations

After first deployment:

1. Go to your web service
2. Click "Shell" tab
3. Run:
   ```bash
   npm run db:migrate:run
   ```

### Test Your Deployment

1. Visit your Render URL
2. Try signing up for an account
3. Test the real-time chat feature
4. Check API docs at: `https://your-app.onrender.com/api-docs`

## 📊 Monitor Your App

### View Logs

1. Go to your web service
2. Click "Logs" tab
3. Monitor real-time logs

### Check Metrics

1. Click "Metrics" tab
2. View:
   - CPU usage
   - Memory usage
   - Request count
   - Response times

## 🔄 Auto-Deploy on Git Push

Render automatically deploys when you push to GitHub:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Render will detect the push and redeploy automatically!

## 💰 Pricing

**Free Tier Includes:**
- 750 hours/month web service
- PostgreSQL database (90 days, then $7/month)
- Redis instance (90 days, then $7/month)
- Automatic SSL certificates
- Custom domains

**Note**: Free tier services spin down after 15 minutes of inactivity. First request after spin-down takes ~30 seconds.

## 🆙 Upgrade Options

For production use, consider:
- **Starter Plan** ($7/month) - No spin-down, better performance
- **Standard Plan** ($25/month) - More resources, faster builds

## 🐛 Troubleshooting

### Build Fails

Check build logs for errors:
- Missing dependencies? Run `npm install` locally first
- TypeScript errors? Run `npm run build` locally to test

### Database Connection Issues

Verify environment variables:
- `DATABASE_URL` should be the Internal Database URL
- Format: `postgresql://user:password@host:5432/database`

### App Won't Start

Check start command:
- Should be: `npm start`
- Verify `package.json` has correct start script

### WebSocket Issues

Render supports WebSockets on all plans. If issues occur:
- Check that Socket.IO is configured for production
- Verify CORS settings allow your domain

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Node.js on Render](https://render.com/docs/deploy-node-express-app)
- [PostgreSQL on Render](https://render.com/docs/databases)
- [Environment Variables](https://render.com/docs/environment-variables)

## 🎯 Quick Links

- **Render Dashboard**: https://dashboard.render.com
- **Your Repository**: https://github.com/Anugrah-samuel/Skillswap
- **Support**: https://render.com/docs/support

---

**Need Help?** Check the Render documentation or open an issue on GitHub!
