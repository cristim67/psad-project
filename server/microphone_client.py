#!/usr/bin/env python3
import argparse
import asyncio
import json
import sys
import time

try:
    import pyaudio
    import websockets
except ImportError as e:
    print(f"❌ Error: Missing dependency: {e}")
    print("📦 Install with: pip install pyaudio websockets")
    sys.exit(1)


class MicrophoneClient:
    def __init__(self, websocket_url: str):
        self.websocket_url = websocket_url
        self.websocket = None
        
        # Audio configuration
        self.CHUNK = 1024  # Number of samples per chunk
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1  # Mono
        self.RATE = 44100  # Sample rate
        self.SEND_INTERVAL_MS = 50  # Faster sending for real-time processing
        
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.send_count = 0  # Counter for debug output
    
    def start_audio_stream(self) -> bool:
        """Start audio stream"""
        try:
            self.stream = self.audio.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                input=True,
                frames_per_buffer=self.CHUNK
            )
            print("✅ Microphone started")
            print(f"   Sample rate: {self.RATE} Hz")
            print(f"   Chunk size: {self.CHUNK} samples")
            return True
        except Exception as e:
            print(f"❌ Error starting microphone: {e}")
            return False
    
    async def connect_websocket(self) -> bool:
        """Connect to server via WebSocket"""
        try:
            print(f"🔌 Connecting to {self.websocket_url}...")
            
            # Headers for ngrok (bypass warning page)
            additional_headers = {}
            if "ngrok" in self.websocket_url:
                additional_headers["ngrok-skip-browser-warning"] = "true"
            
            self.websocket = await websockets.connect(
                self.websocket_url,
                additional_headers=additional_headers
            )
            print("✅ Connected to server!")
            return True
        except websockets.exceptions.InvalidURI:
            print(f"❌ Invalid URL: {self.websocket_url}")
            print("   Use: ws://localhost:8000/ws-microphone or wss://your-ngrok-url/ws-microphone")
            return False
        except websockets.exceptions.InvalidStatus as e:
            print(f"❌ Server rejected WebSocket connection: {e}")
            print(f"   HTTP Status: {e.status_code if hasattr(e, 'status_code') else 'Unknown'}")
            print("   Check:")
            print("   - If server is running")
            print("   - If path is correct (/ws-microphone)")
            print("   - If ngrok is exposing the server correctly")
            return False
        except ConnectionRefusedError:
            print(f"❌ Connection refused")
            print("   Check if server is running on the correct port")
            return False
        except Exception as e:
            print(f"❌ WebSocket connection error: {type(e).__name__}: {e}")
            return False
    
    async def send_audio_data(self, audio_data: bytes, timestamp: int):
        """Send raw audio data to server via WebSocket (no base64 encoding)"""
        if not self.websocket:
            return False
        
        # Convert bytes to array of integers (more efficient than base64)
        audio_array = list(audio_data)
        
        # JSON format with raw audio data as array
        message = {
            "source": "laptop_microphone",
            "audio_data": audio_array,  # Direct bytes array, no base64
            "format": "int16",
            "channels": self.CHANNELS,
            "rate": self.RATE,
            "chunk_size": self.CHUNK,
            "timestamp": timestamp
        }
        
        try:
            await self.websocket.send(json.dumps(message))
            return True
        except Exception as e:
            print(f"⚠️ Error sending data: {e}")
            return False
    
    async def run(self):
        """Run main loop"""
        if not await self.connect_websocket():
            return
        
        if not self.start_audio_stream():
            return
        
        print("\n🎤 Audio capture started...")
        print("💡 Press Ctrl+C to stop\n")
        
        last_send_time = 0
        
        try:
            while True:
                current_time_ms = int(time.time() * 1000)
                
                # Read audio data
                try:
                    audio_data = self.stream.read(self.CHUNK, exception_on_overflow=False)
                except Exception as e:
                    print(f"⚠️ Error reading audio: {e}")
                    await asyncio.sleep(0.1)
                    continue
                
                # Send at each interval (no delay - send immediately)
                if current_time_ms - last_send_time >= self.SEND_INTERVAL_MS:
                    # Send raw audio data to server (no processing)
                    await self.send_audio_data(audio_data, current_time_ms)
                    
                    # Debug output (less frequent to avoid spam)
                    self.send_count += 1
                    if self.send_count % 10 == 0:  # Print every 10th chunk
                        print(f"📤 Sent audio chunk: {len(audio_data)} bytes (total: {self.send_count})")
                    
                    last_send_time = current_time_ms
                
                # No delay - read continuously for maximum throughput
                
        except KeyboardInterrupt:
            print("\n\n⏹️  Stopping...")
        except websockets.exceptions.ConnectionClosed:
            print("\n❌ WebSocket connection closed")
        finally:
            await self.cleanup()
    
    async def cleanup(self):
        """Curăță resursele"""
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        if self.audio:
            self.audio.terminate()
        if self.websocket:
            await self.websocket.close()
        print("✅ Resurse eliberate")


def main():
    parser = argparse.ArgumentParser(
        description="Client for laptop microphone - sends raw audio data via WebSocket (no processing)"
    )
    parser.add_argument(
        "--url", "-u",
        type=str,
        default="wss://tunnel.cristimiloiu.com/ws-microphone",
        help="WebSocket server URL (default: wss://tunnel.cristimiloiu.com/ws-microphone)"
    )
    
    args = parser.parse_args()
    
    # Check URL format
    if not args.url.startswith(('ws://', 'wss://')):
        print("⚠️  URL must start with ws:// or wss://")
        print(f"   You provided: {args.url}")
        print(f"\n   Examples:")
        print(f"   python microphone_client.py --url ws://localhost:8000/ws-microphone")
        print(f"   python microphone_client.py --url wss://tunnel.cristimiloiu.com/ws-microphone")
        sys.exit(1)
    
    client = MicrophoneClient(args.url)
    
    try:
        asyncio.run(client.run())
    except KeyboardInterrupt:
        print("\n✅ Shutdown complete")


if __name__ == "__main__":
    main()

