/* ============================================
   Interactive Particle System
   Neon particles that react to mouse/touch
   ============================================ */

class ParticleSystem {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.mouse = { x: null, y: null };
        this.colors = [
            { r: 0,   g: 255, b: 255 },  // cyan
            { r: 255, g: 0,   b: 255 },  // magenta
            { r: 255, g: 136, b: 0   },  // orange
            { r: 170, g: 0,   b: 255 },  // purple
        ];
        this.mouseInfluenceRadius = 150;
        this.connectionDistance = 120;
        this.running = true;

        this.resize();
        this.init();
        this.bindEvents();
        this.animate();
    }

    get particleCount() {
        if (window.innerWidth < 480) return 40;
        if (window.innerWidth < 768) return 60;
        return 100;
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.particles = [];
        const count = this.particleCount;
        for (let i = 0; i < count; i++) {
            const color = this.colors[Math.floor(Math.random() * this.colors.length)];
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                radius: Math.random() * 2 + 0.5,
                color: color,
                alpha: Math.random() * 0.4 + 0.2,
                pulseSpeed: Math.random() * 0.02 + 0.005,
                pulsePhase: Math.random() * Math.PI * 2,
            });
        }
    }

    bindEvents() {
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.resize();
                this.init();
            }, 200);
        });

        // The canvas has pointer-events: none, so listen on window
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                this.mouse.x = e.touches[0].clientX;
                this.mouse.y = e.touches[0].clientY;
            }
        }, { passive: true });

        window.addEventListener('touchend', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });

        // Respect reduced motion
        const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (motionQuery.matches) {
            this.running = false;
        }
        motionQuery.addEventListener('change', (e) => {
            this.running = !e.matches;
            if (this.running) this.animate();
        });
    }

    animate() {
        if (!this.running) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (const p of this.particles) {
            // Pulse alpha
            p.pulsePhase += p.pulseSpeed;
            const dynamicAlpha = p.alpha + Math.sin(p.pulsePhase) * 0.15;

            // Mouse interaction: gentle repulsion
            if (this.mouse.x !== null && this.mouse.y !== null) {
                const dx = p.x - this.mouse.x;
                const dy = p.y - this.mouse.y;
                const distSq = dx * dx + dy * dy;
                const radiusSq = this.mouseInfluenceRadius * this.mouseInfluenceRadius;
                if (distSq < radiusSq) {
                    const dist = Math.sqrt(distSq);
                    const force = (this.mouseInfluenceRadius - dist) / this.mouseInfluenceRadius;
                    p.vx += (dx / dist) * force * 0.2;
                    p.vy += (dy / dist) * force * 0.2;
                }
            }

            // Damping
            p.vx *= 0.985;
            p.vy *= 0.985;

            // Ensure minimum drift
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed < 0.1) {
                p.vx += (Math.random() - 0.5) * 0.05;
                p.vy += (Math.random() - 0.5) * 0.05;
            }

            // Move
            p.x += p.vx;
            p.y += p.vy;

            // Wrap edges
            if (p.x < -10) p.x = this.canvas.width + 10;
            if (p.x > this.canvas.width + 10) p.x = -10;
            if (p.y < -10) p.y = this.canvas.height + 10;
            if (p.y > this.canvas.height + 10) p.y = -10;

            // Draw particle
            const a = Math.max(0, Math.min(1, dynamicAlpha));
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, ${a})`;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = `rgba(${p.color.r}, ${p.color.g}, ${p.color.b}, 0.5)`;
            this.ctx.fill();
        }

        // Reset shadow for connections
        this.ctx.shadowBlur = 0;

        // Draw connections between nearby particles
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distSq = dx * dx + dy * dy;
                const maxDistSq = this.connectionDistance * this.connectionDistance;
                if (distSq < maxDistSq) {
                    const alpha = (1 - Math.sqrt(distSq) / this.connectionDistance) * 0.12;
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = `rgba(0, 255, 255, ${alpha})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        }

        requestAnimationFrame(() => this.animate());
    }
}
