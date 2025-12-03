#include <WiFi.h>
#include <WebSocketsClient.h>

const char *ssid = "NAVA-MAMA 5829";
const char *password = "D76?b492";

WebSocketsClient webSocket;

// Variables for repetitive sending
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 200; // 200ms
bool isConnected = false;

// Variables for receiving and processing audio data
String receivedAudioBase64 = "";
unsigned long receivedTimestamp = 0;
unsigned long lastDataReceivedTime = 0;
const unsigned long DATA_TIMEOUT = 2000; // 2 seconds timeout
bool hasAudioData = false;

// Audio processing variables
int processedVolume = 0;
int processedPeakToPeak = 0;
int audioRate = 44100;
int audioChannels = 1;
int audioChunkSize = 1024;

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type)
    {
    case WStype_CONNECTED:
        Serial.println("✅ WebSocket connected!");
        Serial.print("📡 Connected to: ");
        if (length > 0)
        {
            Serial.println((char *)payload);
        }
        else
        {
            Serial.println("ngrok server");
        }
        isConnected = true;
        lastSendTime = millis();
        Serial.println("✅ Ready to receive and process raw audio data from server");
        break;

    case WStype_TEXT:
    {
        // Parse JSON with raw audio data from server
        // Format: {"source":"laptop_microphone","audio_data":"base64...","format":"int16","channels":1,"rate":44100,"chunk_size":1024,"timestamp":Z}
        String message = String((char *)payload);

        // Extract audio_data (base64 encoded)
        int audioStart = message.indexOf("\"audio_data\":\"");
        if (audioStart >= 0)
        {
            audioStart += 14; // Skip "audio_data":"
            int audioEnd = message.indexOf("\"", audioStart);
            if (audioEnd > audioStart)
            {
                String audioBase64 = message.substring(audioStart, audioEnd);

                // Extract metadata (optional, for reference)
                int rateStart = message.indexOf("\"rate\":");
                if (rateStart >= 0)
                {
                    int rateEnd = message.indexOf(",", rateStart);
                    if (rateEnd < 0)
                        rateEnd = message.indexOf("}", rateStart);
                    if (rateEnd > rateStart)
                    {
                        String rateStr = message.substring(rateStart + 7, rateEnd);
                        audioRate = rateStr.toInt();
                    }
                }

                int chunkStart = message.indexOf("\"chunk_size\":");
                if (chunkStart >= 0)
                {
                    int chunkEnd = message.indexOf(",", chunkStart);
                    if (chunkEnd < 0)
                        chunkEnd = message.indexOf("}", chunkStart);
                    if (chunkEnd > chunkStart)
                    {
                        String chunkStr = message.substring(chunkStart + 13, chunkEnd);
                        audioChunkSize = chunkStr.toInt();
                    }
                }

                // Extract timestamp
                int tsStart = message.indexOf("\"timestamp\":");
                if (tsStart >= 0)
                {
                    int tsEnd = message.indexOf("}", tsStart);
                    if (tsEnd < 0)
                        tsEnd = message.indexOf(",", tsStart);
                    if (tsEnd > tsStart)
                    {
                        String tsStr = message.substring(tsStart + 12, tsEnd);
                        receivedTimestamp = tsStr.toInt();
                    }
                }

                // Decode base64 and process audio
                Serial.print("📥 Received audio data (base64 length: ");
                Serial.print(audioBase64.length());
                Serial.println(")");

                String decodedAudio = base64Decode(audioBase64);
                processAudioData(decodedAudio);

                hasAudioData = true;
                lastDataReceivedTime = millis();

                Serial.print("🎤 Processed: Volume=");
                Serial.print(processedVolume);
                Serial.print(", PeakToPeak=");
                Serial.println(processedPeakToPeak);
            }
        }
        break;
    }

    case WStype_DISCONNECTED:
        Serial.println("❌ WebSocket disconnected!");
        Serial.print("Reason: ");
        if (length > 0)
        {
            Serial.println((char *)payload);
        }
        else
        {
            Serial.println("Connection closed by server or network issue");
        }
        isConnected = false;
        break;

    case WStype_ERROR:
        Serial.print("❌ WebSocket error: ");
        if (length > 0)
        {
            Serial.print((char *)payload);
            Serial.print(" (length: ");
            Serial.print(length);
            Serial.println(")");
        }
        else
        {
            Serial.println("Unknown error - check SSL certificate or server availability");
        }
        isConnected = false;
        Serial.println("Will retry connection in 15 seconds...");
        break;

    case WStype_PING:
        Serial.println("📡 Ping received");
        break;

    case WStype_PONG:
        Serial.println("📡 Pong received");
        break;

    default:
        Serial.print("ℹ️ WebSocket event: ");
        Serial.print(type);
        if (length > 0)
        {
            Serial.print(" - ");
            Serial.println((char *)payload);
        }
        else
        {
            Serial.println();
        }
        break;
    }
}

// Base64 decoding function (simplified)
String base64Decode(String input)
{
    String output = "";
    String base64_chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    int in_len = input.length();
    int i = 0;
    int in = 0;
    unsigned char char_array_4[4], char_array_3[3];

    while (in_len-- && (input[in] != '=') && isBase64(input[in]))
    {
        char_array_4[i++] = input[in];
        in++;
        if (i == 4)
        {
            for (i = 0; i < 4; i++)
                char_array_4[i] = base64_chars.indexOf(char_array_4[i]);

            char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
            char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
            char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

            for (i = 0; (i < 3); i++)
                output += char_array_3[i];
            i = 0;
        }
    }

    if (i)
    {
        for (int j = i; j < 4; j++)
            char_array_4[j] = 0;

        for (int j = 0; j < 4; j++)
            char_array_4[j] = base64_chars.indexOf(char_array_4[j]);

        char_array_3[0] = (char_array_4[0] << 2) + ((char_array_4[1] & 0x30) >> 4);
        char_array_3[1] = ((char_array_4[1] & 0xf) << 4) + ((char_array_4[2] & 0x3c) >> 2);
        char_array_3[2] = ((char_array_4[2] & 0x3) << 6) + char_array_4[3];

        for (int j = 0; (j < i - 1); j++)
            output += char_array_3[j];
    }

    return output;
}

bool isBase64(unsigned char c)
{
    return (isalnum(c) || (c == '+') || (c == '/'));
}

// Process audio data (int16 samples) and calculate volume and peak-to-peak
void processAudioData(String audioData)
{
    int dataLength = audioData.length();
    if (dataLength < 2)
    {
        processedVolume = 0;
        processedPeakToPeak = 0;
        return;
    }

    // Convert String to byte array (int16 samples)
    int16_t signalMax = -32768;
    int16_t signalMin = 32767;
    long sum = 0;
    int sampleCount = 0;

    // Process audio data as int16 samples (2 bytes per sample)
    for (int i = 0; i < dataLength - 1; i += 2)
    {
        // Combine two bytes into int16 (little-endian)
        int16_t sample = (int16_t)((uint8_t)audioData[i] | ((uint8_t)audioData[i + 1] << 8));

        sum += abs(sample);
        if (sample > signalMax)
            signalMax = sample;
        if (sample < signalMin)
            signalMin = sample;
        sampleCount++;
    }

    if (sampleCount == 0)
    {
        processedVolume = 0;
        processedPeakToPeak = 0;
        return;
    }

    // Calculate peak-to-peak amplitude
    processedPeakToPeak = signalMax - signalMin;

    // Calculate RMS-like value (average of absolute values)
    long avgAmplitude = sum / sampleCount;

    // Convert to volume (0-100 scale)
    // For 16-bit audio, map 0-6000 peak-to-peak to 0-100 volume
    if (processedPeakToPeak > 0)
    {
        processedVolume = map(processedPeakToPeak, 0, 6000, 0, 100);
        processedVolume = constrain(processedVolume, 0, 100);

        // Minimum threshold to eliminate background noise
        if (processedPeakToPeak < 100)
        {
            processedVolume = 0;
        }
    }
    else
    {
        processedVolume = 0;
    }
}

void setup()
{
    Serial.begin(115200);
    delay(1000);

    Serial.println("🎤 Arduino Audio Processor");
    Serial.println("   Receives raw audio data via WebSocket");
    Serial.println("   Processes audio locally (volume, peak-to-peak)");
    Serial.println();

    Serial.println("Connecting to WiFi...");
    WiFi.begin(ssid, password);

    int timeout = 0;
    while (WiFi.status() != WL_CONNECTED && timeout < 20)
    {
        delay(500);
        Serial.print(".");
        timeout++;
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED)
    {
        Serial.println("✅ Connected to WiFi!");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());

        // Connect to WebSocket server with SSL
        // beginSSL handles SSL automatically
        Serial.println("🔌 Configuring WebSocket connection...");
        Serial.print("   Host: tunnel.cristimiloiu.com");
        Serial.println(":443/ws");

        webSocket.beginSSL("tunnel.cristimiloiu.com", 443, "/ws");

        // Add header for ngrok (bypass warning page)
        webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");

        webSocket.onEvent(webSocketEvent);
        // Longer reconnect interval to give SSL handshake time
        webSocket.setReconnectInterval(15000); // 15 seconds - ngrok can be slow

        // Enable debug output (if available in library)
        // webSocket.enableHeartbeat(15000, 3000, 2); // ping every 15s, timeout 3s, retry 2x

        Serial.println("🔌 Attempting WebSocket connection to server...");
        Serial.println("⏳ SSL handshake may take 10-15 seconds, please wait...");
        Serial.println("💡 Make sure:");
        Serial.println("   1. Server is running and sending raw audio data");
        Serial.println("   2. Server is sending audio data via WebSocket");
        Serial.println("   3. URL matches your server domain");
        Serial.println("🎤 Ready to receive and process raw audio data!");
    }
    else
    {
        Serial.println("❌ Could not connect to WiFi!");
    }
}

void loop()
{
    webSocket.loop(); // Must be called constantly

    // Connection status monitoring
    static unsigned long lastStatusCheck = 0;
    if (millis() - lastStatusCheck > 5000) // Every 5 seconds
    {
        if (!isConnected && WiFi.status() == WL_CONNECTED)
        {
            Serial.println("⏳ Waiting for WebSocket connection...");
        }
        lastStatusCheck = millis();
    }

    // Check if audio data has timed out
    if (hasAudioData && (millis() - lastDataReceivedTime > DATA_TIMEOUT))
    {
        hasAudioData = false;
        Serial.println("⚠️ Audio data timeout - no data received");
    }

    // Process received audio data (if available)
    if (hasAudioData && (millis() - lastSendTime >= sendInterval))
    {
        // Display processed audio data
        Serial.print("📊 Processed Audio: Volume=");
        Serial.print(processedVolume);
        Serial.print(" | PeakToPeak=");
        Serial.print(processedPeakToPeak);
        Serial.print(" | Timestamp=");
        Serial.print(receivedTimestamp);
        Serial.print(" | Rate=");
        Serial.print(audioRate);
        Serial.print("Hz | Chunk=");
        Serial.print(audioChunkSize);
        Serial.println(" samples");

        // Here you can add your processing logic for the audio data
        // For example: control LEDs, motors, or other actuators based on volume

        // Example: Print volume level
        if (processedVolume > 50)
        {
            Serial.println("🔊 High volume detected!");
            // Add your high volume actions here (e.g., LED control, motor control)
        }
        else if (processedVolume > 20)
        {
            Serial.println("🔉 Medium volume");
            // Add your medium volume actions here
        }
        else if (processedVolume > 0)
        {
            Serial.println("🔈 Low volume");
            // Add your low volume actions here
        }
        else
        {
            Serial.println("🔇 Silent");
        }

        lastSendTime = millis();
    }
}
