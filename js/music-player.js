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
            { title: 'Move Your Feet',             src: 'assets/audio/Move Your Feet.mp3' },
            { title: 'Starshine',                  src: 'assets/audio/Starshine.mp3' },
            { title: 'Search for Prophet',         src: 'assets/audio/Search for Prophet.mp3' },
            { title: 'Touch the Button',           src: 'assets/audio/Touch the Button.mp3' },
            { title: 'Glow on the Floor (Original)', src: 'assets/audio/Glow on the Floor Original.mp3' },
        ];

        this.currentIndex = 0;
        this.isPlaying = false;
        this.isMuted = true;          // starts muted (gain = 0)
        this.musicEnabled = false;
        this.isExpanded = false;

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

        // Start muted autoplay
        this.startMutedAutoplay();

        // Start visualizer loop (shows idle animation until audio data is ready)
        this.startVisualizer();
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
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    startMutedAutoplay() {
        // Start with element muted (browsers allow this for autoplay)
        this.audio.muted = true;
        this.audio.src = this.tracks[this.currentIndex].src;

        this.audio.play().then(() => {
            this.isPlaying = true;
            this.musicEnabled = true;
            this.updatePlayPauseIcon();
            // Try to init AudioContext (may fail without user gesture on some browsers)
            this.initAudioContext();
        }).catch(() => {
            // Autoplay blocked — will start on first user interaction
            this.isPlaying = false;
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
        var binStep = Math.max(1, Math.floor(this.frequencyData.length / barCount));
        var barWidth = W / barCount;
        var barGap = 2;
        var minBarH = 2;

        for (var i = 0; i < barCount; i++) {
            // Average a range of bins
            var sum = 0;
            for (var j = 0; j < binStep; j++) {
                var idx = i * binStep + j;
                if (idx < this.frequencyData.length) sum += this.frequencyData[idx];
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
            var h = (Math.sin(time * 1.5 + i * 0.25) * 0.3 + 0.5) * H * 0.12 + 2;

            ctx.fillStyle = 'rgba(0, 255, 255, 0.12)';
            ctx.shadowBlur = 3;
            ctx.shadowColor = 'rgba(0, 255, 255, 0.15)';

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
        this.audio.play().catch(() => {});
        this.isPlaying = true;
        this.updatePlayPauseIcon();
    }

    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.updatePlayPauseIcon();
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

        // Expand/collapse via chevron
        this.expandBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self.toggleExpand();
        });

        // Track name click also toggles expand
        this.trackNameEl.addEventListener('click', function(e) {
            e.stopPropagation();
            self.toggleExpand();
        });

        // Visualizer row click: unmute + toggle expand
        if (this.vizRow) {
            this.vizRow.addEventListener('click', function(e) {
                e.stopPropagation();
                // First click when muted: unmute
                if (self.isMuted && self.isPlaying) {
                    self.initAudioContext();
                    self.unmute();
                } else if (!self.isPlaying) {
                    // If not playing at all, start playback
                    self.play();
                    self.unmute();
                }
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

        // Ensure AudioContext on first user gesture (iOS Safari compatibility)
        var gestureHandler = function() {
            self.initAudioContext();
            if (self.audioContext && self.audioContext.state === 'suspended') {
                self.audioContext.resume();
            }
            // If autoplay failed, try starting now
            if (!self.isPlaying && self.audio.src) {
                self.audio.play().then(function() {
                    self.isPlaying = true;
                    self.musicEnabled = true;
                    self.updatePlayPauseIcon();
                }).catch(function() {});
            }
            document.removeEventListener('click', gestureHandler);
            document.removeEventListener('touchstart', gestureHandler);
        };
        document.addEventListener('click', gestureHandler);
        document.addEventListener('touchstart', gestureHandler);
    }
}
