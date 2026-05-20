class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        
        this.speedValElement = document.getElementById('speed-val');
        this.lapValElement = document.getElementById('lap-val');
        this.timeValElement = document.getElementById('time-val');
        this.recordValElement = document.getElementById('record-val');
        this.circuitValElement = document.getElementById('circuit-val');

        this.input = new InputHandler();
        
        this.tracks = [
            {
                outer: { x: 50, y: 100, width: 700, height: 450 },
                inner: { x: 170, y: 220, width: 460, height: 210 },
                spawn: { x: 400, y: 500, angle: Math.PI / 2 },
                finishY: 490,
                waypoints: [
                    { x: 680, y: 500 }, 
                    { x: 680, y: 160 }, 
                    { x: 110, y: 160 }, 
                    { x: 110, y: 500 }  
                ]
            },
            {
                outer: { x: 40, y: 60, width: 720, height: 500 },
                inner: { x: 140, y: 160, width: 520, height: 300 },
                spawn: { x: 400, y: 510, angle: Math.PI / 2 },
                finishY: 500,
                waypoints: [
                    { x: 690, y: 510 },
                    { x: 690, y: 110 },
                    { x: 90, y: 110 },
                    { x: 90, y: 510 }
                ]
            }
        ];
        
        this.currentTrackIndex = 0;
        this.currentLap = 1;
        this.totalLaps = 3;
        this.startTime = null;
        this.bestRecord = null; 

        this.initTrack();
        this.loop = this.loop.bind(this);
    }

    initTrack() {
        const track = this.tracks[this.currentTrackIndex];
        
        this.cars = [
            new Car(track.spawn.x, track.spawn.y, false, "#e74c3c"),       
            new Car(track.spawn.x - 60, track.spawn.y - 25, true, "#3498db"), 
            new Car(track.spawn.x + 50, track.spawn.y - 25, true, "#f1c40f"), 
            new Car(track.spawn.x - 110, track.spawn.y, true, "#9b59b6")     
        ];

        this.cars.forEach(car => {
            car.angle = track.spawn.angle;
            car.currentWaypointIndex = 0; 
        });
        
        this.currentLap = 1;
        this.startTime = Date.now();
        
        if (this.lapValElement) this.lapValElement.innerText = `${this.currentLap}/${this.totalLaps}`;
        if (this.circuitValElement) this.circuitValElement.innerText = this.currentTrackIndex + 1;
    }

    start() {
        requestAnimationFrame(this.loop);
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(this.loop);
    }

    update() {
        const track = this.tracks[this.currentTrackIndex];
        const keys = this.input ? this.input.keys : {};

        this.cars.forEach(car => car.update(keys, track));
        
        this.processCollisions();
        this.processCarToCarCollisions();
        this.processLapSystem();
        
        if (this.startTime && this.timeValElement) {
            const elapsed = Date.now() - this.startTime;
            this.timeValElement.innerText = this.formatTime(elapsed);
        }

        if (this.speedValElement && this.cars[0]) {
            const kmh = Math.round(Math.abs(this.cars[0].speed) * 28);
            this.speedValElement.innerText = kmh;
        }
    }

    processLapSystem() {
        const player = this.cars[0];
        const track = this.tracks[this.currentTrackIndex];
        if (!player) return;

        if (player.y < 300) {
            player.passedCheckpoint = true;
        }

        if (player.passedCheckpoint && player.y >= track.finishY && player.y <= track.finishY + 25) {
            player.passedCheckpoint = false; 
            
            if (this.currentLap < this.totalLaps) {
                this.currentLap++;
                if (this.lapValElement) this.lapValElement.innerText = `${this.currentLap}/${this.totalLaps}`;
            } else {
                const totalTime = Date.now() - this.startTime;
                
                if (!this.bestRecord || totalTime < this.bestRecord) {
                    this.bestRecord = totalTime;
                    if (this.recordValElement) this.recordValElement.innerText = this.formatTime(this.bestRecord);
                }

                alert(`¡Victoria! Completaste el Circuito ${this.currentTrackIndex + 1} en ${this.formatTime(totalTime)}`);
                this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
                this.initTrack();
            }
        }
    }

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const miliseconds = Math.floor((ms % 1000) / 10);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${miliseconds.toString().padStart(2, '0')}`;
    }

    processCollisions() {
        const track = this.tracks[this.currentTrackIndex];
        const centerX = track.inner.x + track.inner.width / 2;
        const centerY = track.inner.y + track.inner.height / 2;

        this.cars.forEach(car => {
            const bounds = car.getBounds();
            let hitOuter = false;
            let hitInner = false;

            for (let vertex of bounds) {
                if (vertex.x < track.outer.x || 
                    vertex.x > track.outer.x + track.outer.width ||
                    vertex.y < track.outer.y || 
                    vertex.y > track.outer.y + track.outer.height) {
                    hitOuter = true;
                    break;
                }

                if (vertex.x > track.inner.x && 
                    vertex.x < track.inner.x + track.inner.width &&
                    vertex.y > track.inner.y && 
                    vertex.y < track.inner.y + track.inner.height) {
                    hitInner = true;
                    break;
                }
            }

            if (hitOuter || hitInner) {
                car.bounce();

                const dirX = car.x - centerX;
                const dirY = car.y - centerY;
                const length = Math.sqrt(dirX * dirX + dirY * dirY) || 1;

                if (hitInner) {
                    car.x += (dirX / length) * 7;
                    car.y += (dirY / length) * 7;
                } else if (hitOuter) {
                    car.x -= (dirX / length) * 7;
                    car.y -= (dirY / length) * 7;
                }
            }
        });
    }

    processCarToCarCollisions() {
        for (let i = 0; i < this.cars.length; i++) {
            for (let j = i + 1; j < this.cars.length; j++) {
                const carA = this.cars[i];
                const carB = this.cars[j];

                const dx = carB.x - carA.x;
                const dy = carB.y - carA.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const minDist = 38; 

                if (distance < minDist) {
                    carA.bounce();
                    carB.bounce();

                    const overlap = minDist - distance;
                    const overlapX = ((dx / (distance || 1)) * overlap) * 0.5;
                    const overlapY = ((dy / (distance || 1)) * overlap) * 0.5;

                    carA.x -= overlapX;
                    carA.y -= overlapY;
                    carB.x += overlapX;
                    carB.y += overlapY;
                }
            }
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;
        const track = this.tracks[this.currentTrackIndex];

        // Césped
        this.ctx.fillStyle = "#27ae60";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Asfalto
        this.ctx.fillStyle = "#2c3e50";
        this.ctx.fillRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);

        // Isla Central
        this.ctx.fillStyle = "#27ae60";
        this.ctx.fillRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);

        // Líneas blancas
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);
        this.ctx.strokeRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);

        // Línea de Meta
        this.ctx.fillStyle = "#ffffff";
        const laneWidth = track.inner.x - track.outer.x;
        for(let offset = 0; offset < laneWidth; offset += 20) {
            this.ctx.fillRect(track.outer.x + offset, track.finishY, 10, 10);
            this.ctx.fillRect(track.outer.x + offset + 10, track.finishY + 10, 10, 10);
        }

        this.cars.forEach(car => car.draw(this.ctx));
    }
}

window.addEventListener('load', () => {
    const game = new Game();
    game.start();
});
