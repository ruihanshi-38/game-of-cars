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
                spawn1: { x: 380, y: 510, angle: Math.PI / 2 },
                spawn2: { x: 440, y: 510, angle: Math.PI / 2 },
                finishY: 490
            },
            {
                outer: { x: 40, y: 60, width: 720, height: 500 },
                inner: { x: 140, y: 160, width: 520, height: 300 },
                spawn1: { x: 380, y: 520, angle: Math.PI / 2 },
                spawn2: { x: 440, y: 520, angle: Math.PI / 2 },
                finishY: 500
            }
        ];
        
        this.currentTrackIndex = 0;
        this.totalLaps = 3;
        this.startTime = null;
        this.bestRecord = null; 

        this.initTrack();
        this.loop = this.loop.bind(this);
    }

    initTrack() {
        const track = this.tracks[this.currentTrackIndex];
        
        // Creamos solo dos coches con IDs y colores diferentes
        this.cars = [
            new Car(track.spawn1.x, track.spawn1.y, "#e74c3c", 1), // J1 - Rojo
            new Car(track.spawn2.x, track.spawn2.y, "#3498db", 2)  // J2 - Azul
        ];

        this.cars.forEach(car => {
            car.angle = track.spawn1.angle;
            car.currentLap = 1;
            car.passedCheckpoint = false;
        });
        
        this.startTime = Date.now();
        this.updateUI();
    }

    updateUI() {
        if (this.circuitValElement) this.circuitValElement.innerText = this.currentTrackIndex + 1;
        if (this.lapValElement && this.cars[0] && this.cars[1]) {
            // Mostramos las vueltas de ambos jugadores de forma limpia en el mismo panel
            this.lapValElement.innerHTML = `J1: ${this.cars[0].currentLap}/${this.totalLaps} | J2: ${this.cars[1].currentLap}/${this.totalLaps}`;
        }
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

        // Obtenemos los mapas de teclas independientes desde input.js
        const p1Input = this.input.getPlayer1Input();
        const p2Input = this.input.getPlayer2Input();

        // Actualizamos cada coche con su respectivo mando de control
        if (this.cars[0]) this.cars[0].update(p1Input, track);
        if (this.cars[1]) this.cars[1].update(p2Input, track);
        
        this.processCollisions();
        this.processCarToCarCollisions();
        this.processLapSystem();
        
        if (this.startTime && this.timeValElement) {
            const elapsed = Date.now() - this.startTime;
            this.timeValElement.innerText = this.formatTime(elapsed);
        }

        if (this.speedValElement && this.cars[0] && this.cars[1]) {
            const kmhP1 = Math.round(Math.abs(this.cars[0].speed) * 28);
            const kmhP2 = Math.round(Math.abs(this.cars[1].speed) * 28);
            this.speedValElement.innerText = `R:${kmhP1} A:${kmhP2}`;
        }
    }

    processLapSystem() {
        const track = this.tracks[this.currentTrackIndex];
        
        this.cars.forEach(car => {
            if (car.y < 300) {
                car.passedCheckpoint = true;
            }

            if (car.passedCheckpoint && car.y >= track.finishY && car.y <= track.finishY + 25) {
                car.passedCheckpoint = false; 
                
                if (car.currentLap < this.totalLaps) {
                    car.currentLap++;
                    this.updateUI();
                } else {
                    const totalTime = Date.now() - this.startTime;
                    
                    if (!this.bestRecord || totalTime < this.bestRecord) {
                        this.bestRecord = totalTime;
                        if (this.recordValElement) this.recordValElement.innerText = this.formatTime(this.bestRecord);
                    }

                    alert(`¡Victoria del JUGADOR ${car.id}! Completó el Circuito en ${this.formatTime(totalTime)}`);
                    this.currentTrackIndex = (this.currentTrackIndex + 1) % this.tracks.length;
                    this.initTrack();
                }
            }
        });
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
        if (this.cars.length < 2) return;
        const carA = this.cars[0];
        const carB = this.cars[1];

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

        // Líneas blancas perimetrales
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);
        this.ctx.strokeRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);

        // Línea de Meta a cuadros
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
    try {
        const game = new Game();
        game.start();
    } catch (error) {
        console.error("Error al iniciar el juego de carreras:", error);
    }
});
