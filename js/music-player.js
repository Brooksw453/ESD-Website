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
        // Shuffle: always pick a random track on page load
        this.currentIndex = Math.floor(Math.random() * this.tracks.length);
    }

    // --- Web Audio API ---

    initAudioContext() {
        if (this.audioContextReady) return;

        try {
            var AudioCtx = window.AudioContext || window.webkitAudioContext;
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
            this.bindAudioContextRecovery();
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    startMutedAutoplay() {
        // Start with element muted (browsers allow this for autoplay)
        this.audio.muted = true;
        this.audio.src = this.tracks[this.currentIndex].src;
        this.audio.load();

        var self = this;
        var attemptPlay = function(retries) {
            self.audio.play().then(function() {
                self.isPlaying = true;
                self.musicEnabled = true;
                self.updatePlayPauseIcon();
                // Try to init AudioContext (may fail without user gesture on some browsers)
                self.initAudioContext();
            }).catch(function() {
                // Retry after a short delay (browser may allow after DOM settles)
                if (retries > 0) {
                    setTimeout(function() { attemptPlay(retries - 1); }, 500);
                } else {
                    // Autoplay completely blocked (common on mobile).
                    // Keep isPlaying false — visualizer will show idle wave.
                    // Music will start on first user interaction via gestureHandler.
                    self.isPlaying = false;
                    self.updatePlayPauseIcon();
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
                this.gainNode.gain.value = this.isMuted ? 0 : this.audio.volume;
            }
        }
        if (!this.isPlaying) {
            // Ensure src is set
            if (!this.audio.src || this.audio.src === window.location.href) {
                this.audio.src = this.tracks[this.currentIndex].src;
            }
            var self = this;
            this.isPlaying = true;
            this.musicEnabled = true;
            this.updatePlayPauseIcon();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            this.audio.play().catch(function() {
                // Play failed (iOS touchstart isn't a user gesture for audio).
                // Reset state so the next click can try again.
                self.isPlaying = false;
                self.updatePlayPauseIcon();
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            });
        }
    }

    // --- Media Session API (lock screen controls + background playback) ---

    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;
        var self = this;

        navigator.mediaSession.setActionHandler('play', function() { self.play(); self.unmute(); });
        navigator.mediaSession.setActionHandler('pause', function() { self.pause(); });
        navigator.mediaSession.setActionHandler('nexttrack', function() { self.next(); });
        navigator.mediaSession.setActionHandler('previoustrack', function() { self.prev(); });

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

    // --- Background playback ---
    // On iOS, AudioContext is suspended when the page goes to background/lock screen.
    // Since createMediaElementSource() routes all audio through AudioContext, the audio
    // pipeline dies. We use a BACKUP Audio element (not connected to AudioContext) that
    // takes over during background playback, then syncs back when returning.

    initBackupAudio() {
        if (this.backupAudio) return;
        var self = this;
        this.backupAudio = new Audio();
        this.backupAudio.preload = 'none';

        // When backup audio finishes a track in background, advance to next
        this.backupAudio.addEventListener('ended', function() {
            if (document.visibilityState === 'hidden' && self.isPlaying) {
                var nextIdx = self.currentIndex + 1;
                if (nextIdx >= self.tracks.length) nextIdx = 0;
                self.currentIndex = nextIdx;
                self.trackNameEl.textContent = self.tracks[nextIdx].title;
                self.updateTrackListActive();
                self.updateMediaSessionMetadata();
                self.backupAudio.src = self.tracks[nextIdx].src;
                self.backupAudio.play().catch(function() {});
            }
        });

        // "Unlock" for iOS: play briefly during user gesture so future play() calls work
        this.backupAudio.src = this.tracks[this.currentIndex].src;
        this.backupAudio.volume = 0.001;
        this.backupAudio.play().then(function() {
            self.backupAudio.pause();
            self.backupAudio.volume = 0;
        }).catch(function() {});
    }

    bindVisibilityHandler() {
        var self = this;
        document.addEventListener('visibilitychange', function() {
            if (document.visibilityState === 'hidden') {
                // Page going to background — start backup audio for iOS lock screen
                if (self.isPlaying && !self.isMuted && self.backupAudio) {
                    try {
                        self.backupAudio.src = self.audio.src;
                        self.backupAudio.currentTime = self.audio.currentTime;
                        self.backupAudio.volume = self.audio.volume;
                        self.backupAudio.play().catch(function() {});
                    } catch (e) {}
                }
            } else if (document.visibilityState === 'visible') {
                // Page came back — sync from backup and resume primary
                if (self.backupAudio && !self.backupAudio.paused) {
                    try {
                        // Sync track if backup advanced to a different track
                        var backupSrc = self.backupAudio.src;
                        var primarySrc = self.audio.src;
                        if (backupSrc !== primarySrc) {
                            self.audio.src = backupSrc;
                        }
                        self.audio.currentTime = self.backupAudio.currentTime;
                    } catch (e) {}
                    self.backupAudio.pause();
                    self.backupAudio.volume = 0;
                }

                // Resume AudioContext
                if (self.audioContext && self.audioContext.state === 'suspended') {
                    self.audioContext.resume();
                }
                // Resume primary audio if it should be playing
                if (self.isPlaying && self.audio.paused) {
                    self.audio.play().catch(function() {});
                }
            }
        });

        // Listen for AudioContext state changes (iOS 'interrupted' state)
        this.bindAudioContextRecovery();
    }

    bindAudioContextRecovery() {
        if (!this.audioContext) return;
        var self = this;
        this.audioContext.addEventListener('statechange', function() {
            if (self.isPlaying && self.audioContext.state === 'suspended') {
                self.audioContext.resume().catch(function() {});
            }
            if (self.audioContext.state === 'running' && self.isPlaying && self.audio.paused) {
                self.audio.play().catch(function() {});
            }
        });
    }

    // --- Visualizer ---

    startVisualizer() {
        if (!this.vizCanvas || !this.vizCtx) return;

        // Respect prefers-reduced-motion
        var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) return;

        var self = this;

        var draw = function() {
            self.vizAnimId = requestAnimationFrame(draw);

            var rect = self.vizCanvas.parentElement.getBoundingClientRect();
            var dpr = window.devicePixelRatio || 1;

            // Resize canvas to match container (handles DPI)
            var canvasW = Math.round(rect.width * dpr);
            var canvasH = Math.round(rect.height * dpr);
            if (self.vizCanvas.width !== canvasW || self.vizCanvas.height !== canvasH) {
                self.vizCanvas.width = canvasW;
                self.vizCanvas.height = canvasH;
            }

            var W = rect.width;
            var H = rect.height;
            var ctx = self.vizCtx;

            ctx.save();
            ctx.scale(dpr, dpr);
            ctx.clearRect(0, 0, W, H);

            if (self.analyser && self.frequencyData && self.isPlaying) {
                self.analyser.getByteFrequencyData(self.frequencyData);
                self.updateAudioLevels();
                self.drawFrequencyBars(ctx, W, H);
            } else {
                self.drawIdleVisualizer(ctx, W, H);
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
            this.gainNode.gain.value = this.audio.volume;
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
            this.gainNode.gain.value = 0;
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
            this.audio.play().catch(() => {});
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
            this.audioContext.resume();
        }
        // Ensure element-mute is off (for background playback on iOS)
        if (this.audioContextReady && this.audio.muted) {
            this.audio.muted = false;
        }
        this.audio.play().catch(() => {});
        this.isPlaying = true;
        this.updatePlayPauseIcon();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    }

    pause() {
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
            this.gainNode.gain.value = value;
        }

        if (value == 0) {
            this.isMuted = true;
            if (this.gainNode) this.gainNode.gain.value = 0;
            this.updateMuteIcon();
        } else if (this.isMuted) {
            this.isMuted = false;
            if (this.gainNode) this.gainNode.gain.value = value;
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
        }
    }

    updateProgress() {
        if (this.audio.duration) {
            var percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressFill.style.width = percent + '%';
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
        var index = this.tracks.findIndex(function(t) { return t.title === title; });
        if (index !== -1) {
            this.loadTrack(index, true);
            this.play();
        }
    }

    // --- Events ---

    bindEvents() {
        var self = this;

        // Transport controls
        this.playPauseBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.togglePlayPause();
            // On any play action, unmute if muted
            if (self.isPlaying && self.isMuted) {
                self.unmute();
            }
        });
        this.nextBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.next();
        });
        this.prevBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.prev();
        });
        this.shuffleBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.shuffle();
        });

        // Expand/collapse via chevron
        this.expandBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            // Always ensure music is playing when expanding
            if (!self.isExpanded) {
                self.ensurePlaying();
                if (self.isMuted) self.unmute();
            }
            self.toggleExpand();
        });

        // Track name click: ensure music + toggle expand
        this.trackNameEl.addEventListener('click', function(e) {
            e.stopPropagation();
            if (!self.isExpanded) {
                self.ensurePlaying();
                if (self.isMuted) self.unmute();
            }
            self.toggleExpand();
        });

        // Player bar background click: ensure music + unmute + expand
        this.playerBar.addEventListener('click', function(e) {
            // Only fires if click wasn't on a child button (they stopPropagation)
            self.ensurePlaying();
            if (self.isMuted) self.unmute();
            self.toggleExpand();
        });

        // Visualizer row click: ensure music + unmute + toggle expand
        if (this.vizRow) {
            this.vizRow.addEventListener('click', function(e) {
                e.stopPropagation();
                self.ensurePlaying();
                if (self.isMuted) self.unmute();
                self.toggleExpand();
            });
        }

        // Volume controls
        this.muteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.toggleMute();
        });
        this.volumeSlider.addEventListener('input', function(e) {
            e.stopPropagation();
            self.setVolume(parseFloat(e.target.value));
        });
        this.volumeSlider.addEventListener('click', function(e) { e.stopPropagation(); });

        // Progress bar seeking
        this.progressBar.addEventListener('click', function(e) {
            e.stopPropagation();
            self.seekTo(e);
        });

        // Audio events
        this.audio.addEventListener('timeupdate', function() { self.updateProgress(); });
        this.audio.addEventListener('ended', function() { self.next(); });

        // Ensure AudioContext + muted playback on first user gesture.
        // IMPORTANT: Only use 'click', not 'touchstart'. iOS Safari does NOT
        // treat touchstart as a user gesture for audio playback, so audio.play()
        // would fail silently while isPlaying gets set to true — causing the
        // "two taps needed" bug on mobile.
        var gestureHandled = false;
        var gestureHandler = function() {
            if (gestureHandled) return;
            gestureHandled = true;
            self.ensurePlaying();
            document.removeEventListener('click', gestureHandler);
        };
        document.addEventListener('click', gestureHandler);
    }
}
