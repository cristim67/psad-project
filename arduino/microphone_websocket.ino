#include <WiFi.h>
#include <WebSocketsClient.h>
#include <math.h>

// ============================================================================
// CONFIGURARE NETWORK
// ============================================================================
const char *ssid = "NAVA-MAMA 5829";
const char *password = "D76?b492";

// Production URL (Genezio)
const char *WS_HOST = "12516655-cf60-4d71-a6cd-3c600fd03052.eu-central-1.cloud.genez.io";
const int WS_PORT = 443;
const char *WS_PATH = "/ws";

// ============================================================================
// CONFIGURARE HARDWARE
// ============================================================================
const int MIC_PIN = 34; // Pinul ADC pentru microfon

// ============================================================================
// CONFIGURARE FFT
// ============================================================================
const int FFT_SAMPLES = 128;      // Număr de eșantioane pentru FFT
const int SAMPLE_RATE_HZ = 16000; // 16kHz = putem detecta până la 8kHz
const int SAMPLE_DELAY_US = 62;   // 1000000 / 16000 = 62.5 microsecunde

// Număr de benzi de frecvență
const int NUM_BANDS = 9;

// Definiție benzi de frecvență (optimizate pentru voce umana + frecvențe înalte)
// Banda 0: 0-250Hz      (bass, respirație)
// Banda 1: 250-500Hz    (fundamentala voce bărbat)
// Banda 2: 500-1000Hz   (fundamentala voce femeie, formanți)
// Banda 3: 1000-1500Hz  (formanți vocali)
// Banda 4: 1500-2000Hz  (claritate voce)
// Banda 5: 2000-2500Hz  (șuierături, consoane)
// Banda 6: 2500-3000Hz  (claritate, "s", "t")
// Banda 7: 3000-4000Hz  (strălucire, zgomot)
// Banda 8: 4000-8000Hz  (frecvențe înalte, armonici)

// ============================================================================
// PARAMETRI AJUSTABILI (primiți de la Frontend)
// ============================================================================
int AMP_REF = 650;              // Amplitudine de referință (optimizat pentru voce)
int NOISE_GATE_THRESHOLD = 12;  // Threshold noise gate (%) - mai mic pentru voce slabă
float SMOOTHING_ALPHA = 0.5f;   // Alpha pentru smoothing exponențial (mai rapid)
float VOICE_BOOST = 2.0f;       // Boost pentru benzile de voce (500Hz-2500Hz) - mai mare
float BAND_SMOOTH_ALPHA = 0.3f; // Smoothing pentru benzi FFT (mai rapid, mai precis)

// Parametri filtru
String filterType = "lowpass"; // lowpass, highpass, bandpass, bypass
int cutoffFreq = 1200;         // Frecvență cutoff în Hz (low pentru bandpass)
int cutoffFreqHigh = 2500;     // Frecvență cutoff superioară în Hz (pentru bandpass)

// ============================================================================
// BUFFERS ȘI VARIABILE DE STARE
// ============================================================================

// Filtrare zgomot
const int FILTER_SIZE = 3;
float volumeHistory[FILTER_SIZE] = {0};
int filterIndex = 0;
float smoothedVolume = 0;

// Buffer pentru eșantioane FFT
float samples[FFT_SAMPLES];
float bands[NUM_BANDS] = {0};
float bandsFiltered[NUM_BANDS] = {0};

// Smoothing pentru benzi
float bandSmoothing[NUM_BANDS] = {0};

// Calibrare automată - măsoară zgomotul de fond
float noiseFloor[NUM_BANDS] = {0};
bool calibrated = false;
int calibrationSamples = 0;
const int CALIBRATION_COUNT = 30; // 30 samples pentru calibrare mai bună (~4-5 secunde)

// Interval fix de trimitere
const unsigned long SEND_INTERVAL = 350; // 350ms fix - mai lent pentru stabilitate

// WebSocket
WebSocketsClient webSocket;
bool isConnected = false;
unsigned long lastSendTime = 0;

// ============================================================================
// FUNCȚII PARSARE MESAGE
// ============================================================================

void parseFilterSettings(const char *json)
{
    // Parsare simplă JSON pentru setări filtru
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

    // Parse smoothingAlpha (vine ca 0-100, convertește la 0.0-1.0)
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

    // Parse voiceBoost (vine ca 100-300, convertește la 1.0-3.0)
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

    // Parse bandSmooth (vine ca 10-90, convertește la 0.1-0.9)
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

    // Parse cutoffFreqHigh (pentru bandpass)
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
        Serial.println("✅ WebSocket conectat!");
        Serial.printf("   URL: wss://%s:%d%s\n", WS_HOST, WS_PORT, WS_PATH);
        isConnected = true;
        // Trimite mesaj de conectare (non-blocking)
        webSocket.sendTXT("{\"source\":\"esp32\",\"type\":\"connected\"}");
        break;
    }

    case WStype_DISCONNECTED:
    {
        Serial.println("❌ WebSocket DEconectat!");
        Serial.println("   Cauză: Conexiune pierdută sau server indisponibil");
        Serial.println("   Se va încerca reconectarea automată...");
        isConnected = false;
        break;
    }

    case WStype_ERROR:
    {
        Serial.println("❌ WebSocket ERROR!");
        if (payload != NULL && length > 0)
        {
            Serial.printf("   Eroare: %.*s\n", length, payload);
        }
        else
        {
            Serial.println("   Eroare: Necunoscută");
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
// FUNCȚII FILTRARE
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
// FUNCȚII FFT
// ============================================================================

void calculateBands(float *sampleBuffer, int numSamples, float *outputBands)
{
    // Calculează DC offset și elimină-l
    float dcOffset = 0;
    for (int i = 0; i < numSamples; i++)
    {
        dcOffset += sampleBuffer[i];
    }
    dcOffset /= numSamples;

    // Aplică fereastra Hanning și elimină DC
    for (int i = 0; i < numSamples; i++)
    {
        float window = 0.5f * (1.0f - cos(2.0f * PI * i / (numSamples - 1)));
        sampleBuffer[i] = (sampleBuffer[i] - dcOffset) * window;
    }

    // Frecvență per bin
    float freqPerBin = (float)SAMPLE_RATE_HZ / numSamples; // ~125 Hz per bin la 16kHz/128

    // Limite de frecvență pentru fiecare bandă (în Hz)
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
            // DFT pentru bin k
            float real = 0;
            float imag = 0;
            float freq = (2.0f * PI * k) / numSamples;

            for (int n = 0; n < numSamples; n++)
            {
                real += sampleBuffer[n] * cos(freq * n);
                imag -= sampleBuffer[n] * sin(freq * n);
            }

            // Magnitudine
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

    // Scalare logaritmică pentru percepție mai naturală (ca urechea umană)
    float maxEnergy = 0;
    for (int i = 0; i < NUM_BANDS; i++)
    {
        if (outputBands[i] > maxEnergy)
            maxEnergy = outputBands[i];
    }

    // Normalizează și aplică scaling
    float scaleFactor = 100.0f / (AMP_REF * 2.0f);
    for (int i = 0; i < NUM_BANDS; i++)
    {
        // Scade noise floor dacă e calibrat - optimizat pentru voce
        if (calibrated && outputBands[i] > noiseFloor[i])
        {
            // Mai agresiv pentru benzi joase (unde sunt sinusoidalele)
            if (i <= 1)
            {
                outputBands[i] -= noiseFloor[i] * 1.3f; // Foarte agresiv pentru benzi joase
            }
            // Mai conservator pentru benzile vocale (2-5) pentru a păstra vocea
            else if (i >= 2 && i <= 5)
            {
                outputBands[i] -= noiseFloor[i] * 0.7f; // Mai conservator pentru voce
            }
            else
            {
                outputBands[i] -= noiseFloor[i] * 0.9f; // Standard pentru celelalte
            }
        }

        outputBands[i] *= scaleFactor;

        // Boost pentru benzile de voce (500Hz - 2500Hz)
        if (i >= 2 && i <= 5)
        {
            outputBands[i] *= VOICE_BOOST; // Boost ajustabil din frontend
        }

        // Filtrare agresivă pentru benzi joase în liniște (elimină sinusoidalele)
        // Dar păstrează benzile vocale chiar dacă sunt aproape de noise floor
        if (calibrated && i <= 1 && outputBands[i] < noiseFloor[i] * 1.8f)
        {
            outputBands[i] = 0; // Elimină complet benzi joase sub threshold
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
                // Adaugă un buffer de 20% pentru a fi sigur că prindem zgomotul
                noiseFloor[i] *= 1.2f;
            }
            calibrated = true;
            Serial.println("✅ Calibrare completă!");
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

// Aplică filtrul de frecvență pe benzi bazat pe filterType și cutoffFreq
void applyFrequencyFilter(float *inputBands, float *outputBands)
{
    // Limite de frecvență pentru fiecare bandă (în Hz) - trebuie să fie identice cu cele din calculateBands
    int bandLimits[NUM_BANDS + 1] = {0, 250, 500, 1000, 1500, 2000, 2500, 3000, 4000, 8000};

    // Copiază input în output
    for (int i = 0; i < NUM_BANDS; i++)
    {
        outputBands[i] = inputBands[i];
    }

    // Bypass - nu aplică niciun filtru
    if (filterType == "bypass")
    {
        return;
    }

    // Aplică filtrul bazat pe tip
    for (int i = 0; i < NUM_BANDS; i++)
    {
        // Calculează frecvența medie a benzii
        float bandCenterFreq = (bandLimits[i] + bandLimits[i + 1]) / 2.0f;

        if (filterType == "lowpass")
        {
            // Low-pass: elimină toate benzile peste cutoffFreq
            if (bandCenterFreq > cutoffFreq)
            {
                outputBands[i] = 0;
            }
        }
        else if (filterType == "highpass")
        {
            // High-pass: elimină toate benzile sub cutoffFreq
            if (bandCenterFreq < cutoffFreq)
            {
                outputBands[i] = 0;
            }
        }
        else if (filterType == "bandpass")
        {
            // Band-pass: păstrează doar benzile între cutoffFreq și cutoffFreqHigh
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
        // Noise gate mai agresiv pentru benzi joase, mai permisiv pentru benzile vocale
        int threshold;
        if (i <= 1)
        {
            threshold = NOISE_GATE_THRESHOLD + 5; // Mai agresiv pentru benzi joase
        }
        else if (i >= 2 && i <= 5)
        {
            threshold = NOISE_GATE_THRESHOLD - 2; // Mai permisiv pentru benzile vocale
        }
        else
        {
            threshold = NOISE_GATE_THRESHOLD; // Standard pentru celelalte
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

    // Configurare ADC
    analogReadResolution(12);
    analogSetPinAttenuation(MIC_PIN, ADC_11db);

    Serial.printf("Pin ADC: GPIO%d\n", MIC_PIN);
    Serial.printf("Sample Rate: %d Hz\n", SAMPLE_RATE_HZ);
    Serial.printf("FFT Samples: %d\n", FFT_SAMPLES);
    Serial.printf("Frequency Range: 0 - %d Hz\n", SAMPLE_RATE_HZ / 2);
    Serial.printf("Număr benzi: %d\n", NUM_BANDS);
    Serial.printf("Send Interval: %dms (fix)\n", SEND_INTERVAL);
    Serial.println("⏳ Calibrare zgomot de fond...");

    // Conectare WiFi
    Serial.printf("Conectare WiFi: %s\n", ssid);
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
        Serial.print("✅ WiFi conectat! IP: ");
        Serial.println(WiFi.localIP());

        webSocket.beginSSL(WS_HOST, WS_PORT, WS_PATH);
        webSocket.setExtraHeaders("ngrok-skip-browser-warning: true");
        webSocket.onEvent(webSocketEvent);
        webSocket.setReconnectInterval(5000);

        Serial.println("⏳ Conectare WebSocket...");
    }
    else
    {
        Serial.println("❌ WiFi FAILED!");
    }

    Serial.println();
}

// ============================================================================
// LOOP PRINCIPAL
// ============================================================================

void loop()
{
    // Apelăm webSocket.loop() în fiecare iterație pentru a menține conexiunea activă
    webSocket.loop();

    unsigned long now = millis();
    if (now - lastSendTime < SEND_INTERVAL)
        return;
    lastSendTime = now;

    // Verifică dacă conexiunea este încă activă
    if (!isConnected)
    {
        static unsigned long lastCheckTime = 0;
        unsigned long now = millis();
        // Log o dată la 5 secunde când nu e conectat
        if (now - lastCheckTime > 5000)
        {
            Serial.println("⚠️ WebSocket nu este conectat - aștept reconectare...");
            lastCheckTime = now;
        }
        return; // Nu trimite dacă nu e conectat
    }

    // Verifică dacă conexiunea WebSocket este funcțională
    if (!webSocket.isConnected())
    {
        static unsigned long lastErrorTime = 0;
        unsigned long now = millis();
        // Log o dată la 2 secunde când conexiunea e pierdută
        if (now - lastErrorTime > 2000)
        {
            Serial.println("⚠️ WebSocket.isConnected() returnează false!");
            Serial.println("   Actualizare starea conexiunii...");
            isConnected = false;
            lastErrorTime = now;
        }
        return;
    }

    // Colectează eșantioane pentru FFT - sampling rapid
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

        // Așteaptă pentru sample rate corect
        while (micros() - sampleStart < (i + 1) * SAMPLE_DELAY_US)
        {
            // Busy wait pentru timing precis
        }
    }

    float avg = (float)sum / FFT_SAMPLES;
    int amplitude = maxVal - minVal;

    // ========== CALCUL BENZI FFT ==========
    calculateBands(samples, FFT_SAMPLES, bands);

    // Calibrare automată în primele secunde
    if (!calibrated)
    {
        calibrateNoiseFloor(bands);
    }

    applyBandSmoothing(bands, bands);

    // Aplică filtrul de frecvență (low-pass, high-pass, etc.) pe benzi
    applyFrequencyFilter(bands, bandsFiltered);

    // Aplică noise gate la benzi pentru versiunea filtrată
    applyNoiseGateToBands(bandsFiltered, bandsFiltered);

    // ========== CALCUL SNR ==========
    // Calculează SNR doar dacă e calibrat (altfel e 0)
    float snrRaw = 0;
    float snrFiltered = 0;

    if (calibrated)
    {
        // SNR pentru RAW: raportul între energia semnalului și noise floor
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

        // SNR pentru FILTERED: raportul între energia semnalului filtrat și noise floor
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

    // ========== VOLUM RAW ==========
    int volumeRaw = (int)((float)amplitude * 100.0f / AMP_REF);
    if (volumeRaw > 100)
        volumeRaw = 100;
    if (volumeRaw < 0)
        volumeRaw = 0;

    // ========== VOLUM FILTERED ==========
    int volumeGated = applyNoiseGate(volumeRaw);
    float volumeMA = applyMovingAverage((float)volumeGated);
    float volumeSmooth = applyExponentialSmoothing(volumeMA);
    int volumeFiltered = (int)volumeSmooth;
    if (volumeFiltered > 100)
        volumeFiltered = 100;
    if (volumeFiltered < 0)
        volumeFiltered = 0;

    // ========== TRIMITE DATE ==========
    // Verifică dacă WebSocket este conectat și funcțional
    if (isConnected && webSocket.isConnected())
    {
        // Buffer mai mare pentru a evita overflow-ul
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

        // Verifică dacă mesajul s-a formatat corect (nu overflow)
        if (msgLen > 0 && msgLen < (int)sizeof(msg))
        {
            bool sent = webSocket.sendTXT(msg);
            if (!sent)
            {
                Serial.println("❌ EROARE: Nu s-a putut trimite mesajul WebSocket!");
                Serial.println("   Verifică conexiunea și buffer-ul");
                isConnected = false; // Marchează ca deconectat
            }
        }
        else
        {
            // Mesaj prea mare - trimite fără SNR dacă e necesar
            Serial.printf("⚠️ Mesaj prea mare (%d bytes), trimit fără SNR\n", msgLen);
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
