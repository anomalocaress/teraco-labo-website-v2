const { ipcRenderer } = require('electron');

const statusContainer = document.getElementById('status-container');
const waveformContainer = document.getElementById('waveform');
const debugLog = document.getElementById('debug-log');

// Initialize Waveform Bars
const BAR_COUNT = 30; // Increased for full width
const bars = [];

for (let i = 0; i < BAR_COUNT; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    waveformContainer.appendChild(bar);
    bars.push(bar);
}

// MediaRecorder & Audio Context Setup
let mediaRecorder;
let audioChunks = [];
let audioContext;
let analyser;
let dataArray;
let source;
let animationId;

let isListening = false;

function log(message) {
    console.log(message);
    const line = document.createElement('div');
    line.innerText = new Date().toLocaleTimeString() + ' ' + message;
    if (debugLog) {
        debugLog.prepend(line);
    }
}

ipcRenderer.on('start-recording', async () => {
    log('Starting recording...');
    audioChunks = [];
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

        // Setup Audio Context for Waveform
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Small size for fewer bars
        analyser.smoothingTimeConstant = 0.2; // Make it very responsive
        source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);

        // Setup MediaRecorder
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            log('Recording stopped. Processing...');
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const arrayBuffer = await audioBlob.arrayBuffer();
            ipcRenderer.send('audio-data', Buffer.from(arrayBuffer));

            // Stop tracks and close context
            stream.getTracks().forEach(track => track.stop());
            if (audioContext) {
                audioContext.close();
            }
            cancelAnimationFrame(animationId);
            resetWaveform();
        };

        mediaRecorder.start();
        updateStatus('listening');
        visualize();

    } catch (err) {
        log('Microphone error: ' + err.message);
        updateStatus('error');
    }
});

ipcRenderer.on('cancel-recording', () => {
    log('Recording cancelled (too short).');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        // Stop but don't process
        mediaRecorder.onstop = null; // Remove handler
        mediaRecorder.stop();

        // Cleanup
        if (mediaRecorder.stream) {
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
        if (audioContext) {
            audioContext.close();
        }
        cancelAnimationFrame(animationId);
        resetWaveform();
    }
});

function visualize() {
    if (!analyser || !isListening) return;

    analyser.getByteFrequencyData(dataArray);

    // Symmetrical visualization (Center Out)
    const center = BAR_COUNT / 2; // 15

    for (let i = 0; i < center; i++) {
        const value = dataArray[i];
        // Scale value (0-255) to height (3px - 20px) for smaller design
        // Boost the signal a bit for visual impact
        const height = Math.max(3, (value / 200) * 20);

        // Apply to left and right from center
        if (bars[center - 1 - i]) bars[center - 1 - i].style.height = `${height}px`;
        if (bars[center + i]) bars[center + i].style.height = `${height}px`;
    }

    animationId = requestAnimationFrame(visualize);
}

function resetWaveform() {
    bars.forEach(bar => {
        bar.style.height = '2px'; // Flat line
    });
}

// IPC Events
ipcRenderer.on('log-message', (event, message) => {
    log(message);
});

ipcRenderer.on('stop-recording', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        updateStatus('processing');
    }
});

ipcRenderer.on('status-update', (event, status) => {
    updateStatus(status);
});

function updateStatus(status) {
    // Reset classes
    statusContainer.className = 'capsule';

    if (status === 'listening') {
        statusContainer.classList.add('listening');
        isListening = true;
    } else if (status === 'processing') {
        statusContainer.classList.add('processing');
        isListening = false;
    } else if (status === 'error') {
        // Keep default appearance for error
        isListening = false;
    } else {
        // Idle - default appearance
        isListening = false;
        resetWaveform();
    }
}
