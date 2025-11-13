# Deployment Guide for Render

This guide covers deploying the Monevo application to Render with separate staging and production environments.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Deployment Steps](#deployment-steps)
- [Environment Variables](#environment-variables)
- [Docker Optimization](#docker-optimization)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The application is configured with:
- **Staging Environment**: Deploys from `staging` branch
- **Production Environment**: Deploys from `master` branch
- **Services**: Web server, Celery worker, Celery beat scheduler
- **Infrastructure**: PostgreSQL databases and Redis instances for each environment

## ✅ Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Environment Variables**: Prepare all required environment variables (see below)

## 🔧 Environment Setup

### 1. Connect Repository to Render

1. Go to Render Dashboard → New → Blueprint
2. Connect your GitHub repository
3. Render will automatically detect `backend/render.yaml`
4. Review the services and click "Apply"

### 2. Environment Variable Groups

Render will create environment variable groups:
- `chartwise-shared`: Variables used by both staging and production
- `chartwise-staging`: Staging-specific variables
- `chartwise-production`: Production-specific variables

### 3. Required Environment Variables

#### Shared Variables (`chartwise-shared`)

Set these in the Render dashboard under Environment Groups:

```bash
# Django Core
SECRET_KEY=<generate-a-secure-secret-key>
TIME_ZONE=UTC

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# reCAPTCHA
RECAPTCHA_PUBLIC_KEY=your-recaptcha-public-key
RECAPTCHA_PRIVATE_KEY=your-recaptcha-private-key
RECAPTCHA_REQUIRED_SCORE=0.5

# Google Cloud / Dialogflow
GOOGLE_APPLICATION_CREDENTIALS=/opt/render/project/src/monevocredentials.json
DIALOGFLOW_PROJECT_ID=your-project-id
CSE_ID=your-cse-id
API_KEY=your-api-key

# Recraft API
RECRAFT_API_KEY=your-recraft-api-key

# Cookie Settings
REFRESH_TOKEN_MAX_AGE=86400
```

#### Staging Variables (`chartwise-staging`)

```bash
DEBUG=True
ALLOWED_HOSTS_CSV=chartwise-web-staging.onrender.com
CORS_ALLOWED_ORIGINS_CSV=https://monevo-alpha.vercel.app,https://monevo.vercel.app
CSRF_TRUSTED_ORIGINS_CSV=https://monevo-alpha.vercel.app,https://monevo.vercel.app
FRONTEND_URL=https://monevo-alpha.vercel.app
CSRF_COOKIE_DOMAIN=
REFRESH_COOKIE_DOMAIN=
REFRESH_COOKIE_SECURE=False
REFRESH_COOKIE_SAMESITE=None
```

#### Production Variables (`chartwise-production`)

```bash
DEBUG=False
ALLOWED_HOSTS_CSV=chartwise-web-production.onrender.com,monevo.tech,www.monevo.tech
CORS_ALLOWED_ORIGINS_CSV=https://www.monevo.tech,https://monevo.tech,https://monevo.vercel.app
CSRF_TRUSTED_ORIGINS_CSV=https://www.monevo.tech,https://monevo.tech,https://monevo.vercel.app
FRONTEND_URL=https://www.monevo.tech
CSRF_COOKIE_DOMAIN=monevo.tech
REFRESH_COOKIE_DOMAIN=monevo.tech
REFRESH_COOKIE_SECURE=True
REFRESH_COOKIE_SAMESITE=None
```

### 4. Generate Secret Key

Generate a secure Django secret key:

```python
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

Or use an online generator: https://djecrety.ir/

## 🚀 Deployment Steps

### Initial Deployment

1. **Push to GitHub**: Ensure your code is pushed to the repository
2. **Create Blueprint**: In Render, create a new Blueprint and select your repository
3. **Review Services**: Render will detect `backend/render.yaml` and create all services
4. **Set Environment Variables**: Configure all environment variables in the groups
5. **Deploy**: Render will automatically deploy on the first setup

### Database Migrations

After the first deployment, run migrations:

1. Go to the web service in Render dashboard
2. Open the Shell tab
3. Run: `python manage.py migrate`

Or add a build command to run migrations automatically (see below).

### Subsequent Deployments

- **Staging**: Push to `staging` branch → Auto-deploys
- **Production**: Push to `master` branch → Auto-deploys

## 🐳 Docker Optimization

The Dockerfile has been optimized for smaller image size:

- **Multi-stage build**: Separates build and runtime dependencies
- **Minimal runtime**: Only includes necessary runtime libraries
- **No build tools in final image**: Reduces image size significantly
- **.dockerignore**: Excludes unnecessary files from build context

### Image Size Reduction Tips

1. **Use .dockerignore**: Already configured to exclude:
   - `node_modules/`
   - `.git/`
   - `__pycache__/`
   - Media files (if using external storage)
   - Documentation files

2. **Layer Caching**: Dependencies are installed before copying code for better caching

3. **Cleanup**: Build dependencies are removed in the final stage

## 🔍 Frontend Configuration

The frontend should be configured with the appropriate backend URL:

### Staging
```bash
REACT_APP_BACKEND_URL=https://chartwise-web-staging.onrender.com/api
```

### Production
```bash
REACT_APP_BACKEND_URL=https://chartwise-web-production.onrender.com/api
```

Or if using a custom domain:
```bash
REACT_APP_BACKEND_URL=https://api.monevo.tech/api
```

## 📊 Monitoring

### Health Checks

Render automatically performs health checks. Ensure your Django app responds to:
- `GET /` or any valid endpoint
- Returns HTTP 200 status

### Logs

Access logs in Render dashboard:
- **Web Service**: Application logs, request logs
- **Worker Service**: Celery task logs
- **Beat Service**: Scheduled task logs

### Database

Monitor database usage in Render dashboard:
- Connection count
- Storage usage
- Query performance

## 🔧 Troubleshooting

### Common Issues

#### 1. Build Fails

**Problem**: Docker build fails
**Solution**: 
- Check Dockerfile syntax
- Verify all dependencies in `requirements.txt`
- Check `.dockerignore` isn't excluding necessary files

#### 2. Static Files Not Loading

**Problem**: 404 errors for static files
**Solution**:
- Ensure `collectstatic` runs during build (already in Dockerfile)
- Verify `STATIC_ROOT` setting
- Check WhiteNoise configuration

#### 3. Database Connection Errors

**Problem**: Cannot connect to database
**Solution**:
- Verify `DATABASE_URL` is set correctly
- Check database is running
- Ensure SSL is configured properly

#### 4. Celery Not Working

**Problem**: Tasks not executing
**Solution**:
- Verify `REDIS_URL` is set correctly
- Check worker service is running
- Verify beat service is running for scheduled tasks

#### 5. CORS Errors

**Problem**: Frontend can't access API
**Solution**:
- Verify `CORS_ALLOWED_ORIGINS_CSV` includes frontend URL
- Check `CSRF_TRUSTED_ORIGINS_CSV` includes frontend URL
- Ensure `FRONTEND_URL` is set correctly

### Debugging Commands

Access shell in Render dashboard:

```bash
# Check environment variables
env | grep DJANGO

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Check Celery status
celery -A chartwise inspect active

# Collect static files
python manage.py collectstatic --noinput
```

## 📝 Post-Deployment Checklist

- [ ] All environment variables are set
- [ ] Database migrations are applied
- [ ] Static files are collected
- [ ] Superuser account is created
- [ ] Health checks are passing
- [ ] Frontend is configured with correct backend URL
- [ ] CORS settings are correct
- [ ] SSL certificates are valid (automatic on Render)
- [ ] Monitoring is set up
- [ ] Backup strategy is in place

## 🔐 Security Best Practices

1. **Never commit secrets**: All sensitive data in environment variables
2. **Use strong SECRET_KEY**: Generate a new one for production
3. **Enable DEBUG=False**: In production environment
4. **HTTPS only**: Render provides SSL automatically
5. **Regular updates**: Keep dependencies updated
6. **Database backups**: Configure automatic backups in Render

## 📚 Additional Resources

- [Render Documentation](https://render.com/docs)
- [Django Deployment Checklist](https://docs.djangoproject.com/en/stable/howto/deployment/checklist/)
- [Gunicorn Configuration](https://docs.gunicorn.org/en/stable/settings.html)

## 🆘 Support

For issues specific to this deployment:
1. Check Render service logs
2. Review environment variables
3. Verify database and Redis connections
4. Check Django logs for detailed error messages

---

**Last Updated**: 2024
**Maintained by**: Monevo Team

