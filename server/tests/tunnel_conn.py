#!/usr/bin/env python3
"""
Simple script for testing WebSocket connection
"""

import asyncio
import sys
from datetime import datetime

try:
    import websockets
except ImportError:
    print("❌ Package 'websockets' is not installed!")
    print("   Install with: pip3 install websockets")
    sys.exit(1)


async def test_websocket(url):
    """Test WebSocket connection"""
    print(f"🔌 Connecting to {url}...")
    
    try:
        async with websockets.connect(url) as websocket:
            print("✅ Connected successfully!\n")
            
            # Wait for welcome message
            try:
                welcome = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"📥 Received message: {welcome}\n")
            except asyncio.TimeoutError:
                print("⏱️  No welcome message received\n")
            
            # Send a test message
            test_message = '{"temperature":25,"humidity":60}'
            print(f"📤 Sent: {test_message}")
            await websocket.send(test_message)
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"📥 Response: {response}\n")
            
            print("✅ Test successful!")
            
    except websockets.exceptions.InvalidURI:
        print(f"❌ Invalid URL: {url}")
        print("   Use: ws://localhost:8000/ws or wss://tunnel.cristimiloiu.com/ws")
    except websockets.exceptions.InvalidStatus as e:
        print(f"❌ Server rejected WebSocket connection: {e}")
        print(f"   HTTP Status: {e.status_code if hasattr(e, 'status_code') else 'Unknown'}")
        print("   Check:")
        print("   - If server is running")
        print("   - If path is correct (/ws)")
    except ConnectionRefusedError:
        print(f"❌ Connection refused")
        print("   Check if server is running on the correct port")
    except asyncio.TimeoutError:
        print("❌ Timeout - no response received")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()


def main():
    # Default URL: local
    # default_url = "ws://localhost:8000/ws"
    default_url = "wss://tunnel.cristimiloiu.com/ws"
    
    # URL from argument or default
    url = sys.argv[1] if len(sys.argv) > 1 else default_url
    
    # Check URL format
    if not url.startswith(('ws://', 'wss://')):
        print("⚠️  URL must start with ws:// or wss://")
        print(f"   You provided: {url}")
        print(f"\n   Examples:")
        print(f"   python3 test.py ws://localhost:8000/ws")
        print(f"   python3 test.py wss://tunnel.cristimiloiu.com/ws")
        sys.exit(1)
    
    print("🚀 WebSocket Test")
    print(f"   URL: {url}\n")
    
    try:
        asyncio.run(test_websocket(url))
    except KeyboardInterrupt:
        print("\n\n👋 Exiting...")


if __name__ == "__main__":
    main()

