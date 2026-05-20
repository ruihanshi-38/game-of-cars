class Particle {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        // Expulsa el humo en la dirección opuesta al avance del coche con ligera dispersión
        this.vx = -Math.sin(angle) * 2 + (Math.random() - 0.5) * 1.2;
        this.vy = Math.cos(angle) * 2 + (Math.random() - 0.5) * 1.2;
        this.alpha = 1.0;
        this.size = Math.random() * 4 + 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.025; // Ritmo de desvanecimiento
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = "rgba(236, 240, 241, 0.5)"; // Humo denso grisáceo
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Car {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 54;

        this.speed = 0;
        this.acceleration = 0.22;
        this.maxSpeed = 8.5;
        this.friction = 0.06;
        this.angle = 0;
        
        this.particles = [];
    }

    update(input) {
        // Aceleración y Reversa
        if (input.forward) this.speed += this.acceleration;
        if (input.backward) this.speed -= this.acceleration;

        // Topes de velocidad máximas
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        // Fricción ambiental natural
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        // Sistema de Giro Dinámico (Depende de la velocidad del coche)
        let drifting = false;
        if (this.speed !== 0) {
            const directionMultiplier = this.speed > 0 ? 1 : -1;
            // Mayor respuesta de giro a velocidades medias/altas
            const turnRatio = 0.042 * (Math.abs(this.speed) / this.maxSpeed + 0.35);
            
            if (input.left) { this.angle -= turnRatio * directionMultiplier; drifting = true; }
            if (input.right) { this.angle += turnRatio * directionMultiplier; drifting = true; }
        }

        // Desplazamiento por vectores trigonométricos
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;

        // Generar partículas de derrape si se gira a alta velocidad
        if (drifting && Math.abs(this.speed) > this.maxSpeed * 0.45) {
            const backX = this.x - Math.sin(this.angle) * (this.height / 2);
            const backY = this.y + Math.cos(this.angle) * (this.height / 2);
            this.particles.push(new Particle(backX, backY, this.angle));
        }

        // Ciclo de vida de las partículas
        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.alpha > 0);
    }

    // Calcula la posición matemática exacta de los 4 vértices del auto
    getBounds() {
        return [
            { x: this.x - this.width / 2, y: this.y - this.height / 2 },
            { x: this.x + this.width / 2, y: this.y - this.height / 2 },
            { x: this.x - this.width / 2, y: this.y + this.height / 2 },
            { x: this.x + this.width / 2, y: this.y + this.height / 2 }
        ];
    }

    // Vector de rebote elástico en colisión
    bounce() {
        this.speed = -this.speed * 0.35; 
    }

    draw(ctx) {
        // Renderizar las marcas/humo por debajo de los coches
        this.particles.forEach(p => p.draw(ctx));

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Chasis Deportivo Principal
        ctx.fillStyle = "#e74c3c"; 
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        // Cabina de Cristal / Parabrisas
        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(-this.width / 3, -this.height / 5, (this.width / 3) * 2, this.height / 4);

        // Alerón trasero de competición
        ctx.fillStyle = "#111111";
        ctx.fillRect(-this.width / 2 - 3, this.height / 2 - 6, this.width + 6, 6);

        // Ópticas de iluminación delanteras
        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(-this.width / 2 + 3, -this.height / 2, 6, 3);
        ctx.fillRect(this.width / 2 - 9, -this.height / 2, 6, 3);

        ctx.restore();
    }
}
