/* ============================================
   Global Music Player — Compact Bar
   Persistent across page navigation
   Expands/collapses on click
   ============================================ */

class MusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioElement');
        if (!this.audio) return;

        this.tracks = [
            { title: 'Opening Song',               src: 'assets/audio/Opening Song.mp3' },
            { title: 'Press Start to Maybe',       src: 'assets/audio/Press Start to Maybe.mp3' },
            { title: 'Push Through Static',        src: 'assets/audio/Push Through Static.mp3' },
            { title: 'Push Through It',            src: 'assets/audio/Push Through It.mp3' },
            { title: 'Journey Through It',         src: 'assets/audio/Journey Through It.mp3' },
            { title: 'The Sky Turn',               src: 'assets/audio/The Sky Turn.mp3' },
            { title: 'You Might',                  src: 'assets/audio/You Might.mp3' },
            { title: 'Glow on the Floor',          src: 'assets/audio/Glow on the Floor.mp3' },
            { title: 'Bright Poppy',               src: 'assets/audio/Bright Poppy.mp3' },
            { title: 'Midnight Voltage',           src: 'assets/audio/Midnight Voltage.mp3' },
            { title: 'Move Your Feet',             src: 'assets/audio/Move Your Feet.mp3' },
            { title: 'Starshine',                  src: 'assets/audio/Starshine.mp3' },
            { title: 'Search for Prophet',         src: 'assets/audio/Search for Prophet.mp3' },
            { title: 'Tearing Up the House',       src: 'assets/audio/Tearing Up the House.mp3' },
            { title: 'Jagged Edge',                src: 'assets/audio/Jagged Edge.mp3' },
            { title: 'Touch the Button',           src: 'assets/audio/Touch the Button.mp3' },
            { title: 'Glow on the Floor (Original)', src: 'assets/audio/Glow on the Floor Original.mp3' },
        ];

        this.currentIndex = 0;
        this.isPlaying = false;
        this.isMuted = false;
        this.musicEnabled = false;
        this.isExpanded = false;

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
        this.enableOverlay = document.getElementById('musicEnableOverlay');

        this.restoreState();
        this.buildTrackList();
        this.loadTrack(this.currentIndex, false);
        this.bindEvents();
    }

    restoreState() {
        const savedVolume = localStorage.getItem('es_player_volume');
        const savedTrack = localStorage.getItem('es_player_track');
        if (savedVolume !== null) {
            this.audio.volume = parseFloat(savedVolume);
            this.volumeSlider.value = savedVolume;
        } else {
            this.audio.volume = 0.5;
        }
        if (savedTrack !== null) {
            const idx = parseInt(savedTrack);
            if (idx >= 0 && idx < this.tracks.length) {
                this.currentIndex = idx;
            }
        }
    }

    buildTrackList() {
        this.trackListEl.innerHTML = '';
        this.tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'tracklist-item' + (index === this.currentIndex ? ' active' : '');
            item.innerHTML = `
                <span class="track-number">${String(index + 1).padStart(2, '0')}</span>
                <span class="track-title">${track.title}</span>
            `;
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.loadTrack(index, true);
                this.play();
                // Auto-collapse after selecting a track
                this.collapse();
            });
            this.trackListEl.appendChild(item);
        });
    }

    updateTrackListActive() {
        const items = this.trackListEl.querySelectorAll('.tracklist-item');
        items.forEach((item, i) => {
            item.classList.toggle('active', i === this.currentIndex);
        });
    }

    loadTrack(index, autoplay) {
        this.currentIndex = index;
        this.audio.src = this.tracks[index].src;
        this.audio.preload = 'metadata';
        this.trackNameEl.textContent = this.tracks[index].title;
        this.progressFill.style.width = '0%';
        this.updateTrackListActive();
        localStorage.setItem('es_player_track', index);

        if (autoplay && this.musicEnabled) {
            this.audio.play().catch(() => {});
            this.isPlaying = true;
            this.updatePlayPauseIcon();
        }
    }

    play() {
        if (!this.musicEnabled) {
            this.enableMusic();
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
        let nextIndex = this.currentIndex + 1;
        if (nextIndex >= this.tracks.length) nextIndex = 0;
        this.loadTrack(nextIndex, true);
        if (this.musicEnabled) this.play();
    }

    prev() {
        if (this.audio.currentTime > 3) {
            this.audio.currentTime = 0;
            return;
        }
        let prevIndex = this.currentIndex - 1;
        if (prevIndex < 0) prevIndex = this.tracks.length - 1;
        this.loadTrack(prevIndex, true);
        if (this.musicEnabled) this.play();
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

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.audio.muted = this.isMuted;
        this.volumeOnIcon.style.display = this.isMuted ? 'none' : 'block';
        this.volumeOffIcon.style.display = this.isMuted ? 'block' : 'none';
    }

    setVolume(value) {
        this.audio.volume = value;
        localStorage.setItem('es_player_volume', value);
        if (value === 0) {
            this.isMuted = true;
            this.volumeOnIcon.style.display = 'none';
            this.volumeOffIcon.style.display = 'block';
        } else if (this.isMuted) {
            this.isMuted = false;
            this.audio.muted = false;
            this.volumeOnIcon.style.display = 'block';
            this.volumeOffIcon.style.display = 'none';
        }
    }

    seekTo(e) {
        const rect = this.progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        if (this.audio.duration) {
            this.audio.currentTime = percent * this.audio.duration;
        }
    }

    updateProgress() {
        if (this.audio.duration) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            this.progressFill.style.width = percent + '%';
        }
    }

    enableMusic() {
        this.musicEnabled = true;
        this.enableOverlay.classList.add('hidden');
    }

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

    // Play a specific track by title (used by soundtrack list on VR page)
    playTrackByTitle(title) {
        const index = this.tracks.findIndex(t => t.title === title);
        if (index !== -1) {
            this.loadTrack(index, true);
            this.play();
        }
    }

    bindEvents() {
        // Transport controls — stop propagation so they don't trigger expand
        this.playPauseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlayPause();
        });
        this.nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.next();
        });
        this.prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.prev();
        });

        // Expand/collapse — clicking the bar or the chevron
        this.expandBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand();
        });

        // Clicking the track name area also toggles expand
        this.trackNameEl.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleExpand();
        });

        // Volume controls inside expanded panel
        this.muteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMute();
        });
        this.volumeSlider.addEventListener('input', (e) => {
            e.stopPropagation();
            this.setVolume(parseFloat(e.target.value));
        });
        this.volumeSlider.addEventListener('click', (e) => e.stopPropagation());

        // Progress bar seeking
        this.progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            this.seekTo(e);
        });

        // Audio events
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.next());

        // Enable music on first interaction anywhere
        const enableHandler = () => {
            this.enableMusic();
            document.removeEventListener('click', enableHandler);
            document.removeEventListener('touchstart', enableHandler);
        };
        document.addEventListener('click', enableHandler);
        document.addEventListener('touchstart', enableHandler);

        // Overlay click starts music
        this.enableOverlay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.play();
        });
    }
}
