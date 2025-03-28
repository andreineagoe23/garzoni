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
 git clone https://github.com/yourusername/monevo.git
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

## 📸 Screenshots
| Dashboard | Leaderboard | AI Chatbot |
|-----------|------------|------------|
| ![Dashboard](screenshots/dashboard.png) | ![Leaderboard](screenshots/leaderboard.png) | ![Chatbot](screenshots/chatbot.png) |

## 🚀 Deployment
- **Frontend:** Vercel - [Live Demo](https://monevo.vercel.app)
- **Backend:** PythonAnywhere

## 🤝 Contributing
Contributions are welcome! Feel free to fork the repository and submit pull requests.

## 📩 Contact
For any questions or collaboration opportunities, reach out via email: `your.email@example.com` or connect on [LinkedIn](https://linkedin.com/in/your-profile).

---
**Monevo - Transforming Financial Education Through Gamification** 🎓💰
