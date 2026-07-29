# Ideate Ecosystem 💡

Welcome to **Ideate**, a multi-platform application ecosystem designed for sharing ideas, participating in polls, and building community. 

This repository contains all the code for the entire ecosystem, which includes a Web Application, an Admin Dashboard, a Cross-Platform Mobile Application, and a unified Node.js backend powered by AI and real-time communications.

---

## 🏗️ Project Architecture

The project is structured into four main components:

| Directory | Component | Tech Stack | Port (Default) |
|---|---|---|---|
| [`/backend`](./backend) | REST API & Realtime Server | Node.js, Express, MongoDB, Socket.io, Redis, Gemini AI | `8000` |
| [`/WebApp`](./WebApp) | Client Web Application | React (CRA), React-Bootstrap, Framer Motion, Axios | `3000` |
| [`/AdminPanel`](./AdminPanel) | Administrative Dashboard | React, Vite, Recharts, Axios | `5173` |
| [`/MobApp`](./MobApp) | Mobile Application | Flutter, Provider, SharedPreferences, HTTP | Mobile Emulator/Device |

---

## 🛠️ Prerequisites

Before running the applications, make sure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [Flutter SDK](https://docs.flutter.dev/get-started/install) (v3.3 or higher)
- [MongoDB](https://www.mongodb.com/) (Local or MongoDB Atlas Cluster)
- [Redis Server](https://redis.io/) (Local or Redis Cloud instance)

---

## 🚀 Getting Started

Follow these step-by-step instructions to get the entire ecosystem up and running locally.

### 1. Set Up the Backend API
The backend serves as the core database connector, real-time socket host, and AI integration handler.

1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Create your `.env` configuration file by copying the template:
   ```bash
   cp .env.example .env
   ```
4. Open the new `.env` file and fill in your connection details (MongoDB URI, JWT secret keys, Cloudinary credentials, Nodemailer credentials, and your Redis instance URL).
5. Start the backend server in development mode:
   ```bash
   npm run dev
   ```
   *The backend will boot up, connect to MongoDB, connect to Redis, initialize the trending background worker queue, and listen on port `8000`.*

---

### 2. Set Up the Web Application (React)
The web application is the user-facing web interface.

1. Navigate to the WebApp folder:
   ```bash
   cd WebApp
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Start the application:
   ```bash
   npm start
   ```
   *This will run the client on [http://localhost:3000](http://localhost:3000).*

---

### 3. Set Up the Admin Panel (Vite + React)
The Admin Panel is a dashboard for moderating user posts, polls, and viewing metrics.

1. Navigate to the AdminPanel folder:
   ```bash
   cd AdminPanel
   ```
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The admin dashboard will run on [http://localhost:5173](http://localhost:5173).*

---

### 4. Set Up the Mobile Application (Flutter)
The mobile application is a cross-platform application for iOS and Android.

1. Navigate to the MobApp folder:
   ```bash
   cd MobApp
   ```
2. Fetch the Flutter dependencies:
   ```bash
   flutter pub get
   ```
3. Ensure your emulator or physical mobile device is connected:
   ```bash
   flutter devices
   ```
4. Launch the application:
   ```bash
   flutter run
   ```

---

## 🌟 Key Ecosystem Features

- **Realtime Updates:** Uses **Socket.io** to synchronize active polls, user notifications, and chat events in real-time across both web and mobile clients.
- **Background Task Processing:** Powered by **BullMQ** and **Redis** to asynchronously calculate trending feeds, updates, and clean up logs without blocking main request threads.
- **Smart AI Recommendations:** Integrated with **Google Gemini AI** (`@google/generative-ai`) to serve personalized feeds, automated content moderation, and suggestions.
- **Media Optimization:** Direct integration with **Cloudinary** for scalable, high-performance image uploads and avatar rendering.
