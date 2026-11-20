# AlphaPulse IN — 3D Quant Trading Terminal & Scanner
> **Institutional-Grade 9 & 15 EMA + VWAP Real-Time Scanner, Backtester & Paper OMS for NSE F&O Universe with Three.js 3D WebGL Matrix**

---

## 🌟 Overview (परियोजना परिचय)
**AlphaPulse IN** ek institutional-grade algorithmic trading aur market scanning system hai jo specifically **NSE F&O (Futures & Options)** universe ke liye design kiya gaya hai. 

Isme 9 EMA aur 15 EMA crossover ke sath **Intraday VWAP (Volume-Weighted Average Price)** confirmation filter ka use hota hai taaki false breakouts se bacha ja sake. Pehle ye ek single standalone frontend HTML file me tha, ab iska ek **Strong Python FastAPI Backend**, **SQLite Database**, **Real-Time WebSockets**, aur **Three.js 3D Spatial Matrix Frontend** poori tarah se setup kar diya gaya hai.

---

## 📁 Project Architecture & Folder Structure

```
d:\Alpha Scanner\
│
├── backend\                            # Complete Python FastAPI Backend
│   ├── app\
│   │   ├── api\                        # REST API & WebSocket Endpoints
│   │   │   ├── auth_routes.py          # Trader Authentication (PBKDF2-SHA256)
│   │   │   ├── backtest_routes.py      # 5-Min Backtesting Engine API
│   │   │   ├── router.py               # Main API Router
│   │   │   ├── scanner_routes.py       # Live 28 Stocks Setup Scanner API
│   │   │   ├── trade_routes.py         # Paper Trading Orders, Positions & P&L
│   │   │   └── websocket_routes.py     # Live Tick & Setup Broadcast (/ws/ticks)
│   │   ├── core\                       # Quantitative Logic & Mathematics
│   │   │   ├── backtest_engine.py      # Backtesting with Indian Tax & Charges
│   │   │   ├── indicators.py           # EMA 9, EMA 15, VWAP, ATR, RSI calculation
│   │   │   ├── kronos_engine.py        # Kronos K-Line AI Predictor Bridge
│   │   │   ├── risk_manager.py         # Statutory Charges (STT/GST) & Risk Rules
│   │   │   └── strategy_engine.py      # 9/15 EMA + VWAP Entry/Exit Logic
│   │   ├── models\                     # Database & Pydantic Schemas
│   │   │   ├── db_models.py            # SQLAlchemy Models (Users, Orders, Alerts)
│   │   │   └── schemas.py              # Request/Response validation models
│   │   ├── services\                   # Core Services
│   │   │   ├── broker_service.py       # Paper Trading Engine & OMS
│   │   │   ├── market_data.py          # 28 NSE F&O Universe Data Provider
│   │   │   └── scanner_service.py      # Continuous Multi-Stock Scanner
│   │   ├── config.py                   # App Configuration & Broker Settings
│   │   ├── database.py                 # SQLite Engine & Session Maker
│   │   └── main.py                     # FastAPI Application Entrypoint
│   └── requirements.txt                # Python Dependencies
│
├── frontend\                           # Modern 3D WebGL + Pro Trading UI
│   ├── css\
│   │   └── custom.css                  # Glassmorphism, 3D viewport & glow styles
│   ├── js\
│   │   ├── app.js                      # Terminal Master Controller
│   │   ├── live_chart.js               # 5-Min Interactive Canvas Candlestick Chart
│   │   ├── terminal_3d.js              # Three.js 3D Spatial Matrix Visualizer
│   │   └── ws_client.js                # WebSocket Client with Auto-Reconnect
│   ├── index.html                      # 3D Quant Trading Terminal (Main UI)
│   └── legacy_dashboard.html           # Original Standalone Dashboard (Preserved)
│
├── data\                               # Local Storage & Database
│   └── alpha_scanner.db                # SQLite Persistent Database
│
├── .env.example                        # Configuration Environment Variables
├── run.py                              # Unified 1-Click Python Launcher
├── start.bat                           # Windows 1-Click Launch Script
└── original_intraday_dashboard.html    # Original Backup HTML File
```

---

## 🚀 How to Run (Kaise Start Karein)

### Method 1: Single Click (Recommended for Windows)
Folder me jakar **`start.bat`** par double click karein!

### Method 2: Terminal / PowerShell
```powershell
cd "d:\Alpha Scanner"
python run.py
```

Ye command automatically:
1. Backend FastAPI Server ko start karega (`http://localhost:8000`)
2. Local SQLite database initialize karega
3. Aapke browser me **3D Quant Trading Terminal** open kar dega!

### Available URLs:
- **3D Quant Terminal:** [http://localhost:8000](http://localhost:8000)
- **Original Legacy Dashboard:** [http://localhost:8000/legacy](http://localhost:8000/legacy)
- **Interactive API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Live WebSocket Feed:** `ws://localhost:8000/api/ws/ticks`

---

## 💡 What Improvements Should You Make? (Aur Kya Improvements Karni Chahiye?)

Aapka ye sochna bilkul sahi tha ki pehle ye sirf ek **Frontend Simulation** tha. Ab humne ek robust backend aur 3D frontend structure build kiya hai. Is system ko ek **Institutional-Grade Algorithmic Trading Desk** banane ke liye aage ye top improvements karni chahiye:

### 1. Real-Time Broker WebSocket Integration (Zero-Delay Live Ticks)
- **Abhi:** Backend me simulated ticks aur fallback generator hai.
- **Improvement:** Angel One SmartAPI WebSocket ya DhanHQ v2 WebSocket ko directly backend ke `market_data.py` se connect karein. 
- **Fayda:** 9:15 AM se 3:30 PM tak live market ke real-time tick-by-tick prices direct NSE feed se milenge bina kisi delay ke.

### 2. Automated Multi-Timeframe Confirmation (15M Trend + 5M Entry)
- **Problem:** Single 5-minute timeframe me false breakouts (whipsaws) aate hain jab market sideways ho.
- **Improvement:** Higher Timeframe (HTF) filter lagayein:
  - Agar 15-Minute ya 1-Hour chart par price 200 EMA ke upar hai, tabhi 5-Minute par **BUY** signal allow karein.
  - Agar HTF bearish hai, to sirf **SELL (Short)** signals allow karein.

### 3. F&O Options Chain & Greek Scanner (ATM/OTM Strikes)
- **Feature:** Abhi scanner underlying equity stock prices ko track karta hai.
- **Improvement:** Jab kisi stock (jaise RELIANCE ya SBIN) me STRONG_BUY signal bane, to scanner automatically:
  - Nearest expiry ka **ATM / ITM Call Option (CE)** select kare.
  - Delta, Gamma, Theta, aur Implied Volatility (IV) check kare.
  - 1-Click se direct Option Buy order place karne ki suvidha de.

### 4. Advanced Risk Management & Capital Protection
- **Daily Loss Circuit Breaker (Kill Switch):** Agar din ka loss capital ke 2% ya 3% se jyada ho jaye, to bot automatic trading halt kar de aur naye orders block kar de.
- **Trailing Stop Loss:** Profit badhne ke sath sath SL automatically cost par shift ho jaye (Breakeven SL) aur fir ATR (Average True Range) ke hisab se trail ho.
- **Realistic Slippage Modeling:** Fast moving market me entry price aur actual fill price ke beech ka difference account karein.

### 5. Telegram & WhatsApp Webhook Alerts
- **Feature:** Scanner me jab bhi koi 85%+ confidence setup trigger ho, turant aapke mobile par Telegram Bot notification bhej de:
  > *🚨 AlphaPulse Alert: RELIANCE 5M Strong Buy Triggered @ ₹1295. SL: ₹1288, Target: ₹1310. (Vol Surge: 2.4x)*

### 6. 3D WebGL Terminal Enhancements
- **3D Volatility Surface (Smile):** Options ki Implied Volatility ko 3D mesh surface ke roop me render karna.
- **3D Order Book Depth Matrix:** Level 3 market depth (bids vs asks volume) ko 3D towers ke roop me dekhna.

### 7. Local HuggingFace Kronos ML Pipeline
- **shiyu-coder/Kronos PyTorch Model:** `NeoQuasar/Kronos-small` model ko local GPU / CPU par load karke candle sequence prediction ko live inference se connect karna.

---

## ⚖️ Indian Statutory Charges Calculation Formula
AlphaPulse IN ke backtest aur paper trading engine me exact Indian tax structure embedded hai:
- **Brokerage:** Flat ₹20 per executed order
- **STT (Securities Transaction Tax):** 0.025% on Sell Turnover (Equity Intraday)
- **Exchange Turnover Charges:** 0.00345% of total turnover
- **SEBI Turnover Fee:** ₹10 per crore (0.0001%)
- **Stamp Duty:** 0.003% on Buy Turnover
- **GST:** 18% on (Brokerage + Exchange Charges + SEBI Charges)

Isse backtest me milne wala Net P&L realistic hota hai aur trader ko true profitability ka pata chalta hai.
