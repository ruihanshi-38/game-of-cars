class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.speedValElement = document.getElementById('speed-val');

        this.input = new InputHandler();
        
        // Inicialización en la parrilla de salida (sobre el asfalto)
        this.car = new Car(400, 515); 
        this.car.angle = Math.PI / 2; // Apuntando hacia la derecha

        // Dimensionamiento de los límites geométricos (Asfalto vs Muros de césped)
        this.trackOuter = { x: 50, y: 50, width: 700, height: 500 };
        this.trackInner = { x: 170, y: 170, width: 460, height: 260 };

        this.loop = this.loop.bind(this);
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
        this.car.update(this.input.keys);
        this.processCollisions();
        
        // Actualizar datos de interfaz de usuario en km/h ficticios relativos
        const kmh = Math.round(Math.abs(this.car.speed) * 28);
        this.speedValElement.innerText = kmh;
    }

    processCollisions() {
        const bounds = this.car.getBounds();
        let hitOuter = false;
        let hitInner = false;

        for (let vertex of bounds) {
            // Evaluar si toca el muro exterior
            if (vertex.x < this.trackOuter.x || 
                vertex.x > this.trackOuter.x + this.trackOuter.width ||
                vertex.y < this.trackOuter.y || 
                vertex.y > this.trackOuter.y + this.trackOuter.height) {
                hitOuter = true;
                break;
            }

            // Evaluar si invade la isla central
            if (vertex.x > this.trackInner.x && 
                vertex.x < this.trackInner.x + this.trackInner.width &&
                vertex.y > this.trackInner.y && 
                vertex.y < this.trackInner.y + this.trackInner.height) {
                hitInner = true;
                break;
            }
        }

        // --- SISTEMA DE EXPULSIÓN DE SEGURIDAD ANTIBUGS ---
        if (hitOuter || hitInner) {
            this.car.bounce(); // Hace que el coche rebote físicamente

            // Calculamos la dirección desde el centro de la pantalla hacia el coche
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const dirX = this.car.x - centerX;
            const dirY = this.car.y - centerY;
            const length = Math.sqrt(dirX * dirX + dirY * dirY);

            if (hitInner) {
                // Si toca la isla central, lo empujamos con fuerza HACIA AFUERA (dirección asfalto)
                this.car.x += (dirX / length) * 6;
                this.car.y += (dirY / length) * 6;
            } else if (hitOuter) {
                // Si toca el muro exterior, lo empujamos HACIA ADENTRO (dirección centro)
                this.car.x -= (dirX / length) * 6;
                this.car.y -= (dirY / length) * 6;
            }
        }
    }

    draw() {
        // Fondo General (Entorno verde / Fuera de pista)
        this.ctx.fillStyle = "#27ae60";
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Circuito Principal de Carreras (Asfalto gris oscuro)
        this.ctx.fillStyle = "#2c3e50";
        this.ctx.fillRect(this.trackOuter.x, this.trackOuter.y, this.trackOuter.width, this.trackOuter.height);

        // Isla Central (Muro/Obstáculo interior)
        this.ctx.fillStyle = "#27ae60";
        this.ctx.fillRect(this.trackInner.x, this.trackInner.y, this.trackInner.width, this.trackInner.height);

        // Muros de contención visuales (Líneas perimetrales blancas)
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(this.trackOuter.x, this.trackOuter.y, this.trackOuter.width, this.trackOuter.height);
        this.ctx.strokeRect(this.trackInner.x, this.trackInner.y, this.trackInner.width, this.trackInner.height);

        // Línea de Meta (Patrón de bandera a cuadros clásico)
        this.ctx.fillStyle = "#ffffff";
        const laneWidth = this.trackInner.x - this.trackOuter.x;
        for(let offset = 0; offset < laneWidth; offset += 20) {
            this.ctx.fillRect(this.trackOuter.x + offset, 490, 10, 10);
            this.ctx.fillRect(this.trackOuter.x + offset + 10, 500, 10, 10);
        }

        // Renderizar el Coche con todas sus propiedades internas activas
        this.car.draw(this.ctx);
    }
}

// Arranque automático al completar la carga del DOM
window.addEventListener('load', () => {
    const game = new Game();
    game.start();
});
