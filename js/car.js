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
        this.maxSpeed = isAI ? 6.2 + Math.random() * 1.0 : 8.5; 
        this.friction = 0.06;
        
        this.particles = [];
        
        // Control de paso por meta del jugador
        this.passedCheckpoint = false; 
    }

    // Pasamos el 'currentTrack' en el update para que la IA se adapte al circuito activo
    update(input, currentTrack) {
        let isTurning = false;

        if (!this.isAI) {
            if (input.forward) this.speed += this.acceleration;
            if (input.backward) this.speed -= this.acceleration;

            if (this.speed !== 0) {
                const directionMultiplier = this.speed > 0 ? 1 : -1;
                const turnRatio = 0.042 * (Math.abs(this.speed) / this.maxSpeed + 0.35);
                if (input.left) { this.angle -= turnRatio * directionMultiplier; isTurning = true; }
                if (input.right) { this.angle += turnRatio * directionMultiplier; isTurning = true; }
            }
        } else {
            this.speed += this.acceleration * 0.82;

            // La IA calcula su trayectoria basándose en el centro de la isla interior del circuito actual
            const centerX = currentTrack.inner.x + currentTrack.inner.width / 2;
            const centerY = currentTrack.inner.y + currentTrack.inner.height / 2;
            const vectorX = this.x - centerX;
            const vectorY = this.y - centerY;
            
            const targetAngle = Math.atan2(-vectorX, vectorY);
            let angleDiff = targetAngle - this.angle;
            angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

            const aiTurnSpeed = 0.038;
            if (Math.abs(angleDiff) > 0.02) {
                this.angle += Math.sign(angleDiff) * aiTurnSpeed;
                isTurning = true;
            }
        }

        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed / 2) this.speed = -this.maxSpeed / 2;

        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;

        if (isTurning && Math.abs(this.speed) > this.maxSpeed * 0.5) {
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
        this.speed = -this.speed * 0.35; 
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
