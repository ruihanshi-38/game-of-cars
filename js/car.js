class Particle {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = -Math.sin(angle) * 2 + (Math.random() - 0.5) * 1.2;
        this.vy = Math.cos(angle) * 2 + (Math.random() - 0.5) * 1.2;
        this.alpha = 1.0;
        this.size = Math.random() * 4 + 4;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= 0.025;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = "rgba(236, 240, 241, 0.5)";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Car {
    constructor(x, y, isAI = false, color = "#e74c3c") {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 54;
        this.isAI = isAI;
        this.color = color;

        this.speed = 0;
        this.angle = 0;
        
        this.acceleration = 0.22;
        this.maxSpeed = isAI ? 5.5 + Math.random() * 1.2 : 8.5; // Ajuste competitivo
        this.friction = 0.06;
        
        this.particles = [];
        this.passedCheckpoint = false; 

        // Variables exclusivas de la IA inteligente
        this.currentWaypointIndex = 0;
    }

    update(input, currentTrack) {
        let isTurning = false;

        if (!this.isAI) {
            // --- CONTROL DEL JUGADOR ---
            if (input.forward) this.speed += this.acceleration;
            if (input.backward) this.speed -= this.acceleration;

            if (this.speed !== 0) {
                const directionMultiplier = this.speed > 0 ? 1 : -1;
                const turnRatio = 0.042 * (Math.abs(this.speed) / this.maxSpeed + 0.35);
                if (input.left) { this.angle -= turnRatio * directionMultiplier; isTurning = true; }
                if (input.right) { this.angle += turnRatio * directionMultiplier; isTurning = true; }
            }
        } else {
            // --- NUEVO CEREBRO DE IA POR WAYPOINTS ---
            this.speed += this.acceleration * 0.85;

            const waypoints = currentTrack.waypoints;
            const target = waypoints[this.currentWaypointIndex];

            // Calcular distancia al objetivo actual
            const dx = target.x - this.x;
            const dy = target.y - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // Si está lo suficientemente cerca del punto, pasa al siguiente
            if (distance < 50) {
                this.currentWaypointIndex = (this.currentWaypointIndex + 1) % waypoints.length;
            }

            // Calcular el ángulo matemático hacia el punto de ruta
            const targetAngle = Math.atan2(dx, -dy);
            let angleDiff = targetAngle - this.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

            // Velocidad de giro adaptable
            const aiTurnSpeed = 0.045;
            if (Math.abs(angleDiff) > 0.02) {
                this.angle += Math.sign(angleDiff) * aiTurnSpeed;
                isTurning = true;
            }
        }

        // Límites de velocidad globales
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        // Fricciones
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        // Movimiento vectorial
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;

        // Humo de neumáticos
        if (isTurning && Math.abs(this.speed) > this.maxSpeed * 0.45) {
            const backX = this.x - Math.sin(this.angle) * (this.height / 2);
            const backY = this.y + Math.cos(this.angle) * (this.height / 2);
            this.particles.push(new Particle(backX, backY, this.angle));
        }

        this.particles.forEach(p => p.update());
        this.particles = this.particles.filter(p => p.alpha > 0);
    }

    getBounds() {
        return [
            { x: this.x - this.width / 2, y: this.y - this.height / 2 },
            { x: this.x + this.width / 2, y: this.y - this.height / 2 },
            { x: this.x - this.width / 2, y: this.y + this.height / 2 },
            { x: this.x + this.width / 2, y: this.y + this.height / 2 }
        ];
    }

    bounce() {
        this.speed = -this.speed * 0.4; 
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = this.color; 
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        ctx.fillStyle = "#2c3e50";
        ctx.fillRect(-this.width / 3, -this.height / 5, (this.width / 3) * 2, this.height / 4);

        ctx.fillStyle = "#111111";
        ctx.fillRect(-this.width / 2 - 3, this.height / 2 - 6, this.width + 6, 6);

        ctx.fillStyle = "#f1c40f";
        ctx.fillRect(-this.width / 2 + 3, -this.height / 2, 6, 3);
        ctx.fillRect(this.width / 2 - 9, -this.height / 2, 6, 3);

        ctx.restore();
    }
}
