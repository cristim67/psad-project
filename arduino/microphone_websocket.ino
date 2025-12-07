#include <WiFi.h>
#include <WebSocketsClient.h>
#include <math.h>

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================
const char *ssid = "NAVA-MAMA 5829";
const char *password = "D76?b492";

// Production URL (Genezio)
const char *WS_HOST = "12516655-cf60-4d71-a6cd-3c600fd03052.eu-central-1.cloud.genez.io";
const int WS_PORT = 443;
const char *WS_PATH = "/ws";

// ============================================================================
// HARDWARE CONFIGURATION
// ============================================================================
const int MIC_PIN = 34; // ADC pin for microphone

// ============================================================================
// FFT CONFIGURATION
// ============================================================================
const int FFT_SAMPLES = 128;      // Number of samples for FFT
const int SAMPLE_RATE_HZ = 16000; // 16kHz = can detect up to 8kHz
const int SAMPLE_DELAY_US = 62;   // 1000000 / 16000 = 62.5 microseconds

// Number of frequency bands
const int NUM_BANDS = 9;

// Frequency band definition (optimized for human voice + high frequencies)
// Band 0: 0-250Hz      (bass, breathing)
// Band 1: 250-500Hz    (male voice fundamental)
// Band 2: 500-1000Hz   (female voice fundamental, formants)
// Band 3: 1000-1500Hz  (vocal formants)
// Band 4: 1500-2000Hz  (voice clarity)
// Band 5: 2000-2500Hz  (sibilants, consonants)
// Band 6: 2500-3000Hz  (clarity, "s", "t")
// Band 7: 3000-4000Hz  (brightness, noise)
// Band 8: 4000-8000Hz  (high frequencies, harmonics)

// ============================================================================
// ADJUSTABLE PARAMETERS (received from Frontend)
// ============================================================================
int AMP_REF = 650;              // Reference amplitude (optimized for voice)
int NOISE_GATE_THRESHOLD = 12;  // Noise gate threshold (%) - lower for weak voice
float SMOOTHING_ALPHA = 0.5f;   // Alpha for exponential smoothing (faster)
float VOICE_BOOST = 2.0f;       // Boost for voice bands (500Hz-2500Hz) - higher
float BAND_SMOOTH_ALPHA = 0.3f; // Smoothing for FFT bands (faster, more precise)

// Filter parameters
String filterType = "lowpass"; // lowpass, highpass, bandpass, bypass
int cutoffFreq = 1200;         // Cutoff frequency in Hz (low for bandpass)
int cutoffFreqHigh = 2500;     // High cutoff frequency in Hz (for bandpass)

// ============================================================================
// BUFFERS AND STATE VARIABLES
// ============================================================================

// Noise filtering
const int FILTER_SIZE = 3;
float volumeHistory[FILTER_SIZE] = {0};
int filterIndex = 0;
float smoothedVolume = 0;

// Buffer for FFT samples
float samples[FFT_SAMPLES];
float bands[NUM_BANDS] = {0};
float bandsFiltered[NUM_BANDS] = {0};

// Smoothing for bands
float bandSmoothing[NUM_BANDS] = {0};

// Automatic calibration - measures background noise
float noiseFloor[NUM_BANDS] = {0};
bool calibrated = false;
int calibrationSamples = 0;
const int CALIBRATION_COUNT = 30; // 30 samples for better calibration (~4-5 seconds)

// Fixed send interval
const unsigned long SEND_INTERVAL = 350; // 350ms fixed - slower for stability

// WebSocket
WebSocketsClient webSocket;
bool isConnected = false;
unsigned long lastSendTime = 0;

// ============================================================================
// MESSAGE PARSING FUNCTIONS
// ============================================================================

void parseFilterSettings(const char *json)
{
    // Simple JSON parsing for filter settings
    // Format: {"type":"filter_settings","settings":{"noiseGate":15,...}}

    String str = String(json);

    if (str.indexOf("filter_settings") == -1)
        return;

    // Parse noiseGate
    int idx = str.indexOf("\"noiseGate\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 12).toInt();
        if (val >= 0 && val <= 50)
        {
            NOISE_GATE_THRESHOLD = val;
            Serial.printf("🎛️ Noise Gate: %d%%\n", val);
        }
    }

    // Parse smoothingAlpha (comes as 0-100, convert to 0.0-1.0)
    idx = str.indexOf("\"smoothingAlpha\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 17).toInt();
        if (val >= 10 && val <= 100)
        {
            SMOOTHING_ALPHA = val / 100.0f;
            Serial.printf("🎛️ Smoothing: %.2f\n", SMOOTHING_ALPHA);
        }
    }

    // Parse voiceBoost (comes as 100-300, convert to 1.0-3.0)
    idx = str.indexOf("\"voiceBoost\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 13).toInt();
        if (val >= 100 && val <= 300)
        {
            VOICE_BOOST = val / 100.0f;
            Serial.printf("🎛️ Voice Boost: %.1fx\n", VOICE_BOOST);
        }
    }

    // Parse bandSmooth (comes as 10-90, convert to 0.1-0.9)
    idx = str.indexOf("\"bandSmooth\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 13).toInt();
        if (val >= 10 && val <= 90)
        {
            BAND_SMOOTH_ALPHA = val / 100.0f;
            Serial.printf("🎛️ Band Smooth: %.2f\n", BAND_SMOOTH_ALPHA);
        }
    }

    // Parse ampRef
    idx = str.indexOf("\"ampRef\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 9).toInt();
        if (val >= 200 && val <= 1000)
        {
            AMP_REF = val;
            Serial.printf("🎛️ Amp Ref: %d\n", val);
        }
    }

    // Parse filterType
    idx = str.indexOf("\"filterType\":\"");
    if (idx > 0)
    {
        int startIdx = idx + 14;
        int endIdx = str.indexOf("\"", startIdx);
        if (endIdx > startIdx)
        {
            String type = str.substring(startIdx, endIdx);
            filterType = type;
            Serial.printf("🎛️ Filter Type: %s\n", filterType.c_str());
        }
    }

    // Parse cutoffFreq
    idx = str.indexOf("\"cutoffFreq\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 13).toInt();
        if (val >= 100 && val <= 8000)
        {
            cutoffFreq = val;
            Serial.printf("🎛️ Cutoff Frequency: %d Hz\n", cutoffFreq);
        }
    }

    // Parse cutoffFreqHigh (for bandpass)
    idx = str.indexOf("\"cutoffFreqHigh\":");
    if (idx > 0)
    {
        int val = str.substring(idx + 17).toInt();
        if (val >= 100 && val <= 8000 && val > cutoffFreq)
        {
            cutoffFreqHigh = val;
            Serial.printf("🎛️ Cutoff Frequency High: %d Hz\n", cutoffFreqHigh);
        }
    }

    Serial.println("✅ Filter settings updated!");
}

void handleCommand(const char *json)
{
    String str = String(json);

    if (str.indexOf("\"command\":\"recalibrate\"") > 0)
    {
        Serial.println("🔄 Recalibrating noise floor...");
        calibrated = false;
        calibrationSamples = 0;
        for (int i = 0; i < NUM_BANDS; i++)
        {
            noiseFloor[i] = 0;
        }
    }
}

// ============================================================================
// WEBSOCKET HANDLERS
// ============================================================================

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type)
    {
    case WStype_CONNECTED:
    {
        Serial.println("✅ WebSocket connected!");
        Serial.printf("   URL: wss://%s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);
        isConnected = true;
        // Send connection message (non-blocking)
        webSocket.sendTXT("{\"source\":\"esp32\",\"type\":\"connected\"}");
        break;
    }

    case WStype_DISCONNECTED:
    {
        Serial.println("❌ WebSocket DISCONNECTED!");
        Serial.println("   Cause: Connection lost or server unavailable");
        Serial.println("   Automatic reconnection will be attempted...");
        isConnected = false;
        break;
    }

    case WStype_ERROR:
    {
        Serial.println("❌ WebSocket ERROR!");
        if (payload != NULL && length > 0)
        {
            Serial.printf("   Error: %.*s\n", length, payload);
        }
        else
        {
            Serial.println("   Error: Unknown");
        }
        isConnected = false;
        break;
    }

    case WStype_TEXT:
    {
        const char *msg = (const char *)payload;

        if (strstr(msg, "filter_settings") != NULL)
        {
            parseFilterSettings(msg);
        }
        else if (strstr(msg, "command") != NULL)
        {
            handleCommand(msg);
        }
    }
    break;

    default:
        break;
    }
}

// ============================================================================
// FILTERING FUNCTIONS
// ============================================================================

float applyMovingAverage(float newValue)
{
    volumeHistory[filterIndex] = newValue;
    filterIndex = (filterIndex + 1) % FILTER_SIZE;

    float sum = 0;
    for (int i = 0; i < FILTER_SIZE; i++)
    {
        sum += volumeHistory[i];
    }
    return sum / FILTER_SIZE;
}

int applyNoiseGate(int value)
{
    if (value <= NOISE_GATE_THRESHOLD)
        return 0;

    int rescaled = (value - NOISE_GATE_THRESHOLD) * 100 / (100 - NOISE_GATE_THRESHOLD);
    if (rescaled > 100)
        rescaled = 100;
    if (rescaled < 0)
        rescaled = 0;
    return rescaled;
}

float applyExponentialSmoothing(float newValue)
{
    smoothedVolume = SMOOTHING_ALPHA * newValue + (1.0f - SMOOTHING_ALPHA) * smoothedVolume;
    return smoothedVolume;
}

// ============================================================================
// FFT FUNCTIONS
// ============================================================================

void calculateBands(float *sampleBuffer, int numSamples, float *outputBands)
{
    // Calculate DC offset and remove it
    float dcOffset = 0;
    for (int i = 0; i < numSamples; i++)
    {
        dcOffset += sampleBuffer[i];
    }
    dcOffset /= numSamples;

    // Apply Hanning window and remove DC
    for (int i = 0; i < numSamples; i++)
    {
        float window = 0.5f * (1.0f - cos(2.0f * PI * i / (numSamples - 1)));
        sampleBuffer[i] = (sampleBuffer[i] - dcOffset) * window;
    }

    // Frequency per bin
    float freqPerBin = (float)SAMPLE_RATE_HZ / numSamples; // ~125 Hz per bin at 16kHz/128

    // Frequency limits for each band (in Hz)
    int bandLimits[NUM_BANDS + 1] = {0, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 8000};

    for (int band = 0; band < NUM_BANDS; band++)
    {
        float energy = 0;
        int startBin = (int)(bandLimits[band] / freqPerBin);
        int endBin = (int)(bandLimits[band + 1] / freqPerBin);

        if (startBin < 1)
            startBin = 1; // Skip DC
        if (endBin > numSamples / 2)
            endBin = numSamples / 2;

        int binCount = 0;
        for (int k = startBin; k < endBin; k++)
        {
            // DFT for bin k
            float real = 0;
            float imag = 0;
            float freq = (2.0f * PI * k) / numSamples;

            for (int n = 0; n < numSamples; n++)
            {
                real += sampleBuffer[n] * cos(freq * n);
                imag -= sampleBuffer[n] * sin(freq * n);
            }

            // Magnitude
            float magnitude = sqrt(real * real + imag * imag);
            energy += magnitude;
            binCount++;
        }

        // Normalizează per număr de bins
        if (binCount > 0)
        {
            energy /= binCount;
        }

        outputBands[band] = energy;
    }

    // Logarithmic scaling for more natural perception (like human ear)
    float maxEnergy = 0;
    for (int i = 0; i < NUM_BANDS; i++)
    {
        if (outputBands[i] > maxEnergy)
            maxEnergy = outputBands[i];
    }

    // Normalize and apply scaling
    float scaleFactor = 100.0f / (AMP_REF * 2.0f);
    for (int i = 0; i < NUM_BANDS; i++)
    {
        // Subtract noise floor if calibrated - optimized for voice
        if (calibrated && outputBands[i] > noiseFloor[i])
        {
            // More aggressive for low bands (where sinusoids are)
            if (i <= 1)
            {
                outputBands[i] -= noiseFloor[i] * 1.3f; // Very aggressive for low bands
            }
            // More conservative for vocal bands (2-5) to preserve voice
            else if (i >= 2 && i <= 5)
            {
                outputBands[i] -= noiseFloor[i] * 0.7f; // More conservative for voice
            }
            else
            {
                outputBands[i] -= noiseFloor[i] * 0.9f; // Standard for others
            }
        }

        outputBands[i] *= scaleFactor;

        // Boost for voice bands (500Hz - 2500Hz)
        if (i >= 2 && i <= 5)
        {
            outputBands[i] *= VOICE_BOOST; // Adjustable boost from frontend
        }

        // Aggressive filtering for low bands in silence (removes sinusoids)
        // But preserve vocal bands even if close to noise floor
        if (calibrated && i <= 1 && outputBands[i] < noiseFloor[i] * 1.8f)
        {
            outputBands[i] = 0; // Completely remove low bands below threshold
        }

        if (outputBands[i] > 100)
            outputBands[i] = 100;
        if (outputBands[i] < 0)
            outputBands[i] = 0;
    }
}

void calibrateNoiseFloor(float *currentBands)
{
    if (calibrationSamples < CALIBRATION_COUNT)
    {
        for (int i = 0; i < NUM_BANDS; i++)
        {
            noiseFloor[i] += currentBands[i];
        }
        calibrationSamples++;

        if (calibrationSamples == CALIBRATION_COUNT)
        {
            for (int i = 0; i < NUM_BANDS; i++)
            {
                noiseFloor[i] /= CALIBRATION_COUNT;
                // Add 20% buffer to ensure we catch noise
                noiseFloor[i] *= 1.2f;
            }
            calibrated = true;
            Serial.println("✅ Calibration complete!");
            Serial.printf("   Noise floor: [%.0f, %.0f, %.0f, %.0f, %.0f, %.0f, %.0f, %.0f, %.0f]\n",
                          noiseFloor[0], noiseFloor[1], noiseFloor[2], noiseFloor[3],
                          noiseFloor[4], noiseFloor[5], noiseFloor[6], noiseFloor[7], noiseFloor[8]);
        }
    }
}

void applyBandSmoothing(float *rawBands, float *smoothedBands)
{
    for (int i = 0; i < NUM_BANDS; i++)
    {
        bandSmoothing[i] = BAND_SMOOTH_ALPHA * rawBands[i] +
                           (1.0f - BAND_SMOOTH_ALPHA) * bandSmoothing[i];
        smoothedBands[i] = bandSmoothing[i];
    }
}

// Apply frequency filter on bands based on filterType and cutoffFreq
void applyFrequencyFilter(float *inputBands, float *outputBands)
{
    // Frequency limits for each band (in Hz) - must be identical to those in calculateBands
    int bandLimits[NUM_BANDS + 1] = {0, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 8000};

    // Copy input to output
    for (int i = 0; i < NUM_BANDS; i++)
    {
        outputBands[i] = inputBands[i];
    }

    // Bypass - don't apply any filter
    if (filterType == "bypass")
    {
        return;
    }

    // Apply filter based on type
    for (int i = 0; i < NUM_BANDS; i++)
    {
        // Calculate band center frequency
        float bandCenterFreq = (bandLimits[i] + bandLimits[i + 1]) / 2.0f;

        if (filterType == "lowpass")
        {
            // Low-pass: remove all bands above cutoffFreq
            if (bandCenterFreq > cutoffFreq)
            {
                outputBands[i] = 0;
            }
        }
        else if (filterType == "highpass")
        {
            // High-pass: remove all bands below cutoffFreq
            if (bandCenterFreq < cutoffFreq)
            {
                outputBands[i] = 0;
            }
        }
        else if (filterType == "bandpass")
        {
            // Band-pass: keep only bands between cutoffFreq and cutoffFreqHigh
            if (bandCenterFreq < cutoffFreq || bandCenterFreq > cutoffFreqHigh)
            {
                outputBands[i] = 0;
            }
        }
    }
}

void applyNoiseGateToBands(float *inputBands, float *outputBands)
{
    for (int i = 0; i < NUM_BANDS; i++)
    {
        int val = (int)inputBands[i];
        // Noise gate more aggressive for low bands, more permissive for vocal bands
        int threshold;
        if (i <= 1)
        {
            threshold = NOISE_GATE_THRESHOLD + 5; // More aggressive for low bands
        }
        else if (i >= 2 && i <= 5)
        {
            threshold = NOISE_GATE_THRESHOLD - 2; // More permissive for vocal bands
        }
        else
        {
            threshold = NOISE_GATE_THRESHOLD; // Standard for others
        }

        if (val <= threshold)
        {
            outputBands[i] = 0;
        }
        else
        {
            int rescaled = (val - threshold) * 100 / (100 - threshold);
            if (rescaled > 100)
                rescaled = 100;
            if (rescaled < 0)
                rescaled = 0;
            outputBands[i] = rescaled;
        }
    }
}

// ============================================================================
// SETUP
// ============================================================================

void setup()
{
    Serial.begin(115200);
    while (!Serial)
        delay(10);
    delay(1000);

    Serial.println();
    Serial.println("════════════════════════════════════════");
    Serial.println("   VOICE FFT ANALYZER - ESP32");
    Serial.println("════════════════════════════════════════");
    Serial.println();

    // ADC configuration
    analogReadResolution(12);
    analogSetPinAttenuation(MIC_PIN, ADC_11db);

    Serial.printf("Pin ADC: GPIO%d\n", MIC_PIN);
    Serial.printf("Sample Rate: %d Hz\n", SAMPLE_RATE_HZ);
    Serial.printf("FFT Samples: %d\n", FFT_SAMPLES);
    Serial.printf("Frequency Range: 0 - %d Hz\n", SAMPLE_RATE_HZ / 2);
    Serial.printf("Number of bands: %d\n", NUM_BANDS);
    Serial.printf("Send Interval: %dms (fixed)\n", SEND_INTERVAL);
    Serial.println("⏳ Calibrating background noise...");

    // WiFi connection
    Serial.printf("Connecting to WiFi: %s\n", ssid);
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
        Serial.print("✅ WiFi connected! IP: ");
        Serial.println(WiFi.localIP());

        webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
        webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");
        webSocket.onEvent(webSocketEvent);
        webSocket.setReconnectInterval(5000);

        Serial.println("⏳ Connecting to WebSocket...");
    }
    else
    {
        Serial.println("❌ WiFi FAILED!");
    }

    Serial.println();
}

// ============================================================================
// MAIN LOOP
// ============================================================================

void loop()
{
    // Call webSocket.loop() in each iteration to keep connection active
    webSocket.loop();

    unsigned long now = millis();
    if (now - lastSendTime < SEND_INTERVAL)
        return;
    lastSendTime = now;

    // Check if connection is still active
    if (!isConnected)
    {
        static unsigned long lastCheckTime = 0;
        unsigned long now = millis();
        // Log once every 5 seconds when not connected
        if (now - lastCheckTime > 5000)
        {
            Serial.println("⚠️ WebSocket is not connected - waiting for reconnection...");
            lastCheckTime = now;
        }
        return; // Don't send if not connected
    }

    // Check if WebSocket connection is functional
    if (!webSocket.isConnected())
    {
        static unsigned long lastErrorTime = 0;
        unsigned long now = millis();
        // Log once every 2 seconds when connection is lost
        if (now - lastErrorTime > 2000)
        {
            Serial.println("⚠️ WebSocket.isConnected() returns false!");
            Serial.println("   Updating connection state...");
            isConnected = false;
            lastErrorTime = now;
        }
        return;
    }

    // Collect samples for FFT - fast sampling
    int minVal = 4095;
    int maxVal = 0;
    long sum = 0;

    unsigned long sampleStart = micros();
    for (int i = 0; i < FFT_SAMPLES; i++)
    {
        int val = analogRead(MIC_PIN);
        samples[i] = (float)val;

        if (val < minVal)
            minVal = val;
        if (val > maxVal)
            maxVal = val;
        sum += val;

        // Wait for correct sample rate
        while (micros() - sampleStart < (i + 1) * SAMPLE_DELAY_US)
        {
            // Busy wait for precise timing
        }
    }

    float avg = (float)sum / FFT_SAMPLES;
    int amplitude = maxVal - minVal;

    // ========== FFT BAND CALCULATION ==========
    calculateBands(samples, FFT_SAMPLES, bands);

    // Automatic calibration in first seconds
    if (!calibrated)
    {
        calibrateNoiseFloor(bands);
    }

    applyBandSmoothing(bands, bands);

    // Apply frequency filter (low-pass, high-pass, etc.) on bands
    applyFrequencyFilter(bands, bandsFiltered);

    // Apply noise gate to bands for filtered version
    applyNoiseGateToBands(bandsFiltered, bandsFiltered);

    // ========== SNR CALCULATION ==========
    // Calculate SNR only if calibrated (otherwise 0)
    float snrRaw = 0;
    float snrFiltered = 0;

    if (calibrated)
    {
        // SNR for RAW: ratio between signal energy and noise floor
        float signalEnergyRaw = 0;
        float noiseEnergyRaw = 0;
        for (int i = 0; i < NUM_BANDS; i++)
        {
            signalEnergyRaw += bands[i] * bands[i];
            noiseEnergyRaw += noiseFloor[i] * noiseFloor[i];
        }
        if (noiseEnergyRaw > 0 && signalEnergyRaw > noiseEnergyRaw)
        {
            snrRaw = 10.0f * log10f(signalEnergyRaw / noiseEnergyRaw);
        }

        // SNR for FILTERED: ratio between filtered signal energy and noise floor
        float signalEnergyFiltered = 0;
        float noiseEnergyFiltered = 0;
        for (int i = 0; i < NUM_BANDS; i++)
        {
            signalEnergyFiltered += bandsFiltered[i] * bandsFiltered[i];
            noiseEnergyFiltered += noiseFloor[i] * noiseFloor[i];
        }
        if (noiseEnergyFiltered > 0 && signalEnergyFiltered > noiseEnergyFiltered)
        {
            snrFiltered = 10.0f * log10f(signalEnergyFiltered / noiseEnergyFiltered);
        }
    }

    // ========== RAW VOLUME ==========
    int volumeRaw = (int)((float)amplitude * 100.0f / AMP_REF);
    if (volumeRaw > 100)
        volumeRaw = 100;
    if (volumeRaw < 0)
        volumeRaw = 0;

    // ========== FILTERED VOLUME ==========
    int volumeGated = applyNoiseGate(volumeRaw);
    float volumeMA = applyMovingAverage((float)volumeGated);
    float volumeSmooth = applyExponentialSmoothing(volumeMA);
    int volumeFiltered = (int)volumeSmooth;
    if (volumeFiltered > 100)
        volumeFiltered = 100;
    if (volumeFiltered < 0)
        volumeFiltered = 0;

    // ========== SEND DATA ==========
    // Check if WebSocket is connected and functional
    if (isConnected && webSocket.isConnected())
    {
        // Larger buffer to avoid overflow
        char msg[900];
        char bandsRawStr[150];
        char bandsFilteredStr[150];

        // Formatează benzi
        snprintf(bandsRawStr, sizeof(bandsRawStr), "[%d,%d,%d,%d,%d,%d,%d,%d,%d]",
                 (int)bands[0], (int)bands[1], (int)bands[2], (int)bands[3],
                 (int)bands[4], (int)bands[5], (int)bands[6], (int)bands[7], (int)bands[8]);

        snprintf(bandsFilteredStr, sizeof(bandsFilteredStr), "[%d,%d,%d,%d,%d,%d,%d,%d,%d]",
                 (int)bandsFiltered[0], (int)bandsFiltered[1], (int)bandsFiltered[2], (int)bandsFiltered[3],
                 (int)bandsFiltered[4], (int)bandsFiltered[5], (int)bandsFiltered[6], (int)bandsFiltered[7], (int)bandsFiltered[8]);

        // Construiește mesajul JSON
        int msgLen = snprintf(msg, sizeof(msg),
                              "{\"source\":\"esp32\","
                              "\"type\":\"microphone_data\","
                              "\"volume\":%d,"
                              "\"volumeFiltered\":%d,"
                              "\"peakToPeak\":%d,"
                              "\"min\":%d,"
                              "\"max\":%d,"
                              "\"avg\":%.1f,"
                              "\"bands\":%s,"
                              "\"bandsFiltered\":%s,"
                              "\"calibrated\":%s,"
                              "\"snrRaw\":%.1f,"
                              "\"snrFiltered\":%.1f}",
                              volumeRaw, volumeFiltered, amplitude, minVal, maxVal, avg,
                              bandsRawStr, bandsFilteredStr,
                              calibrated ? "true" : "false",
                              snrRaw, snrFiltered);

        // Check if message was formatted correctly (no overflow)
        if (msgLen > 0 && msgLen < (int)sizeof(msg))
        {
            bool sent = webSocket.sendTXT(msg);
            if (!sent)
            {
                Serial.println("❌ ERROR: Could not send WebSocket message!");
                Serial.println("   Check connection and buffer");
                isConnected = false; // Mark as disconnected
            }
        }
        else
        {
            // Message too large - send without SNR if necessary
            Serial.printf("⚠️ Message too large (%d bytes), sending without SNR\n", msgLen);
            msgLen = snprintf(msg, sizeof(msg),
                              "{\"source\":\"esp32\","
                              "\"type\":\"microphone_data\","
                              "\"volume\":%d,"
                              "\"volumeFiltered\":%d,"
                              "\"peakToPeak\":%d,"
                              "\"min\":%d,"
                              "\"max\":%d,"
                              "\"avg\":%.1f,"
                              "\"bands\":%s,"
                              "\"bandsFiltered\":%s,"
                              "\"calibrated\":%s}",
                              volumeRaw, volumeFiltered, amplitude, minVal, maxVal, avg,
                              bandsRawStr, bandsFilteredStr,
                              calibrated ? "true" : "false");
            if (msgLen > 0 && msgLen < (int)sizeof(msg))
            {
                webSocket.sendTXT(msg);
            }
        }
    }
}
