# Deployment Checklist

Use this checklist when deploying to Render for the first time or when setting up a new environment.

## Pre-Deployment

- [ ] Code is pushed to GitHub repository
- [ ] `staging` branch exists (for staging environment)
- [ ] `master` branch exists (for production environment)
- [ ] All sensitive files are in `.gitignore`
- [ ] `.dockerignore` is configured
- [ ] `requirements.txt` has no duplicates
- [ ] Dockerfile is optimized and tested locally (optional)

## Render Setup

- [ ] Render account created
- [ ] GitHub repository connected to Render
- [ ] Blueprint created from `backend/render.yaml`
- [ ] All services are created:
  - [ ] PostgreSQL databases (staging & production)
  - [ ] Redis instances (staging & production)
  - [ ] Web services (staging & production)
  - [ ] Worker services (staging & production)
  - [ ] Beat services (staging & production)

## Environment Variables - Shared Group

- [ ] `SECRET_KEY` - Generated secure key
- [ ] `TIME_ZONE` - Set to UTC
- [ ] `EMAIL_HOST` - SMTP server
- [ ] `EMAIL_PORT` - SMTP port (587)
- [ ] `EMAIL_USE_TLS` - Set to True
- [ ] `EMAIL_HOST_USER` - Email address
- [ ] `EMAIL_HOST_PASSWORD` - App password
- [ ] `DEFAULT_FROM_EMAIL` - Sender email
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key
- [ ] `STRIPE_WEBHOOK_SECRET` - Webhook secret
- [ ] `STRIPE_PUBLISHABLE_KEY` - Publishable key
- [ ] `RECAPTCHA_PUBLIC_KEY` - reCAPTCHA site key
- [ ] `RECAPTCHA_PRIVATE_KEY` - reCAPTCHA secret key
- [ ] `RECAPTCHA_REQUIRED_SCORE` - Set to 0.5
- [ ] `GOOGLE_APPLICATION_CREDENTIALS` - Path to credentials file
- [ ] `DIALOGFLOW_PROJECT_ID` - Dialogflow project ID
- [ ] `CSE_ID` - Custom Search Engine ID
- [ ] `API_KEY` - Google API key
- [ ] `RECRAFT_API_KEY` - Recraft API key
- [ ] `REFRESH_TOKEN_MAX_AGE` - Set to 86400

## Environment Variables - Staging Group

- [ ] `DEBUG` - Set to True
- [ ] `ALLOWED_HOSTS_CSV` - chartwise-web-staging.onrender.com
- [ ] `CORS_ALLOWED_ORIGINS_CSV` - Frontend staging URLs
- [ ] `CSRF_TRUSTED_ORIGINS_CSV` - Frontend staging URLs
- [ ] `FRONTEND_URL` - Frontend staging URL
- [ ] `CSRF_COOKIE_DOMAIN` - Empty for staging
- [ ] `REFRESH_COOKIE_DOMAIN` - Empty for staging
- [ ] `REFRESH_COOKIE_SECURE` - Set to False
- [ ] `REFRESH_COOKIE_SAMESITE` - Set to None

## Environment Variables - Production Group

- [ ] `DEBUG` - Set to False (CRITICAL!)
- [ ] `ALLOWED_HOSTS_CSV` - Production domains
- [ ] `CORS_ALLOWED_ORIGINS_CSV` - Frontend production URLs
- [ ] `CSRF_TRUSTED_ORIGINS_CSV` - Frontend production URLs
- [ ] `FRONTEND_URL` - Frontend production URL
- [ ] `CSRF_COOKIE_DOMAIN` - Production domain
- [ ] `REFRESH_COOKIE_DOMAIN` - Production domain
- [ ] `REFRESH_COOKIE_SECURE` - Set to True
- [ ] `REFRESH_COOKIE_SAMESITE` - Set to None

## Database Setup

- [ ] Databases are created and running
- [ ] `DATABASE_URL` is automatically set (from Render)
- [ ] Migrations are run (via shell or build command)
- [ ] Superuser is created (if needed)
- [ ] Database backups are configured

## Redis Setup

- [ ] Redis instances are created and running
- [ ] `REDIS_URL` is automatically set (from Render)
- [ ] Worker services can connect to Redis
- [ ] Beat service can connect to Redis

## Service Verification

### Web Services
- [ ] Services are deployed successfully
- [ ] Health checks are passing
- [ ] Static files are being served
- [ ] API endpoints are accessible
- [ ] CORS is working correctly

### Worker Services
- [ ] Workers are running
- [ ] Can process Celery tasks
- [ ] Logs show no errors

### Beat Services
- [ ] Beat scheduler is running
- [ ] Scheduled tasks are executing
- [ ] Logs show no errors

## Frontend Configuration

- [ ] Frontend `.env` has correct `REACT_APP_BACKEND_URL` for staging
- [ ] Frontend `.env` has correct `REACT_APP_BACKEND_URL` for production
- [ ] Frontend is deployed and accessible
- [ ] Frontend can communicate with backend API
- [ ] Authentication flow works end-to-end

## Security Checks

- [ ] `DEBUG=False` in production (CRITICAL!)
- [ ] `SECRET_KEY` is strong and unique
- [ ] All API keys are set and valid
- [ ] HTTPS is enforced (automatic on Render)
- [ ] CORS origins are restricted to known domains
- [ ] CSRF protection is enabled
- [ ] Cookie security settings are correct

## Testing

- [ ] API endpoints respond correctly
- [ ] Authentication works (login/register)
- [ ] Database operations work
- [ ] File uploads work (if applicable)
- [ ] Email sending works (if applicable)
- [ ] Celery tasks execute successfully
- [ ] Scheduled tasks run on time
- [ ] Frontend can access all API endpoints
- [ ] No CORS errors in browser console
- [ ] No console errors in frontend

## Monitoring

- [ ] Logs are accessible in Render dashboard
- [ ] Error tracking is set up (if applicable)
- [ ] Database monitoring is enabled
- [ ] Uptime monitoring is configured (if applicable)

## Documentation

- [ ] Deployment guide is reviewed
- [ ] Environment variables are documented
- [ ] Team members have access to Render dashboard
- [ ] Credentials are stored securely (password manager)

## Post-Deployment

- [ ] Test all critical user flows
- [ ] Monitor logs for errors
- [ ] Check database performance
- [ ] Verify scheduled tasks are running
- [ ] Test email functionality
- [ ] Verify payment processing (if applicable)
- [ ] Check API response times
- [ ] Monitor resource usage

## Rollback Plan

- [ ] Know how to rollback to previous deployment
- [ ] Have database backup before major changes
- [ ] Test rollback procedure in staging first

---

**Quick Commands for Render Shell**

```bash
# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Collect static files
python manage.py collectstatic --noinput

# Check Celery status
celery -A chartwise inspect active

# View environment variables
env | grep DJANGO
```

---

**Emergency Contacts**

- Render Support: [support@render.com](mailto:support@render.com)
- Render Status: https://status.render.com
- Render Docs: https://render.com/docs

