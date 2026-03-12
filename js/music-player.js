/* ============================================
   Global Music Player — Compact Dock with
   Soundwave Visualizer & Web Audio API
   Persistent across page navigation
   ============================================ */

class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioElement');
        if (!this.audio) return;

        this.tracks = [
            { title: 'Jagged Edge',                src: 'assets/audio/Jagged Edge.mp3' },
            { title: 'Push Through Static',        src: 'assets/audio/Push Through Static.mp3' },
            { title: 'Bright Poppy',               src: 'assets/audio/Bright Poppy.mp3' },
            { title: 'Tearing Up the House',       src: 'assets/audio/Tearing Up the House.mp3' },
            { title: 'Midnight Voltage',           src: 'assets/audio/Midnight Voltage.mp3' },
            { title: 'Press Start to Maybe',       src: 'assets/audio/Press Start to Maybe.mp3' },
            { title: 'You Might',                  src: 'assets/audio/You Might.mp3' },
            { title: 'Glow on the Floor',          src: 'assets/audio/Glow on the Floor.mp3' },
            { title: 'Starshine',                  src: 'assets/audio/Starshine.mp3' },
            { title: 'Touch the Button',           src: 'assets/audio/Touch the Button.mp3' },
            { title: 'As I Was Walking',           src: 'assets/audio/As I Was Walking.mp3' },
            { title: 'As I Was Walking 2',         src: 'assets/audio/As I Was Walking 2.mp3' },
            { title: 'Bubbly Electro Breaks',      src: 'assets/audio/BUBBLY ELECTRO BREAKS.mp3' },
            { title: 'Birthday Present',           src: 'assets/audio/Birthday Present.mp3' },
            { title: "Kickin' It",                 src: "assets/audio/Kickin' It.mp3" },
            { title: 'Sweet Dream',                src: 'assets/audio/Sweet Dream.mp3' },
        ];

        this.currentIndex = 0;
        this.isPlaying = false;
        this.isMuted = true;          // starts muted
        this.musicEnabled = false;
        this.isExpanded = false;
        this.isInBackground = false;

        // Native playback: true when captureStream() is used. Audio plays through
        // the <audio> element natively — no backup audio needed, background playback
        // just works. Falls back to createMediaElementSource + backup audio on Safari.
        this.usesNativePlayback = false;

        // User's intended volume (separate from audio.volume which may be 0 when muted
        // in native playback mode)
        this._userVolume = 0.5;

        // Backup audio (only used in fallback mode for iOS Safari)
        this.backupAudio = null;

        // Recovery coordination — prevents visibility + statechange handlers from racing
        this._recoveryTimeout = null;
        // Throttle for MediaSession position state updates
        this._lastPositionUpdate = 0;

        // Web Audio API
        this.audioContext = null;
        this.analyser = null;
        this.sourceNode = null;
        this.gainNode = null;       // only used in fallback mode
        this.frequencyData = null;
        this.audioContextReady = false;

        // Visualizer
        this.vizCanvas = document.getElementById('visualizerCanvas');
        this.vizCtx = this.vizCanvas ? this.vizCanvas.getContext('2d') : null;
        this.vizAnimId = null;

        // Audio levels (exposed for particle reactivity)
        this.bassLevel = 0;
        this.midLevel = 0;
        this.trebleLevel = 0;

        // DOM elements
        this.playerEl = document.getElementById('musicPlayer');
        this.playerBar = document.getElementById('playerBar');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.playIcon = document.getElementById('playIcon');
        this.pauseIcon = document.getElementById('pauseIcon');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.trackNameEl = document.getElementById('trackName');
        this.progressBar = document.getElementById('playerProgress');
        this.progressFill = document.getElementById('progressFill');
        this.expandBtn = document.getElementById('expandBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.expandedPanel = document.getElementById('playerExpanded');
        this.muteBtn = document.getElementById('muteBtn');
        this.volumeOnIcon = document.getElementById('volumeOnIcon');
        this.volumeOffIcon = document.getElementById('volumeOffIcon');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.trackListEl = document.getElementById('trackList');
        this.vizRow = document.getElementById('visualizerRow');

        this.restoreState();
        this.buildTrackList();
        this.trackNameEl.textContent = this.tracks[this.currentIndex].title;
        this.updateTrackListActive();
        this.updateMuteIcon();
        this.bindEvents();

        // Enable background playback via Media Session API
        this.setupMediaSession();

        // Start muted autoplay
        this.startMutedAutoplay();

        // Start visualizer loop (shows idle animation until audio data is ready)
        this.startVisualizer();

        // Handle page visibility changes (resume audio when returning to tab/app)
        this.bindVisibilityHandler();
    }

    // --- State ---

    restoreState() {
        const savedVolume = localStorage.getItem('es_player_volume');
        if (savedVolume !== null) {
            this._userVolume = parseFloat(savedVolume);
            this.audio.volume = this._userVolume;
            this.volumeSlider.value = savedVolume;
        } else {
            this._userVolume = 0.5;
            this.audio.volume = 0.5;
        }
        // Restore saved track, or pick a random one on first visit
        const savedTrack = localStorage.getItem('es_player_track');
        if (savedTrack !== null) {
            const idx = parseInt(savedTrack, 10);
            if (idx >= 0 && idx < this.tracks.length) {
                this.currentIndex = idx;
            } else {
                this.currentIndex = Math.floor(Math.random() * this.tracks.length);
            }
        } else {
            this.currentIndex = Math.floor(Math.random() * this.tracks.length);
        }
    }

    // --- Web Audio API ---

    initAudioContext() {
        if (this.audioContextReady) return;

        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioCtx();

            // Analyser for frequency data (used by visualizer)
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.82;

            // Strategy 1: captureStream() — taps into audio WITHOUT hijacking the
            // output pipeline. The <audio> element plays natively through the browser's
            // audio system, so background playback, lock screen controls, and tab
            // switching all work seamlessly. No backup audio element needed.
            // Supported: Chrome 62+, Firefox 15+, Edge 79+. NOT Safari/iOS.
            const captureMethod = this.audio.captureStream || this.audio.mozCaptureStream;
            if (captureMethod) {
                try {
                    const stream = captureMethod.call(this.audio);
                    this.sourceNode = this.audioContext.createMediaStreamSource(stream);
                    this.sourceNode.connect(this.analyser);
                    // Do NOT connect analyser to destination — audio plays natively
                    // via the <audio> element. Connecting would cause double output.
                    this.usesNativePlayback = true;
                } catch (e) {
                    // captureStream failed — fall through to fallback
                }
            }

            // Strategy 2 (fallback): createMediaElementSource — routes ALL audio
            // through AudioContext. Required for Safari/iOS which lacks captureStream.
            // Downside: iOS suspends AudioContext in background, killing the audio
            // pipeline. Requires backup Audio element to maintain background playback.
            if (!this.usesNativePlayback) {
                this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
                this.gainNode = this.audioContext.createGain();
                this.gainNode.gain.value = this.isMuted ? 0 : this._userVolume;
                this.sourceNode.connect(this.analyser);
                this.analyser.connect(this.gainNode);
                this.gainNode.connect(this.audioContext.destination);
            }

            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.audioContextReady = true;

            // Switch from element-mute to controlled output
            this.audio.muted = false;
            if (this.usesNativePlayback) {
                // Native: control volume directly on the element
                this.audio.volume = this.isMuted ? 0 : this._userVolume;
            }

            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            // Listen for AudioContext suspension/interruption
            this.bindAudioContextRecovery();
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    // --- Smooth gain transitions (fallback mode only, prevents clicks/pops) ---

    setGainSmooth(value, duration) {
        if (!this.gainNode || !this.audioContext) return;
        if (duration === undefined) duration = 0.05;
        try {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(value, now + duration);
        } catch (e) {
            this.gainNode.gain.value = value;
        }
    }

    startMutedAutoplay() {
        // Start with element muted (browsers allow this for autoplay)
        this.audio.muted = true;
        this.audio.src = this.tracks[this.currentIndex].src;
        this.audio.load();

        const attemptPlay = (retries) => {
            this.audio.play().then(() => {
                this.isPlaying = true;
                this.musicEnabled = true;
                this.updatePlayPauseIcon();
                this.initAudioContext();
            }).catch(() => {
                if (retries > 0) {
                    setTimeout(() => attemptPlay(retries - 1), 500);
                } else {
                    this.isPlaying = false;
                    this.updatePlayPauseIcon();
                }
            });
        };
        attemptPlay(3);
    }

    // Ensure music starts playing (called from gesture handler or player bar click)
    ensurePlaying() {
        this.initAudioContext();
        if (!this.usesNativePlayback) {
            this.initBackupAudio();
        }
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        // CRITICAL: switch from element-mute to controlled output.
        // Element-muted audio won't play in background or show lock-screen controls.
        if (this.audio.muted) {
            this.audio.muted = false;
            if (this.usesNativePlayback) {
                this.audio.volume = this.isMuted ? 0 : this._userVolume;
            } else if (this.gainNode) {
                this.setGainSmooth(this.isMuted ? 0 : this._userVolume);
            }
        }
        if (!this.isPlaying) {
            if (!this.audio.src || this.audio.src === window.location.href) {
                this.audio.src = this.tracks[this.currentIndex].src;
            }
            this.musicEnabled = true;
            this.isPlaying = true;
            this.updatePlayPauseIcon();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';

            // Fallback: background-aware play with backup audio
            if (!this.usesNativePlayback && this.isInBackground && this.backupAudio) {
                if (this.gainNode) this.setGainSmooth(0);
                this.backupAudio.src = this.audio.src;
                try { this.backupAudio.currentTime = this.audio.currentTime; } catch (e) {}
                this.backupAudio.volume = this._userVolume;
                this.backupAudio.play().catch(() => {});
                this.audio.play().catch(() => {});
            } else {
                this.audio.play().catch(() => {
                    this.isPlaying = false;
                    this.updatePlayPauseIcon();
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
                });
            }
        }
    }

    // --- Media Session API (lock screen controls + background playback) ---

    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;

        navigator.mediaSession.setActionHandler('play', () => { this.play(); this.unmute(); });
        navigator.mediaSession.setActionHandler('pause', () => { this.pause(); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { this.next(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { this.prev(); });

        // Override seek buttons with track skip. On Android, the lock screen may
        // show ±10s seek buttons by default (setting to null doesn't remove them,
        // it just falls back to the default). By mapping them to track skip,
        // they always do something useful regardless of what the OS displays.
        try { navigator.mediaSession.setActionHandler('seekforward', () => { this.next(); }); } catch (e) {}
        try { navigator.mediaSession.setActionHandler('seekbackward', () => { this.prev(); }); } catch (e) {}

        this.updateMediaSessionMetadata();
    }

    updateMediaSessionMetadata() {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.tracks[this.currentIndex].title,
                artist: 'ES Designs',
                album: 'Elliptical Explorer Soundtrack',
                artwork: [
                    { src: 'assets/images/brand/favicon.svg', sizes: '512x512', type: 'image/svg+xml' },
                    { src: 'assets/images/brand/esd-logo.png', sizes: '192x192', type: 'image/png' }
                ]
            });
        } catch (e) { /* ignore if MediaMetadata not supported */ }
    }

    updatePositionState() {
        if (!('mediaSession' in navigator)) return;
        if (!this.audio.duration || isNaN(this.audio.duration)) return;
        try {
            navigator.mediaSession.setPositionState({
                duration: this.audio.duration,
                playbackRate: this.audio.playbackRate,
                position: Math.min(this.audio.currentTime, this.audio.duration)
            });
        } catch (e) { /* ignore if not supported */ }
    }

    // --- Background playback (fallback mode only) ---
    // On iOS, AudioContext is suspended when the page goes to background/lock screen.
    // Since createMediaElementSource() routes all audio through AudioContext, the audio
    // pipeline dies. We use a BACKUP Audio element (not connected to AudioContext) that
    // takes over during background playback, then syncs back when returning.
    // This is NOT needed for native playback (captureStream) since the <audio> element
    // plays independently of AudioContext.

    initBackupAudio() {
        if (this.backupAudio) return;

        this.backupAudio = new Audio();
        this.backupAudio.preload = 'none';

        // When backup audio finishes a track in background, advance to next
        this.backupAudio.addEventListener('ended', () => {
            if (document.visibilityState === 'hidden' && this.isPlaying) {
                const nextIdx = (this.currentIndex + 1) % this.tracks.length;
                this.currentIndex = nextIdx;
                this.trackNameEl.textContent = this.tracks[nextIdx].title;
                this.updateTrackListActive();
                this.updateMediaSessionMetadata();
                this.backupAudio.src = this.tracks[nextIdx].src;
                this.backupAudio.play().catch(() => {});
            }
        });

        // "Unlock" for iOS: play briefly during user gesture so future play() calls work
        this.backupAudio.src = this.tracks[this.currentIndex].src;
        this.backupAudio.volume = 0.001;
        this.backupAudio.play().then(() => {
            this.backupAudio.pause();
            this.backupAudio.volume = 0;
        }).catch(() => {});
    }

    bindVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.isInBackground = true;

                if (this.usesNativePlayback) {
                    // Native playback — audio continues via <audio> element natively.
                    // Do NOT touch audio state here. Let the browser and Media Session
                    // handle background playback entirely.
                    // Disconnect the analyser pipeline so AudioContext suspension
                    // (which Chrome may do for power saving) can't interfere with
                    // the native audio output in any way.
                    if (this.sourceNode) {
                        try { this.sourceNode.disconnect(); } catch (e) {}
                    }
                } else if (this.isPlaying && this.backupAudio) {
                    // Fallback: swap to backup audio for iOS lock screen
                    try {
                        this.backupAudio.src = this.audio.src;
                        this.backupAudio.currentTime = this.audio.currentTime;
                        this.backupAudio.volume = this.isMuted ? 0 : this._userVolume;
                        this.backupAudio.play().catch(() => {});
                    } catch (e) {}
                    // Silence primary via gain (don't pause — iOS needs it "playing"
                    // to show correct lock screen controls)
                    this.setGainSmooth(0, 0.02);
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                }
            } else if (document.visibilityState === 'visible') {
                this.isInBackground = false;

                // Cancel any pending recovery timeout to prevent races
                if (this._recoveryTimeout) {
                    clearTimeout(this._recoveryTimeout);
                    this._recoveryTimeout = null;
                }

                if (this.usesNativePlayback) {
                    // Native playback — reconnect analyser for visualizer
                    if (this.sourceNode && this.analyser) {
                        try { this.sourceNode.connect(this.analyser); } catch (e) {}
                    }
                    // Resume AudioContext for visualizer only
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }
                    // CRITICAL: Do NOT call audio.play() here. Instead, sync our
                    // state with reality. The browser/Media Session may have paused
                    // or resumed audio while in background — trust its state.
                    // Calling play() here caused the "pause doesn't work" bug because
                    // it raced with user input after returning from background.
                    this.isPlaying = !this.audio.paused;
                    this.updatePlayPauseIcon();
                    if ('mediaSession' in navigator) {
                        navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
                    }
                } else {
                    // Fallback: resume AudioContext + sync from backup audio
                    if (this.audioContext && this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }

                    let backupTime = 0;
                    let trackChanged = false;

                    if (this.backupAudio && !this.backupAudio.paused) {
                        backupTime = this.backupAudio.currentTime;
                        if (this.backupAudio.src !== this.audio.src) {
                            trackChanged = true;
                        }
                    }

                    // Stop backup first to prevent overlap
                    if (this.backupAudio) {
                        this.backupAudio.pause();
                        this.backupAudio.volume = 0;
                    }

                    // Restore gain
                    if (this.gainNode) {
                        this.setGainSmooth(this.isMuted ? 0 : this._userVolume);
                    }

                    // Sync primary audio
                    if (this.isPlaying) {
                        if (trackChanged) {
                            this.audio.src = this.tracks[this.currentIndex].src;
                            const capturedTime = backupTime;
                            this.audio.addEventListener('loadedmetadata', () => {
                                try { this.audio.currentTime = capturedTime; } catch (e) {}
                                this.audio.play().catch(() => {});
                            }, { once: true });
                            this.audio.load();
                        } else {
                            if (backupTime > 0) {
                                try { this.audio.currentTime = backupTime; } catch (e) {}
                            }
                            if (this.audio.paused) {
                                this.audio.play().catch(() => {});
                            }
                        }
                    }
                }
            }
        });
    }

    bindAudioContextRecovery() {
        if (!this.audioContext) return;

        this.audioContext.addEventListener('statechange', () => {
            // Skip when in background — let visibilitychange handle it
            if (this.isInBackground) return;

            // For native playback, AudioContext is only used for the visualizer.
            // Never touch audio playback from here — it plays independently.
            if (this.usesNativePlayback) {
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume().catch(() => {});
                }
                return;
            }

            // Fallback mode: manage both AudioContext and audio playback
            if (this.isPlaying && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => {});
            }

            if (this.audioContext.state === 'running' && this.isPlaying && this.audio.paused) {
                if (this._recoveryTimeout) {
                    clearTimeout(this._recoveryTimeout);
                }
                this._recoveryTimeout = setTimeout(() => {
                    this._recoveryTimeout = null;
                    if (!this.isInBackground && this.isPlaying && this.audio.paused) {
                        this.audio.play().catch(() => {});
                    }
                }, 300);
            }
        });
    }

    // --- Visualizer ---

    startVisualizer() {
        if (!this.vizCanvas || !this.vizCtx) return;

        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        const draw = () => {
            this.vizAnimId = requestAnimationFrame(draw);

            const rect = this.vizCanvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            const canvasW = Math.round(rect.width * dpr);
            const canvasH = Math.round(rect.height * dpr);
            if (this.vizCanvas.width !== canvasW || this.vizCanvas.height !== canvasH) {
                this.vizCanvas.width = canvasW;
                this.vizCanvas.height = canvasH;
            }

            const W = rect.width;
            const H = rect.height;
            const ctx = this.vizCtx;

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, W, H);

            if (this.analyser && this.frequencyData && this.isPlaying) {
                this.analyser.getByteFrequencyData(this.frequencyData);
                this.updateAudioLevels();
                this.drawFrequencyBars(ctx, W, H);
            } else {
                this.drawIdleVisualizer(ctx, W, H);
            }

            ctx.restore();
        };

        draw();
    }

    drawFrequencyBars(ctx, W, H) {
        var barCount = W < 480 ? 32 : W < 768 ? 48 : 64;
        var usableBins = Math.floor(this.frequencyData.length * 0.65);
        var binStep = Math.max(1, Math.floor(usableBins / barCount));
        var barWidth = W / barCount;
        var barGap = 2;
        var minBarH = 2;

        for (var i = 0; i < barCount; i++) {
            var sum = 0;
            for (var j = 0; j < binStep; j++) {
                var idx = i * binStep + j;
                if (idx < usableBins) sum += this.frequencyData[idx];
            }
            var avg = sum / binStep;
            var normalizedH = Math.max(minBarH, (avg / 255) * H * 0.95);

            var grad = ctx.createLinearGradient(0, H, 0, H - normalizedH);
            grad.addColorStop(0, 'rgba(0, 255, 255, 0.85)');
            grad.addColorStop(0.6, 'rgba(0, 200, 255, 0.7)');
            grad.addColorStop(1, 'rgba(255, 0, 255, 0.8)');

            ctx.fillStyle = grad;
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(0, 255, 255, 0.4)';

            var x = i * barWidth + barGap / 2;
            var w = barWidth - barGap;
            if (w < 1) w = 1;

            var r = Math.min(1.5, w / 2);
            ctx.beginPath();
            ctx.moveTo(x + r, H - normalizedH);
            ctx.lineTo(x + w - r, H - normalizedH);
            ctx.quadraticCurveTo(x + w, H - normalizedH, x + w, H - normalizedH + r);
            ctx.lineTo(x + w, H);
            ctx.lineTo(x, H);
            ctx.lineTo(x, H - normalizedH + r);
            ctx.quadraticCurveTo(x, H - normalizedH, x + r, H - normalizedH);
            ctx.fill();
        }

        ctx.shadowBlur = 0;
    }

    drawIdleVisualizer(ctx, W, H) {
        var barCount = W < 480 ? 32 : W < 768 ? 48 : 64;
        var barWidth = W / barCount;
        var barGap = 2;
        var time = performance.now() / 1000;

        for (var i = 0; i < barCount; i++) {
            var wave1 = Math.sin(time * 2.8 + i * 0.35) * 0.38;
            var wave2 = Math.sin(time * 1.8 + i * 0.18 + 1.5) * 0.25;
            var wave3 = Math.sin(time * 4.5 + i * 0.7) * 0.15;
            var h = (wave1 + wave2 + wave3 + 0.6) * H * 0.7 + 3;

            var colorShift = (Math.sin(time * 1.0 + i * 0.12) + 1) * 0.5;
            var r = Math.round(colorShift * 255);
            var g = Math.round((1 - colorShift) * 255);
            var b = 255;
            ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ', 0.65)';
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(' + r + ',' + g + ',' + b + ', 0.4)';

            var x = i * barWidth + barGap / 2;
            var w = barWidth - barGap;
            if (w < 1) w = 1;
            ctx.fillRect(x, H - h, w, h);
        }

        ctx.shadowBlur = 0;
    }

    updateAudioLevels() {
        if (!this.frequencyData) return;

        var bins = this.frequencyData.length;

        var bassSum = 0;
        for (var i = 0; i < 10 && i < bins; i++) bassSum += this.frequencyData[i];
        this.bassLevel = bassSum / (10 * 255);

        var midSum = 0;
        for (var i = 10; i < 60 && i < bins; i++) midSum += this.frequencyData[i];
        this.midLevel = midSum / (50 * 255);

        var trebleSum = 0;
        for (var i = 60; i < bins; i++) trebleSum += this.frequencyData[i];
        this.trebleLevel = trebleSum / (Math.max(1, bins - 60) * 255);
    }

    // --- Unmute / Mute ---

    unmute() {
        this.isMuted = false;
        if (this.usesNativePlayback) {
            this.audio.volume = this._userVolume;
        } else if (this.gainNode) {
            this.setGainSmooth(this._userVolume);
        } else {
            this.audio.muted = false;
        }
        this.updateMuteIcon();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    mute() {
        this.isMuted = true;
        if (this.usesNativePlayback) {
            this.audio.volume = 0;
        } else if (this.gainNode) {
            this.setGainSmooth(0);
        } else {
            this.audio.muted = true;
        }
        this.updateMuteIcon();
    }

    updateMuteIcon() {
        this.volumeOnIcon.style.display = this.isMuted ? 'none' : 'block';
        this.volumeOffIcon.style.display = this.isMuted ? 'block' : 'none';
    }

    // --- Track List ---

    buildTrackList() {
        this.trackListEl.innerHTML = '';
        this.tracks.forEach((track, index) => {
            var item = document.createElement('div');
            item.className = 'tracklist-item' + (index === this.currentIndex ? ' active' : '');
            item.innerHTML = `
                <span class="track-number">${String(index + 1).padStart(2, '0')}</span>
                <span class="track-title">${track.title}</span>
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadTrack(index, true);
                this.play();
                this.collapse();
            });
            this.trackListEl.appendChild(item);
        });
    }

    updateTrackListActive() {
        var items = this.trackListEl.querySelectorAll('.tracklist-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.currentIndex);
        });
    }

    // --- Playback ---

    loadTrack(index, autoplay) {
        this.currentIndex = index;
        this.audio.src = this.tracks[index].src;
        this.trackNameEl.textContent = this.tracks[index].title;
        this.progressFill.style.width = '0%';
        this.updateTrackListActive();
        localStorage.setItem('es_player_track', index);
        this.updateMediaSessionMetadata();

        if (autoplay) {
            if (!this.usesNativePlayback && this.isInBackground && this.backupAudio) {
                // Fallback: background play via backup audio
                if (this.gainNode) this.setGainSmooth(0, 0.02);
                this.backupAudio.src = this.tracks[index].src;
                this.backupAudio.currentTime = 0;
                this.backupAudio.volume = this.isMuted ? 0 : this._userVolume;
                this.backupAudio.play().catch(() => {});
                this.audio.play().catch(() => {});
            } else {
                // Native or foreground: just play primary
                if (!this.usesNativePlayback && this.backupAudio && !this.backupAudio.paused) {
                    this.backupAudio.pause();
                    this.backupAudio.volume = 0;
                }
                this.audio.play().catch(() => {});
            }
            this.isPlaying = true;
            this.updatePlayPauseIcon();
        }
    }

    play() {
        if (!this.musicEnabled) {
            this.musicEnabled = true;
        }
        if (!this.audio.src || this.audio.src === window.location.href) {
            this.audio.src = this.tracks[this.currentIndex].src;
        }
        this.initAudioContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        // Ensure element-mute is off
        if (this.audio.muted) {
            this.audio.muted = false;
            if (this.usesNativePlayback) {
                this.audio.volume = this.isMuted ? 0 : this._userVolume;
            }
        }

        if (!this.usesNativePlayback && this.isInBackground && this.backupAudio) {
            // Fallback: background play via backup audio
            if (this.gainNode) this.setGainSmooth(0, 0.02);
            this.backupAudio.src = this.audio.src;
            try { this.backupAudio.currentTime = this.audio.currentTime; } catch (e) {}
            this.backupAudio.volume = this._userVolume;
            this.backupAudio.play().catch(() => {});
            this.audio.play().catch(() => {});
        } else {
            // Native or foreground
            if (!this.usesNativePlayback && this.backupAudio && !this.backupAudio.paused) {
                this.backupAudio.pause();
                this.backupAudio.volume = 0;
            }
            this.audio.play().catch(() => {});
        }
        this.isPlaying = true;
        this.updatePlayPauseIcon();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    }

    pause() {
        // Cancel any pending recovery timeout — prevents statechange handler
        // from re-starting playback after user explicitly pauses
        if (this._recoveryTimeout) {
            clearTimeout(this._recoveryTimeout);
            this._recoveryTimeout = null;
        }
        this.isPlaying = false;
        this.audio.pause();
        // Also stop backup audio (fallback mode)
        if (this.backupAudio && !this.backupAudio.paused) {
            this.backupAudio.pause();
            this.backupAudio.volume = 0;
        }
        this.updatePlayPauseIcon();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    next() {
        var nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.tracks.length) nextIndex = 0;
        this.loadTrack(nextIndex, true);
    }

    prev() {
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        var prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) prevIndex = this.tracks.length - 1;
        this.loadTrack(prevIndex, true);
    }

    shuffle() {
        var newIndex;
        if (this.tracks.length <= 1) {
            newIndex = 0;
        } else {
            do {
                newIndex = Math.floor(Math.random() * this.tracks.length);
            } while (newIndex === this.currentIndex);
        }
        this.loadTrack(newIndex, true);
        this.ensurePlaying();
        if (this.isMuted) this.unmute();
    }

    updatePlayPauseIcon() {
        if (this.isPlaying) {
            this.playIcon.style.display = 'none';
            this.pauseIcon.style.display = 'block';
        } else {
            this.playIcon.style.display = 'block';
            this.pauseIcon.style.display = 'none';
        }
    }

    // --- Volume ---

    toggleMute() {
        if (this.isMuted) {
            this.unmute();
        } else {
            this.mute();
        }
    }

    setVolume(value) {
        this._userVolume = value;
        localStorage.setItem('es_player_volume', value);

        if (this.usesNativePlayback) {
            if (!this.isMuted) {
                this.audio.volume = value;
            }
        } else {
            this.audio.volume = value;
            if (this.gainNode && !this.isMuted) {
                this.setGainSmooth(value);
            }
        }

        if (value == 0) {
            this.isMuted = true;
            if (this.usesNativePlayback) {
                this.audio.volume = 0;
            } else if (this.gainNode) {
                this.setGainSmooth(0);
            }
            this.updateMuteIcon();
        } else if (this.isMuted) {
            this.isMuted = false;
            if (this.usesNativePlayback) {
                this.audio.volume = value;
            } else {
                if (this.gainNode) this.setGainSmooth(value);
                this.audio.muted = false;
            }
            this.updateMuteIcon();
        }
    }

    // --- Seeking & Progress ---

    seekTo(e) {
        var rect = this.progressBar.getBoundingClientRect();
        var percent = (e.clientX - rect.left) / rect.width;
        if (this.audio.duration) {
            this.audio.currentTime = percent * this.audio.duration;
            this.updatePositionState();
        }
    }

    updateProgress() {
        if (this.audio.duration) {
            var percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressFill.style.width = percent + '%';

            const now = performance.now();
            if (now - this._lastPositionUpdate > 1000) {
                this._lastPositionUpdate = now;
                this.updatePositionState();
            }
        }
    }

    // --- Expand / Collapse ---

    expand() {
        this.isExpanded = true;
        this.playerEl.classList.add('expanded');
    }

    collapse() {
        this.isExpanded = false;
        this.playerEl.classList.remove('expanded');
    }

    toggleExpand() {
        if (this.isExpanded) {
            this.collapse();
        } else {
            this.expand();
        }
    }

    // Play a specific track by title (used by VR page soundtrack list)
    playTrackByTitle(title) {
        var index = this.tracks.findIndex((t) => t.title === title);
        if (index !== -1) {
            this.loadTrack(index, true);
            this.play();
        }
    }

    // --- Events ---

    bindEvents() {
        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
            if (this.isPlaying && this.isMuted) {
                this.unmute();
            }
        });
        this.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });
        this.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.prev();
        });
        this.shuffleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.shuffle();
        });

        this.expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isExpanded) {
                this.ensurePlaying();
                if (this.isMuted) this.unmute();
            }
            this.toggleExpand();
        });

        this.trackNameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isExpanded) {
                this.ensurePlaying();
                if (this.isMuted) this.unmute();
            }
            this.toggleExpand();
        });

        this.playerBar.addEventListener('click', () => {
            this.ensurePlaying();
            if (this.isMuted) this.unmute();
            this.toggleExpand();
        });

        if (this.vizRow) {
            this.vizRow.addEventListener('click', (e) => {
                e.stopPropagation();
                this.ensurePlaying();
                if (this.isMuted) this.unmute();
                this.toggleExpand();
            });
        }

        this.muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMute();
        });
        this.volumeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.setVolume(parseFloat(e.target.value));
        });
        this.volumeSlider.addEventListener('click', (e) => { e.stopPropagation(); });

        this.progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.seekTo(e);
        });

        this.audio.addEventListener('timeupdate', () => { this.updateProgress(); });
        this.audio.addEventListener('ended', () => { this.next(); });
        this.audio.addEventListener('loadedmetadata', () => { this.updatePositionState(); });

        // Auto-skip on load error (404, network failure, decode error)
        this.audio.addEventListener('error', () => {
            console.warn('Audio load error for:', this.tracks[this.currentIndex]?.title);
            if (this.isPlaying) {
                setTimeout(() => this.next(), 500);
            }
        });

        // Ensure AudioContext + playback on first user gesture.
        // IMPORTANT: Only use 'click', not 'touchstart'. iOS Safari does NOT
        // treat touchstart as a user gesture for audio playback.
        let gestureHandled = false;
        const gestureHandler = () => {
            if (gestureHandled) return;
            gestureHandled = true;
            this.ensurePlaying();
            document.removeEventListener('click', gestureHandler);
        };
        document.addEventListener('click', gestureHandler);
    }
}
