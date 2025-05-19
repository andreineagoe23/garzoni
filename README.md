# Monevo: A Gamified Platform for Financial Learning

Monevo is an interactive and engaging financial education platform designed to make learning about personal finance, investing, and trading more accessible and enjoyable. By incorporating gamification elements such as personalized learning paths, badges, leaderboards, and quizzes, Monevo transforms financial education into a dynamic experience.

## 🚀 Features

### 📚 Personalized Learning

- Users receive a customized learning pathway based on their financial knowledge and goals.
- Lessons cover Forex, Crypto, Real Estate, Budgeting, and Basic Finance.

### 🎮 Gamification Elements

- Badges and achievement rewards for completing lessons.
- Streak tracking for consistent learning.
- Leaderboard with global and friends-only ranking.

### 🤖 AI-Powered Chatbot

- Provides real-time market data and financial insights.
- Assists users with finance-related queries.

### 📊 Financial Tools

- **Forex Tools:** Currency converter, economic calendar, chart analysis.
- **Crypto Tools:** Price tracker, portfolio manager, blockchain explorer.
- **Real Estate Tools:** Mortgage calculator, rental yield estimator.
- **Budgeting Tools:** Expense tracker, savings goal planner, debt repayment calculator.

## 🛠️ Tech Stack

### Frontend

- **React.js** (UI development, responsive design)
- **SCSS** (Custom styling)
- **Vercel** (Deployment)

### Backend

- **Django REST Framework** (API development)
- **MySQL** (Database management)
- **Celery & Redis** (Asynchronous task processing)
- **PythonAnywhere** (Backend deployment)

### APIs & Integrations

- **TradingView, CoinGecko, Plaid** (Financial data and tools)
- **Dialogflow** (AI-powered chatbot)

## 📦 Installation & Setup

### 1️⃣ Clone the Repository

```sh
 git clone https://github.com/andreineagoe23/monevo.git
 cd monevo
```

### 2️⃣ Backend Setup

```sh
 cd backend
 python -m venv venv
 source venv/bin/activate  # On Windows: venv\Scripts\activate
 pip install -r requirements.txt
 python manage.py migrate
 python manage.py runserver
```

### 3️⃣ Frontend Setup

```sh
 cd ../frontend
 npm install
 npm run dev
```

## 🚀 Deployment

- **Frontend:** Vercel - [Live Demo](https://www.monevo.tech)
- **Backend:** PythonAnywhere

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repository and submit pull requests.

## 📩 Contact

For any questions or collaboration opportunities, reach out via email: `neagoe.andrei23@yahoo.com`

---

**Monevo - Transforming Financial Education Through Gamification** 🎓💰

# Security and Deployment Guide

## Security Enhancements

This application has been updated with enhanced security features:

1. **Token Handling**

   - Access tokens are stored in memory (not localStorage)
   - Refresh tokens are stored in HttpOnly cookies
   - Automatic token refresh on 401 errors

2. **reCAPTCHA Integration**

   - Login and Registration forms use Google reCAPTCHA
   - Protection against automated attacks
   - Sign up for an API key at https://www.google.com/recaptcha

3. **Environment Variables**
   - All sensitive information is stored in environment variables
   - `.env.example` file provided as a template

## Deployment Setup

### Backend (PythonAnywhere)

1. **Update settings.py**

   - Replace the current `settings.py` with the new version
   - Create a `.env` file in the same directory
   - Fill in all required environment variables

2. **Environment Variables Required**

   ```
   SECRET_KEY=your-secret-key-here
   DEBUG=False
   DB_PASSWORD=your-database-password
   EMAIL_HOST_USER=your-email@gmail.com
   EMAIL_HOST_PASSWORD=your-app-password
   STRIPE_SECRET_KEY=your-stripe-secret-key
   STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
   STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key
   RECAPTCHA_PUBLIC_KEY=your-recaptcha-public-key
   RECAPTCHA_PRIVATE_KEY=your-recaptcha-private-key
   ```

3. **API Updates**
   - New secure authentication endpoints:
     - `/login-secure/`
     - `/register-secure/`
     - `/logout-secure/`
     - `/token/refresh/`
     - `/verify-auth/`

### Frontend (Vercel)

1. **Environment Variables Required**

   - Add these to your Vercel project settings:

   ```
   REACT_APP_BACKEND_URL=https://andreineagoe23.pythonanywhere.com
   REACT_APP_RECAPTCHA_SITE_KEY=your-recaptcha-site-key
   ```

2. **Token Handling Updates**
   - Authentication now uses in-memory tokens
   - Automatic token refresh implemented
   - No sensitive data in localStorage

## Additional Security Recommendations

1. **Always use HTTPS**

   - Ensure all communication uses HTTPS
   - Update CORS settings to only allow HTTPS origins

2. **Rate Limiting**

   - API rate limiting already configured
   - Monitor for suspicious activity

3. **Regular Updates**

   - Keep all dependencies updated
   - Monitor security advisories

4. **Data Backups**
   - Regularly backup your database
   - Test restoration procedures
