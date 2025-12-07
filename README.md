# Audio Analysis Platform - Real-Time Signal Processing

Real-time audio analysis platform using ESP32, FastAPI, and React. The system captures audio data from a microphone connected to ESP32, processes the signal in real-time, and displays detailed analysis in a modern web dashboard.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESP32 Device                            │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MAX4466 Microphone → ADC → FFT Analysis → WebSocket     │  │
│  │  - Sample Rate: 16kHz                                     │  │
│  │  - FFT Samples: 128                                       │  │
│  │  - Frequency Bands: 9 (0-8kHz)                             │  │
│  │  - Real-time filtering & SNR calculation                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (WSS)
                             │ Port 443
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend Server                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  WebSocket Manager                                        │  │
│  │  - /ws (ESP32 endpoint)                                  │  │
│  │  - /ws-dashboard (Frontend endpoint)                     │  │
│  │  - Real-time data broadcasting                           │  │
│  │  - Connection management                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  REST API                                                │  │
│  │  - /api/info (System information)                        │  │
│  │  - CORS enabled                                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ WebSocket (WSS)
                             │ HTTP/HTTPS
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Frontend (Vite)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Real-Time Dashboard                                     │  │
│  │  - Waveform Charts (RAW & FILTERED)                      │  │
│  │  - Spectrogram Visualization                            │  │
│  │  - Frequency Bands Display                                │  │
│  │  - Signal Quality Metrics (SNR)                          │  │
│  │  - Filter Controls (Low/High/Band-Pass)                  │  │
│  │  - Measurement Log                                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 📦 Components

### ESP32 Firmware (`arduino/microphone_websocket.ino`)
- **Hardware**: ESP32 + MAX4466 Microphone
- **Features**:
  - Audio capture at 16kHz
  - FFT analysis with 9 frequency bands
  - Real-time filtering (Low-Pass, High-Pass, Band-Pass)
  - SNR calculation for RAW and FILTERED signals
  - Noise gate and automatic calibration
  - WebSocket communication with backend

### Backend Server (`server/`)
- **Framework**: FastAPI (Python)
- **Features**:
  - WebSocket server for ESP32 and Dashboard
  - Real-time broadcast to all dashboards
  - Connection management
  - REST API for system information
  - Structured logging

### Frontend Dashboard (`client/`)
- **Framework**: React + TypeScript + Vite
- **UI**: Tailwind CSS
- **Features**:
  - Real-time visualizations (waveform, spectrogram)
  - Audio filter controls (cutoff frequencies, voice boost)
  - Signal quality metrics (SNR)
  - Measurement log
  - Connection status (Dashboard & ESP32)

## 🚀 Running with Docker

### Prerequisites
- Docker
- Docker Compose

### Full Setup

```bash
# Clone the repository
git clone <repository-url>
cd psad-project

# Run all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Access
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api
- **Backend Health**: http://localhost:8000/api/health
- **Backend WebSocket**: ws://localhost:8000/ws (ESP32)
- **Dashboard WebSocket**: ws://localhost:8000/ws-dashboard

### Stop
```bash
docker-compose down
```

## 🔧 Manual Configuration

### Backend (FastAPI)

```bash
cd server
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
venv\Scripts\activate  # Windows

pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend (React)

```bash
cd client
npm install
npm run dev
```

### ESP32

1. Open `arduino/microphone_websocket.ino` in Arduino IDE
2. Install required libraries:
   - `WiFi` (built-in)
   - `WebSocketsClient` (from Links2004)
3. Configure WiFi credentials in code
4. Configure WebSocket host/port
5. Upload to ESP32

## 📊 Data and Metrics

### Data sent by ESP32
- `volume`: RAW amplitude (0-100%)
- `volumeFiltered`: Filtered amplitude (0-100%)
- `peakToPeak`: Peak-to-peak (ADC units)
- `bands`: Array with 9 FFT bands (RAW)
- `bandsFiltered`: Array with 9 FFT bands (FILTERED)
- `snrRaw`: Signal-to-Noise Ratio RAW (dB)
- `snrFiltered`: Signal-to-Noise Ratio FILTERED (dB)
- `min`, `max`, `avg`: ADC values

### Available Filters
- **Low-Pass**: Removes frequencies above cutoff
- **High-Pass**: Removes frequencies below cutoff
- **Band-Pass**: Keeps frequencies between 2 cutoffs
- **Voice Boost**: Amplification for vocal bands (500Hz-2500Hz)

## 🛠️ Technologies

- **ESP32**: WiFi-enabled microcontroller
- **FastAPI**: Modern Python backend
- **React + TypeScript**: Reactive frontend
- **WebSocket**: Bidirectional real-time communication
- **Tailwind CSS**: Modern styling
- **Vite**: Fast build tool for frontend
- **Docker**: Containerization and deployment

## 📝 Project Structure

```
psad-project/
├── arduino/              # ESP32 Firmware
│   └── microphone_websocket.ino
├── server/               # FastAPI Backend
│   ├── app.py
│   ├── routes/          # API & WebSocket routes
│   ├── services/        # Business logic
│   ├── config/          # Configuration
│   └── requirements.txt
├── client/              # React Frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/      # Custom hooks
│   │   └── services/   # API utilities
│   └── package.json
├── docker-compose.yml   # Docker orchestration
├── Dockerfile.backend   # Backend container
├── Dockerfile.frontend  # Frontend container
└── README.md
```

## 🔐 Environment Variables

### Backend
No environment variables required (configured in code)

### Frontend
Create `.env` in `client/`:
```env
VITE_API_URL_FASTAPI=wss://your-backend-url.com
```

## 📈 Performance

- **Sample Rate**: 16kHz
- **FFT Resolution**: 128 samples (~125Hz per bin)
- **Update Rate**: 350ms (configurable)
- **Frequency Range**: 0-8kHz
- **Bands**: 9 bands optimized for human voice

## 🐛 Troubleshooting

### ESP32 not connecting
- Check WiFi credentials
- Check WebSocket host/port
- Verify backend is running

### Frontend not receiving data
- Check WebSocket connection in browser console
- Verify ESP32 is sending data
- Check CORS settings in backend

### Docker issues
- Verify ports 3000 and 8000 are available
- Check logs: `docker-compose logs`

## 📄 License

See `LICENSE` for details.

## 👤 Author

Cristi Miloiu
