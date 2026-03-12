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
        this.isMuted = true;          // starts muted (gain = 0)
        this.musicEnabled = false;
        this.isExpanded = false;
        this.backupAudio = null;
        this.isInBackground = false;

        // Recovery coordination — prevents visibility + statechange handlers from racing
        this._recoveryTimeout = null;
        // Throttle for MediaSession position state updates
        this._lastPositionUpdate = 0;

        // Web Audio API
        this.audioContext = null;
        this.analyser = null;
        this.sourceNode = null;
        this.gainNode = null;
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
            this.audio.volume = parseFloat(savedVolume);
            this.volumeSlider.value = savedVolume;
        } else {
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

            // MediaElementSourceNode — can only be created ONCE per element
            this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

            // Analyser for frequency data
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 256;
            this.analyser.smoothingTimeConstant = 0.82;

            // GainNode controls audible volume (instead of audio.muted)
            this.gainNode = this.audioContext.createGain();
            this.gainNode.gain.value = this.isMuted ? 0 : this.audio.volume;

            // Chain: source -> analyser -> gain -> speakers
            this.sourceNode.connect(this.analyser);
            this.analyser.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
            this.audioContextReady = true;

            // Switch from element-mute to gain-mute so analyser gets data
            this.audio.muted = false;

            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }

            // Listen for AudioContext suspension/interruption (iOS background)
            // NOTE: Only called here — NOT in bindVisibilityHandler (prevents duplicate listeners)
            this.bindAudioContextRecovery();
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    // --- Smooth gain transitions (prevents clicks/pops) ---

    setGainSmooth(value, duration) {
        if (!this.gainNode || !this.audioContext) return;
        if (duration === undefined) duration = 0.05;
        try {
            const now = this.audioContext.currentTime;
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
            this.gainNode.gain.linearRampToValueAtTime(value, now + duration);
        } catch (e) {
            // Fallback to direct assignment if scheduling fails
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
                // Try to init AudioContext (may fail without user gesture on some browsers)
                this.initAudioContext();
            }).catch(() => {
                // Retry after a short delay (browser may allow after DOM settles)
                if (retries > 0) {
                    setTimeout(() => attemptPlay(retries - 1), 500);
                } else {
                    // Autoplay completely blocked (common on mobile).
                    // Keep isPlaying false — visualizer will show idle wave.
                    // Music will start on first user interaction via gestureHandler.
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
        this.initBackupAudio();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        // CRITICAL for mobile: switch from element-mute to gain-mute.
        // Element-muted audio won't play in background or show lock-screen controls.
        if (this.audioContextReady && this.audio.muted) {
            this.audio.muted = false;
            if (this.gainNode) {
                this.setGainSmooth(this.isMuted ? 0 : this.audio.volume);
            }
        }
        if (!this.isPlaying) {
            // Ensure src is set
            if (!this.audio.src || this.audio.src === window.location.href) {
                this.audio.src = this.tracks[this.currentIndex].src;
            }
            this.musicEnabled = true;
            // Use background-aware play() — handles backup audio when in background
            this.isPlaying = true;
            this.updatePlayPauseIcon();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            if (this.isInBackground && this.backupAudio) {
                if (this.gainNode) this.setGainSmooth(0);
                this.backupAudio.src = this.audio.src;
                try { this.backupAudio.currentTime = this.audio.currentTime; } catch (e) {}
                this.backupAudio.volume = this.audio.volume;
                this.backupAudio.play().catch(() => {});
                // Also play primary silenced so lock screen shows pause button
                this.audio.play().catch(() => {});
            } else {
                this.audio.play().catch(() => {
                    // Play failed — reset state so the next click can try again.
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

        // Explicitly REMOVE seek handlers so iOS shows skip track buttons (|◂ ▸|)
        // instead of seek buttons (⟲10 / 10⟳). Setting custom seek handlers causes
        // iOS to render the seek UI; setting to null removes them.
        try { navigator.mediaSession.setActionHandler('seekforward', null); } catch (e) {}
        try { navigator.mediaSession.setActionHandler('seekbackward', null); } catch (e) {}

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

    // --- Background playback ---
    // On iOS, AudioContext is suspended when the page goes to background/lock screen.
    // Since createMediaElementSource() routes all audio through AudioContext, the audio
    // pipeline dies. We use a BACKUP Audio element (not connected to AudioContext) that
    // takes over during background playback, then syncs back when returning.

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
                // Only update backup — leave primary untouched to avoid unnecessary
                // network loads while in background. Primary syncs on return to foreground.
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
                // Page going to background — start backup audio for iOS lock screen
                if (this.isPlaying && this.backupAudio) {
                    try {
                        this.backupAudio.src = this.audio.src;
                        this.backupAudio.currentTime = this.audio.currentTime;
                        this.backupAudio.volume = this.isMuted ? 0 : this.audio.volume;
                        this.backupAudio.play().catch(() => {});
                    } catch (e) {}
                    // Silence primary via gain instead of pausing it.
                    // IMPORTANT: Do NOT pause primary — iOS uses the <audio> element's
                    // play state to render lock screen controls. If we pause it, iOS
                    // shows a play button (wrong) and forward/back require two taps.
                    // Keeping primary "playing" but silent ensures correct lock screen UI.
                    this.setGainSmooth(0, 0.02);
                    // Reinforce that we're playing for Media Session
                    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
                }
            } else if (document.visibilityState === 'visible') {
                this.isInBackground = false;

                // Cancel any pending recovery timeout to prevent races
                if (this._recoveryTimeout) {
                    clearTimeout(this._recoveryTimeout);
                    this._recoveryTimeout = null;
                }

                // Capture backup state before stopping it
                let backupTime = 0;
                let trackChanged = false;

                if (this.backupAudio && !this.backupAudio.paused) {
                    backupTime = this.backupAudio.currentTime;
                    // Check if backup advanced to a different track while in background
                    if (this.backupAudio.src !== this.audio.src) {
                        trackChanged = true;
                    }
                }

                // Step 1: Stop backup audio FIRST to prevent overlap
                if (this.backupAudio) {
                    this.backupAudio.pause();
                    this.backupAudio.volume = 0;
                }

                // Step 2: Resume AudioContext
                if (this.audioContext && this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }

                // Step 3: Restore gain (smoothly to prevent pops)
                if (this.gainNode) {
                    this.setGainSmooth(this.isMuted ? 0 : this.audio.volume);
                }

                // Step 4: Sync primary audio
                if (this.isPlaying) {
                    if (trackChanged) {
                        // Backup advanced to a different track — reload primary.
                        // Must wait for loadedmetadata before seeking, otherwise
                        // currentTime assignment fails on an unloaded source.
                        this.audio.src = this.tracks[this.currentIndex].src;
                        const capturedTime = backupTime;
                        this.audio.addEventListener('loadedmetadata', () => {
                            try { this.audio.currentTime = capturedTime; } catch (e) {}
                            this.audio.play().catch(() => {});
                        }, { once: true });
                        this.audio.load();
                    } else {
                        // Same track — sync position and play
                        if (backupTime > 0) {
                            try { this.audio.currentTime = backupTime; } catch (e) {}
                        }
                        if (this.audio.paused) {
                            this.audio.play().catch(() => {});
                        }
                    }
                }
            }
        });

        // NOTE: bindAudioContextRecovery is NOT called here.
        // It is called once in initAudioContext() to avoid duplicate listeners.
    }

    bindAudioContextRecovery() {
        if (!this.audioContext) return;

        this.audioContext.addEventListener('statechange', () => {
            // Skip when in background — let visibilitychange handle the transition
            if (this.isInBackground) return;

            if (this.isPlaying && this.audioContext.state === 'suspended') {
                this.audioContext.resume().catch(() => {});
            }

            // Delay auto-play to avoid racing with visibilitychange handler.
            // Both fire around the same time when returning from background.
            if (this.audioContext.state === 'running' && this.isPlaying && this.audio.paused) {
                // Cancel any existing recovery timeout
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

        // Respect prefers-reduced-motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        const draw = () => {
            this.vizAnimId = requestAnimationFrame(draw);

            const rect = this.vizCanvas.parentElement.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;

            // Resize canvas to match container (handles DPI)
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
        // Only use the lower ~65% of frequency bins (bass through mid-high).
        // Upper bins (very high frequencies) rarely carry energy and appear as dead bars.
        var usableBins = Math.floor(this.frequencyData.length * 0.65);
        var binStep = Math.max(1, Math.floor(usableBins / barCount));
        var barWidth = W / barCount;
        var barGap = 2;
        var minBarH = 2;

        for (var i = 0; i < barCount; i++) {
            // Average a range of bins (within usable range only)
            var sum = 0;
            for (var j = 0; j < binStep; j++) {
                var idx = i * binStep + j;
                if (idx < usableBins) sum += this.frequencyData[idx];
            }
            var avg = sum / binStep;
            var normalizedH = Math.max(minBarH, (avg / 255) * H * 0.95);

            // Gradient: cyan at bottom → magenta at top
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

            // Draw bar with small border-radius feel (rounded rect)
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
            // Multi-wave pattern — faster and more dynamic for visible motion
            var wave1 = Math.sin(time * 2.8 + i * 0.35) * 0.38;
            var wave2 = Math.sin(time * 1.8 + i * 0.18 + 1.5) * 0.25;
            var wave3 = Math.sin(time * 4.5 + i * 0.7) * 0.15;
            var h = (wave1 + wave2 + wave3 + 0.6) * H * 0.7 + 3;

            // Gradient: cyan → magenta shift over time
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

        var bins = this.frequencyData.length; // 128

        // Bass: bins 0-10
        var bassSum = 0;
        for (var i = 0; i < 10 && i < bins; i++) bassSum += this.frequencyData[i];
        this.bassLevel = bassSum / (10 * 255);

        // Mids: bins 10-60
        var midSum = 0;
        for (var i = 10; i < 60 && i < bins; i++) midSum += this.frequencyData[i];
        this.midLevel = midSum / (50 * 255);

        // Treble: bins 60+
        var trebleSum = 0;
        for (var i = 60; i < bins; i++) trebleSum += this.frequencyData[i];
        this.trebleLevel = trebleSum / (Math.max(1, bins - 60) * 255);
    }

    // --- Unmute / Mute via GainNode ---

    unmute() {
        this.isMuted = false;
        if (this.gainNode) {
            this.setGainSmooth(this.audio.volume);
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
        if (this.gainNode) {
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
            if (this.isInBackground && this.backupAudio) {
                // Background: play backup (audible) + primary silenced (for lock screen UI)
                if (this.gainNode) this.setGainSmooth(0, 0.02);
                this.backupAudio.src = this.tracks[index].src;
                this.backupAudio.currentTime = 0;
                this.backupAudio.volume = this.isMuted ? 0 : this.audio.volume;
                this.backupAudio.play().catch(() => {});
                this.audio.play().catch(() => {});
            } else {
                // Foreground: ensure backup is stopped before playing primary
                if (this.backupAudio && !this.backupAudio.paused) {
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
        // Ensure src is set
        if (!this.audio.src || this.audio.src === window.location.href) {
            this.audio.src = this.tracks[this.currentIndex].src;
        }
        // Ensure AudioContext is ready
        this.initAudioContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(() => {});
        }
        // Ensure element-mute is off (for background playback on iOS)
        if (this.audioContextReady && this.audio.muted) {
            this.audio.muted = false;
        }
        // BACKGROUND-AWARE: play backup (audible) + primary silenced (for lock screen)
        if (this.isInBackground && this.backupAudio) {
            if (this.gainNode) this.setGainSmooth(0, 0.02);
            this.backupAudio.src = this.audio.src;
            try { this.backupAudio.currentTime = this.audio.currentTime; } catch (e) {}
            this.backupAudio.volume = this.audio.volume;
            this.backupAudio.play().catch(() => {});
            // Also play primary silenced so iOS lock screen shows pause button
            this.audio.play().catch(() => {});
        } else {
            // Foreground: ensure backup is stopped to prevent two songs at once
            if (this.backupAudio && !this.backupAudio.paused) {
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
        // Cancel any pending recovery timeout — prevents the statechange handler
        // from re-starting playback after the user explicitly pauses.
        // This is the key fix for "pause causes skipping" when returning from background.
        if (this._recoveryTimeout) {
            clearTimeout(this._recoveryTimeout);
            this._recoveryTimeout = null;
        }
        // Set isPlaying BEFORE pausing audio — the 'pause' event may fire
        // synchronously on some browsers, and our recovery handler checks this flag.
        this.isPlaying = false;
        this.audio.pause();
        // Also stop backup audio so it doesn't keep playing in background
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
        this.audio.volume = value;
        localStorage.setItem('es_player_volume', value);

        // Update gain node if active and not muted
        if (this.gainNode && !this.isMuted) {
            this.setGainSmooth(value);
        }

        if (value == 0) {
            this.isMuted = true;
            if (this.gainNode) this.setGainSmooth(0);
            this.updateMuteIcon();
        } else if (this.isMuted) {
            this.isMuted = false;
            if (this.gainNode) this.setGainSmooth(value);
            this.audio.muted = false;
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

            // Update lock screen progress bar (throttled to ~once per second)
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
        // Transport controls
        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
            // On any play action, unmute if muted
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

        // Expand/collapse via chevron
        this.expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            // Always ensure music is playing when expanding
            if (!this.isExpanded) {
                this.ensurePlaying();
                if (this.isMuted) this.unmute();
            }
            this.toggleExpand();
        });

        // Track name click: ensure music + toggle expand
        this.trackNameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.isExpanded) {
                this.ensurePlaying();
                if (this.isMuted) this.unmute();
            }
            this.toggleExpand();
        });

        // Player bar background click: ensure music + unmute + expand
        this.playerBar.addEventListener('click', () => {
            // Only fires if click wasn't on a child button (they stopPropagation)
            this.ensurePlaying();
            if (this.isMuted) this.unmute();
            this.toggleExpand();
        });

        // Visualizer row click: ensure music + unmute + toggle expand
        if (this.vizRow) {
            this.vizRow.addEventListener('click', (e) => {
                e.stopPropagation();
                this.ensurePlaying();
                if (this.isMuted) this.unmute();
                this.toggleExpand();
            });
        }

        // Volume controls
        this.muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMute();
        });
        this.volumeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.setVolume(parseFloat(e.target.value));
        });
        this.volumeSlider.addEventListener('click', (e) => { e.stopPropagation(); });

        // Progress bar seeking
        this.progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.seekTo(e);
        });

        // Audio events
        this.audio.addEventListener('timeupdate', () => { this.updateProgress(); });
        this.audio.addEventListener('ended', () => { this.next(); });

        // Update position state when track metadata loads (sets duration on lock screen)
        this.audio.addEventListener('loadedmetadata', () => { this.updatePositionState(); });

        // Auto-skip on load error (404, network failure, decode error)
        this.audio.addEventListener('error', () => {
            console.warn('Audio load error for:', this.tracks[this.currentIndex]?.title);
            // Auto-skip to next track after a brief delay
            if (this.isPlaying) {
                setTimeout(() => this.next(), 500);
            }
        });

        // Ensure AudioContext + muted playback on first user gesture.
        // IMPORTANT: Only use 'click', not 'touchstart'. iOS Safari does NOT
        // treat touchstart as a user gesture for audio playback, so audio.play()
        // would fail silently while isPlaying gets set to true — causing the
        // "two taps needed" bug on mobile.
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
