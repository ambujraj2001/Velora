# Velora - AI Data Analytics Dashboard

Velora is a production-grade AI analytics assistant that transforms natural language queries into interactive dashboards and data insights.

## 🚀 Features
- **Intelligent Intent Classification**: Automatically identifies if you're chatting, asking a data question, or building a dashboard.
- **Dynamic SQL Generation**: Orchestrates complex ClickHouse queries based on your natural language.
- **Master Architect Dashboards**: Deconstructs high-level requests into multi-metric, interactive grid layouts.
- **Seamless Data Interaction**: Full table views with collapsible components and AI-generated summaries.

## 🛠 Tech Stack
- **Frontend**: React (Vite), Tailwind CSS, Highcharts, Lucide Icons, Framer Motion.
- **Backend**: Node.js (Express), LangGraph (LangChain), Mistral AI, ClickHouse, Supabase.

## 📦 Project Structure
- `/client`: React frontend (Vercel deployment)
- `/biz-flow`: Express backend engine (Render deployment)

## 🏗 Deployment Guide

### Backend (Render)
1. Point Render to the `biz-flow` directory.
2. Build Command: `npm install && npm run build` (if applicable) or just `npm install`.
3. Start Command: `npm start` (make sure `package.json` in `biz-flow` has an appropriate start script).
4. **Environment Variables**: Set all keys from `.env.example` including `MISTRAL_API_KEY`, `SUPABASE_URL`, etc.

### Frontend (Vercel)
1. Point Vercel to the `client` directory.
2. Vercel automatically detects Vite.
3. **Environment Variables**: Set `VITE_API_URL` to your Render backend URL.

## 📜 License
Private Repository.
