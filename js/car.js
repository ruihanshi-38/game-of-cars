class Particle {
    constructor(x, y, angle, type = "smoke") {
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === "skid") {
            this.alpha = 0.5;
            this.size = 4;
        } else { 
            this.vx = -Math.sin(angle || 0) * 1 + (Math.random() - 0.5) * 0.8;
            this.vy = Math.cos(angle || 0) * 1 + (Math.random() - 0.5) * 0.8;
            this.alpha = 0.5;
            this.size = Math.random() * 2 + 2;
        }
    }

    update() {
        if (this.type === "smoke") {
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= 0.03;
            this.size += 0.08;
        } else {
            this.alpha -= 0.02; 
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        if (this.type === "skid") {
            ctx.fillStyle = "rgba(0, 0, 0, 0.12)";
            ctx.fillRect(this.x - 2, this.y - 2, this.size, this.size);
        } else {
            ctx.fillStyle = "rgba(200, 200, 200, 0.3)";
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

class Car {
    constructor(x, y, color = "#e74c3c", id = 1) {
        this.x = x;
        this.y = y;
        this.width = 26;
        this.height = 50;
        this.color = color;
        this.id = id; // Identificador para saber qué jugador es

        this.angle = 0;          
        this.travelAngle = 0;    
        this.speed = 0;
        this.vx = 0;             
        this.vy = 0;             
        
        this.acceleration = 0.28; 
        this.maxSpeed = 8.0; // Velocidad idéntica y competitiva para ambos
        this.friction = 0.07;     
        this.brakingForce = 0.5;  
        
        this.driftFactor = 0.85;  
        this.steerSpeed = 0.055;  
        
        this.particles = [];
        this.passedCheckpoint = false;
        this.currentLap = 1; // Cada coche gestiona su propia vuelta independiente
    }

    update(input, currentTrack) {
        if (!currentTrack) return; 

        // 1. Controles directos pasados desde el bucle
        if (input && input.forward) {
            this.speed += this.acceleration;
        } else if (input && input.backward) {
            if (this.speed > 0) this.speed -= this.brakingForce;
            else this.speed -= this.acceleration * 0.6;
        }

        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed * 0.4) this.speed = -this.maxSpeed * 0.4;

        // 2. Giro proporcional
        if (this.speed !== 0) {
            const factorGiro = Math.min(Math.abs(this.speed) / 2.0, 1.0); 
            const dir = this.speed > 0 ? 1 : -1;
            
            if (input && input.left) this.angle -= this.steerSpeed * factorGiro * dir;
            if (input && input.right) this.angle += this.steerSpeed * factorGiro * dir;
        }

        // 3. Vectores
        const forwardX = Math.sin(this.angle) * this.speed;
        const forwardY = -Math.cos(this.angle) * this.speed;

        this.vx = this.vx * this.driftFactor + forwardX * (1 - this.driftFactor);
        this.vy = this.vy * this.driftFactor + forwardY * (1 - this.driftFactor);

        this.x += this.vx;
        this.y += this.vy;

        // 4. Partículas
        this.travelAngle = Math.atan2(this.vx, -this.vy);
        let angleDiff = Math.abs(this.angle - this.travelAngle);
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

        const actualSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        if (Math.abs(angleDiff) > 0.45 && actualSpeed > 4) {
            const backX = this.x - Math.sin(this.angle) * (this.height / 3);
            const backY = this.y + Math.cos(this.angle) * (this.height / 3);
            
            this.particles.push(new Particle(backX, backY, this.angle, "skid"));
            if (Math.random() > 0.5) {
                this.particles.push(new Particle(backX, backY, this.angle, "smoke"));
            }
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
        this.speed = -this.speed * 0.2;
        this.vx = -this.vx * 0.2;
        this.vy = -this.vy * 0.2;
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2 + 3, this.width, this.height);

        ctx.fillStyle = this.color; 
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

        ctx.fillStyle = "#111111";
        ctx.fillRect(-this.width / 2 - 2, -this.height / 3, 2, 10); 
        ctx.fillRect(this.width / 2, -this.height / 3, 2, 10);  
        ctx.fillRect(-this.width / 2 - 2, this.height / 4, 2, 11);  
        ctx.fillRect(this.width / 2, this.height / 4, 2, 11);   

        ctx.fillStyle = "#1e272e";
        ctx.beginPath();
        ctx.moveTo(-this.width / 3, -this.height / 6);
        ctx.lineTo(this.width / 3, -this.height / 6);
        ctx.lineTo(this.width / 4, this.height / 4);
        ctx.lineTo(-this.width / 4, this.height / 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#575fcf";
        ctx.fillRect(-this.width / 4, -this.height / 7, (this.width / 4) * 2, 5);

        ctx.fillStyle = "#1e272e";
        ctx.fillRect(-this.width / 2 - 4, this.height / 2 - 5, this.width + 8, 5);
        ctx.fillStyle = "#000000";
        ctx.fillRect(-this.width / 4, this.height / 2 - 7, 2, 3);
        ctx.fillRect(this.width / 4 - 2, this.height / 2 - 7, 2, 3);

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(-this.width / 2 + 2, -this.height / 2, 5, 2);
        ctx.fillRect(this.width / 2 - 7, -this.height / 2, 5, 2);

        ctx.fillStyle = "#ff3f34";
        ctx.fillRect(-this.width / 2 + 3, this.height / 2 - 1, 4, 1);
        ctx.fillRect(this.width / 2 - 7, this.height / 2 - 1, 4, 1);

        ctx.restore();
    }
}
