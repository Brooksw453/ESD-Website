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
        this.isMuted = false;         // no autoplay; user clicks play to start
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

        // Shuffle mode (persists across track changes)
        this.shuffleEnabled = false;

        // Recovery coordination — prevents visibility + statechange handlers from racing
        this._recoveryTimeout = null;
        // Throttle for MediaSession position state updates
        this._lastPositionUpdate = 0;

        // Audio init state
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

        // Pre-load track metadata (name + src) without playing
        this.audio.src = this.tracks[this.currentIndex].src;

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

    // --- Audio Init ---

    initAudioContext() {
        if (this.audioContextReady) return;

        // All platforms: let <audio> play natively with synthetic visualizer.
        // No AudioContext routing needed — avoids all background/lock screen issues.
        this.usesNativePlayback = true;
        this.audioContextReady = true;
        this.audio.muted = false;
        this.audio.volume = this.isMuted ? 0 : this._userVolume;
    }

    // Ensure music starts playing (called from game launch triggers)
    ensurePlaying() {
        this.initAudioContext();
        this.audio.muted = false;
        this.audio.volume = this.isMuted ? 0 : this._userVolume;
        if (!this.isPlaying) {
            if (!this.audio.src || this.audio.src === window.location.href) {
                this.audio.src = this.tracks[this.currentIndex].src;
            }
            this.musicEnabled = true;
            this.isPlaying = true;
            this.updatePlayPauseIcon();
            if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            this.audio.play().catch(() => {
                this.isPlaying = false;
                this.updatePlayPauseIcon();
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
            });
        }
    }

    // --- Media Session API (lock screen controls + background playback) ---

    setupMediaSession() {
        if (!('mediaSession' in navigator)) return;

        this.setMediaSessionHandlers();
        this.updateMediaSessionMetadata();
    }

    setMediaSessionHandlers() {
        if (!('mediaSession' in navigator)) return;

        // Register play/pause and track skip handlers.
        // IMPORTANT: Do NOT register seekforward/seekbackward/seekto handlers.
        // On iOS, registering seek handlers (even setting them to null) causes
        // the lock screen to show ±10s seek buttons instead of prev/next track.
        // By only registering track handlers, iOS shows skip buttons.
        navigator.mediaSession.setActionHandler('play', () => { this.play(); this.unmute(); });
        navigator.mediaSession.setActionHandler('pause', () => { this.pause(); });
        navigator.mediaSession.setActionHandler('nexttrack', () => { this.next(); });
        navigator.mediaSession.setActionHandler('previoustrack', () => { this.prev(); });
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

        // Re-apply track handlers after metadata update — iOS can reset
        // action handlers when metadata changes, reverting to seek buttons.
        this.setMediaSessionHandlers();
    }

    updatePositionState() {
        // Intentionally empty — calling setPositionState causes iOS to show
        // ±10s seek buttons instead of next/previous track skip buttons.
        // The progress bar in the player handles position display.
    }

    bindVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.isInBackground = true;
                // Audio plays natively via <audio> element — nothing to do
            } else if (document.visibilityState === 'visible') {
                this.isInBackground = false;
                if (this._recoveryTimeout) {
                    clearTimeout(this._recoveryTimeout);
                    this._recoveryTimeout = null;
                }
                // Sync UI state with actual audio state
                this.isPlaying = !this.audio.paused;
                this.updatePlayPauseIcon();
                if ('mediaSession' in navigator) {
                    navigator.mediaSession.playbackState = this.isPlaying ? 'playing' : 'paused';
                }
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

            if (this.isPlaying && !this.isMuted) {
                // Active synthetic visualizer (all platforms)
                this.drawSyntheticVisualizer(ctx, W, H);
                this.updateSyntheticAudioLevels();
            } else {
                // Idle animation (not playing or muted)
                this.drawIdleVisualizer(ctx, W, H);
            }

            ctx.restore();
        };

        draw();
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

    drawSyntheticVisualizer(ctx, W, H) {
        var barCount = W < 480 ? 32 : W < 768 ? 48 : 64;
        var barWidth = W / barCount;
        var barGap = 2;
        var time = performance.now() / 1000;

        for (var i = 0; i < barCount; i++) {
            var freqPos = i / barCount;

            // Bass region: slow, large amplitude
            var bass = Math.sin(time * 1.8 + i * 0.15) * 0.5 *
                       Math.max(0, 1 - freqPos * 2.5);
            // Mid region: medium speed
            var mid = Math.sin(time * 3.2 + i * 0.4 + 2.1) * 0.35 *
                      (1 - Math.abs(freqPos - 0.4) * 2.5);
            // Treble region: fast, small amplitude
            var treble = Math.sin(time * 5.5 + i * 0.8 + 4.3) * 0.25 *
                         Math.max(0, freqPos * 2 - 0.6);
            // Beat pulse: simulates a rhythmic kick
            var beat = Math.pow(Math.max(0, Math.sin(time * 2.4)), 4) * 0.3 *
                       Math.max(0, 1 - freqPos * 3);
            // Organic noise
            var noise = (Math.sin(time * 7.3 + i * 13.7) *
                         Math.sin(time * 11.1 + i * 7.3)) * 0.12;

            var level = Math.max(0.02, Math.min(1.0, bass + mid + treble + beat + noise + 0.15));
            var normalizedH = Math.max(2, level * H * 0.95);

            // Same gradient as real frequency bars
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

    updateSyntheticAudioLevels() {
        var time = performance.now() / 1000;
        this.bassLevel = Math.max(0, Math.sin(time * 1.8) * 0.4 +
                         Math.pow(Math.max(0, Math.sin(time * 2.4)), 4) * 0.3 + 0.15);
        this.midLevel = Math.max(0, Math.sin(time * 3.2 + 2.1) * 0.3 + 0.2);
        this.trebleLevel = Math.max(0, Math.sin(time * 5.5 + 4.3) * 0.2 + 0.15);
    }

    // --- Unmute / Mute ---

    unmute() {
        this.isMuted = false;
        this.audio.volume = this._userVolume;
        this.audio.muted = false;
        this.updateMuteIcon();
    }

    mute() {
        this.isMuted = true;
        this.audio.volume = 0;
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
        this.musicEnabled = true;
        this.initAudioContext();
        if (!this.audio.src || this.audio.src === window.location.href) {
            this.audio.src = this.tracks[this.currentIndex].src;
        }
        this.audio.muted = false;
        this.audio.volume = this.isMuted ? 0 : this._userVolume;
        this.audio.play().catch(() => {});
        this.isPlaying = true;
        this.updatePlayPauseIcon();
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    }

    pause() {
        if (this._recoveryTimeout) {
            clearTimeout(this._recoveryTimeout);
            this._recoveryTimeout = null;
        }
        this.isPlaying = false;
        this.audio.pause();
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

        if (!this.isMuted) {
            this.audio.volume = value;
        }

        if (value == 0) {
            this.isMuted = true;
            this.audio.volume = 0;
            this.updateMuteIcon();
        } else if (this.isMuted) {
            this.isMuted = false;
            this.audio.volume = value;
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
            this.shuffleEnabled = !this.shuffleEnabled;
            this.shuffleBtn.classList.toggle('shuffle-active', this.shuffleEnabled);
            // If turning shuffle on, immediately shuffle to a new track
            if (this.shuffleEnabled) {
                this.shuffle();
            }
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
            // Unmute FIRST, then play — iOS requires audible volume to be set
            // before audio.play() within the same user gesture context
            this.initAudioContext();
            this.unmute();
            if (!this.audio.src || this.audio.src === window.location.href) {
                this.audio.src = this.tracks[this.currentIndex].src;
            }
            this.audio.muted = false;
            this.audio.volume = this._userVolume;
            this.audio.play().then(() => {
                this.isPlaying = true;
                this.musicEnabled = true;
                this.updatePlayPauseIcon();
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
            }).catch(() => {});
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
        this.audio.addEventListener('ended', () => { this.shuffleEnabled ? this.shuffle() : this.next(); });
        this.audio.addEventListener('loadedmetadata', () => { this.updatePositionState(); });

        // Auto-skip on load error (404, network failure, decode error)
        this.audio.addEventListener('error', () => {
            console.warn('Audio load error for:', this.tracks[this.currentIndex]?.title);
            if (this.isPlaying) {
                setTimeout(() => this.next(), 500);
            }
        });

    }
}
