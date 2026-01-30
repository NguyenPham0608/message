# Positivity Wall

A simple, beautiful full-stack web application that allows users to leave positive messages on a shared wall. The application features a modern "glassmorphism" UI, automatic inappropriate content detection, and a real-time-like feed.

## Features

- **Central Backend:** Built with Node.js and Express.
- **Modern UI:** Clean, responsive design with nice background animations.
- **Auto-Moderation:** 
    - **Client-side:** Instant feedback while typing if negative keywords are used.
    - **Server-side:** Robust profanity filtering using `bad-words` library.
- **Persistence:** In-memory storage for simplicity (resets on restart, perfect for demos).

## Project Structure

```
/
├── public/
│   ├── index.html    # Main UI
│   ├── style.css     # Styling and Animations
│   └── script.js     # Frontend Logic & API calls
├── server.js         # Backend Logic (API & Serving files)
├── package.json      # Dependencies and scripts
└── README.md         # Documentation
```

## How to Build and Run Locally

1.  **Install Dependencies:**
    Ensure you have Node.js installed, then run:
    ```bash
    npm install
    ```

2.  **Start the Server:**
    ```bash
    npm start
    ```

3.  **View the App:**
    Open your browser and navigate to `http://localhost:3000`.

## How to Deploy to Render

This project is configured to be "Render-ready".

1.  **Push to GitHub:**
    - Create a new repository on GitHub.
    - Push all these files to your new repository.

2.  **Create Web Service on Render:**
    - Go to [dashboard.render.com](https://dashboard.render.com).
    - Click **"New +"** -> **"Web Service"**.
    - Connect your GitHub account and select your repository.

3.  **Configure Settings:**
    - **Name:** Choose a unique name (e.g., `positivity-wall`).
    - **Runtime:** `Node`
    - **Build Command:** `npm install`
    - **Start Command:** `npm start`
    - **Region:** Choose the one closest to you.

4.  **Deploy:**
    - Click **"Create Web Service"**.
    - Render will build your app and deploy it. Once finished, you will get a live URL (e.g., `https://positivity-wall.onrender.com`).
