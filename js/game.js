class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Elementos DOM de la interfaz
        this.speedValElement = document.getElementById('speed-val');
        this.lapValElement = document.getElementById('lap-val');
        this.timeValElement = document.getElementById('time-val');
        this.recordValElement = document.getElementById('record-val');
        this.circuitValElement = document.getElementById('circuit-val');

        this.input = new InputHandler();
        
        // --- BASE DE DATOS DE CIRCUITOS (DIFICULTAD PROGRESIVA) ---
        this.tracks = [
            {
                // Circuito 1: Tradicional / Ancho
                outer: { x: 50, y: 100, width: 700, height: 450 },
                inner: { x: 170, y: 220, width: 460, height: 210 },
                spawn: { x: 400, y: 500, angle: Math.PI / 2 },
                finishY: 490
            },
            {
                // Circuito 2: Desplazado / Curvas más estrechas y difíciles
                outer: { x: 40, y: 60, width: 720, height: 500 },
                inner: { x: 130, y: 150, width: 540, height: 320 }, // Carril de solo 90px de ancho
                spawn: { x: 400, y: 510, angle: Math.PI / 2 },
                finishY: 500
            }
        ];
        
        this.currentTrackIndex = 0;

        // Variables del sistema de tiempos y progreso
        this.currentLap = 1;
        this.totalLaps = 3;
        this.startTime = null;
        this.bestRecord = null; 

        this.initTrack();
        this.loop = this.loop.bind(this);
    }

    initTrack() {
        const track = this.tracks[this.currentTrackIndex];
        
        // Instanciar escuderías de superdeportivos en sus posiciones de salida
        this.cars = [
            new Car(track.spawn.x, track.spawn.y, false, "#e74c3c"),       // Jugador
            new Car(track.spawn.x - 60, track.spawn.y - 35, true, "#3498db"), // IA 1
            new Car(track.spawn.x + 50, track.spawn.y - 35, true, "#f1c40f"), // IA 2
            new Car(track.spawn.x - 110, track.spawn.y, true, "#9b59b6")     // IA 3
        ];

        this.cars.forEach(car => car.angle = track.spawn.angle);
        
        // Reset de estados para el nuevo circuito
        this.currentLap = 1;
        this.startTime = Date.now();
        this.lapValElement.innerText = `${this.currentLap}/${this.totalLaps}`;
        this.circuitValElement.innerText = this.currentTrackIndex + 1;
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

        // Actualizar físicas mandando los datos del circuito activo
        this.cars.forEach(car => car.update(this.input.keys, track));
        
        this.processCollisions();
        this.processCarToCarCollisions();
        this.processLapSystem();
        
        // Actualizar cronómetro en tiempo real
        if (this.startTime) {
            const elapsed = Date.now() - this.startTime;
            this.timeValElement.innerText = this.formatTime(elapsed);
        }

        const kmh = Math.round(Math.abs(this.cars[0].speed) * 28);
        this.speedValElement.innerText = kmh;
    }

    processLapSystem() {
        const player = this.cars[0];
        const track = this.tracks[this.currentTrackIndex];

        // CHECKPOINT LOGIC: Evita trampas. El jugador debe pasar primero por la mitad superior (Y < 300)
        if (player.y < 300) {
            player.passedCheckpoint = true;
        }

        // CONTROL DE META: Cruzar la línea de meta yendo hacia abajo en el cuadrante inferior
        if (player.passedCheckpoint && player.y >= track.finishY && player.y <= track.finishY + 20 && Math.sin(player.angle) > 0) {
            player.passedCheckpoint = false; // Reset de seguridad
            
            if (this.currentLap < this.totalLaps) {
                this.currentLap++;
                this.lapValElement.innerText = `${this.currentLap}/${this.totalLaps}`;
            } else {
                // ¡Carrera terminada! Procesar récord de vuelta
                const totalTime = Date.now() - this.startTime;
                
                if (!this.bestRecord || totalTime < this.bestRecord) {
                    this.bestRecord = totalTime;
                    this.recordValElement.innerText = this.formatTime(this.bestRecord);
                }

                // Avanzar al siguiente circuito si existe, sino reiniciar el campeonato
                alert(`¡Felicidades! Completaste el Circuito ${this.currentTrackIndex + 1} en ${this.formatTime(totalTime)}`);
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
                const length = Math.sqrt(dirX * dirX + dirY * dirY);

                if (hitInner) {
                    car.x += (dirX / length) * 6;
                    car.y += (dirY / length) * 6;
                } else if (hitOuter) {
                    car.x -= (dirX / length) * 6;
                    car.y -= (dirY / length) * 6;
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
                    const overlapX = (dx / distance) * overlap * 0.5;
                    const overlapY = (dy / distance) * overlap * 0.5;

                    carA.x -= overlapX;
                    carA.y -= overlapY;
                    carB.x += overlapX;
                    carB.y += overlapY;
                }
            }
        }
    }

    draw() {
        const track = this.tracks[this.currentTrackIndex];

        // Fondo (Césped)
        this.ctx.fillStyle = "#27ae60";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Asfalto
        this.ctx.fillStyle = "#2c3e50";
        this.ctx.fillRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);

        // Isla Central Obstáculo
        this.ctx.fillStyle = "#27ae60";
        this.ctx.fillRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);

        // Muros perimetrales
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(track.outer.x, track.outer.y, track.outer.width, track.outer.height);
        this.ctx.strokeRect(track.inner.x, track.inner.y, track.inner.width, track.inner.height);

        // Dibujar Línea de Meta adaptable a las dimensiones de la pista
        this.ctx.fillStyle = "#ffffff";
        const laneWidth = track.inner.x - track.outer.x;
        for(let offset = 0; offset < laneWidth; offset += 20) {
            this.ctx.fillRect(track.outer.x + offset, track.finishY, 10, 10);
            this.ctx.fillRect(track.outer.x + offset + 10, track.finishY + 10, 10, 10);
        }

        // Renderizado general de la simulación
        this.cars.forEach(car => car.draw(this.ctx));
    }
}

window.addEventListener('load', () => {
    const game = new Game();
    game.start();
});
