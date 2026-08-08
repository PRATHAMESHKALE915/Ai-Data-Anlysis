<div align="center">

# 🤖 AI Data Analysis

### Intelligent Data Analytics Platform powered by Gemini AI

![AI Data Analysis](https://img.shields.io/badge/AI-Data%20Analysis-6366f1?style=for-the-badge&logo=google&logoColor=white)
![Gemini](https://img.shields.io/badge/Powered%20by-Gemini%20AI-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Firebase](https://img.shields.io/badge/Auth-Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)

<br/>

**Developed by [Prathamesh Kale](https://github.com/prathameshkale)**

</div>

---

## ✨ Features

- 📊 **Smart Data Analysis** — Upload CSV/Excel files and get instant AI-powered insights
- 🤖 **Gemini AI Integration** — Natural language queries on your data
- 🔒 **Secure Auth** — Firebase Authentication with rate limiting & security headers
- 📈 **Interactive Charts** — Beautiful visualizations with real-time updates
- ☁️ **Cloud Ready** — Deployed on Vercel with serverless architecture

---

## 🚀 Run Locally

**Prerequisites:** Node.js 18+

1. Clone the repository:
   ```bash
   git clone https://github.com/prathameshkale/ai-data-analysis.git
   cd ai-data-analysis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set environment variables — copy `.env.example` to `.env.local` and fill in your keys:
   ```bash
   cp .env.example .env.local
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Your Gemini API Key (server-side only) |
| `VITE_FIREBASE_API_KEY` | Firebase Public Client Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |

---

## 🛠️ Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Backend:** Express.js (Serverless on Vercel)
- **AI:** Google Gemini API
- **Auth:** Firebase Authentication
- **Database:** Firestore
- **Deployment:** Vercel

---

<div align="center">

Made with ❤️ by **Prathamesh Kale**

</div>
