class Particle {
    constructor(x, y, angle, type = "smoke") {
        this.x = x;
        this.y = y;
        this.type = type;
        
        if (type === "skid") {
            this.alpha = 0.5;
            this.size = 4;
        } else { // Humo
            this.vx = -Math.sin(angle) * 1 + (Math.random() - 0.5) * 0.8;
            this.vy = Math.cos(angle) * 1 + (Math.random() - 0.5) * 0.8;
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
            this.alpha -= 0.02; // Las marcas duran un poco menos para limpiar el circuito
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
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
    constructor(x, y, isAI = false, color = "#e74c3c") {
        this.x = x;
        this.y = y;
        this.width = 26;
        this.height = 50;
        this.isAI = isAI;
        this.color = color;

        this.angle = 0;          
        this.travelAngle = 0;    
        this.speed = 0;
        this.vx = 0;             
        this.vy = 0;             
        
        // --- CONFIGURACIÓN ARCADE: CONTROL TOTAL Y RESPUESTA INMEDIATA ---
        this.acceleration = 0.28; // Aceleración inicial ligeramente más ágil
        this.maxSpeed = isAI ? 5.5 + Math.random() * 0.7 : 8.0; // Un pelín más lento para reaccionar a tiempo
        this.friction = 0.07;     // Más fricción del suelo para no patinar infinitamente
        this.brakingForce = 0.5;  // Freno más reactivo
        
        // El secreto de la manejabilidad:
        this.driftFactor = 0.85;  // BAJADO de 0.92 a 0.85. El coche obedece la dirección del morro casi al instante (Mucho más GRIP).
        this.steerSpeed = 0.055;  // SUBIDO de 0.045 a 0.055. El volante responde más rápido al pulsar izquierda/derecha.
        
        this.particles = [];
        this.passedCheckpoint = false;
        this.currentWaypointIndex = 0;
    }

    update(input, currentTrack) {
        // 1. Entrada de aceleración/freno
        if (!this.isAI) {
            if (input.forward) {
                this.speed += this.acceleration;
            } else if (input.backward) {
                if (this.speed > 0) this.speed -= this.brakingForce;
                else this.speed -= this.acceleration * 0.6;
            }
        } else {
            this.speed += this.acceleration * 0.85;
            this.handleAI(currentTrack);
        }

        // Fricciones lógicas para detener el coche de forma intuitiva
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed * 0.4) this.speed = -this.maxSpeed * 0.4;

        // 2. Control del giro proporcional a la velocidad
        // Ajustamos la curva de giro para que no pierdas el control a máxima velocidad
        if (this.speed !== 0 && (!this.isAI)) {
            // Permite girar bien incluso yendo despacio, pero estabiliza el coche a altas velocidades
            const factorGiro = Math.min(Math.abs(this.speed) / 2.0, 1.0); 
            const dir = this.speed > 0 ? 1 : -1;
            
            if (input.left) this.angle -= this.steerSpeed * factorGiro * dir;
            if (input.right) this.angle += this.steerSpeed * factorGiro * dir;
        }

        // 3. Unión vectorial del movimiento (Física con agarre mejorado)
        const forwardX = Math.sin(this.angle) * this.speed;
        const forwardY = -Math.cos(this.angle) * this.speed;

        // Al cambiar el driftFactor, la velocidad lateral (inercia) se alinea rapidísimo con las ruedas
        this.vx = this.vx * this.driftFactor + forwardX * (1 - this.driftFactor);
        this.vy = this.vy * this.driftFactor + forwardY * (1 - this.driftFactor);

        this.x += this.vx;
        this.y += this.vy;

        // 4. Activación de derrapes solo en giros verdaderamente extremos
        this.travelAngle = Math.atan2(this.vx, -this.vy);
        let angleDiff = Math.abs(this.angle - this.travelAngle);
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

        const actualSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        // Ahora necesitas forzar más el coche (ángulo > 0.45) para que derrape, haciendo la conducción limpia por defecto
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

    handleAI(currentTrack) {
        const waypoints = currentTrack.waypoints;
        const target = waypoints[this.currentWaypointIndex];

        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 50) {
            this.currentWaypointIndex = (this.currentWaypointIndex + 1) % waypoints.length;
        }

        const targetAngle = Math.atan2(dx, -dy);
        let angleDiff = targetAngle - this.angle;
        angleDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));

        const factorGiroIA = Math.min(Math.abs(this.speed) / 2.5, 1.0);
        if (Math.abs(angleDiff) > 0.02) {
            this.angle += Math.sign(angleDiff) * this.steerSpeed * 0.85 * factorGiroIA;
        }
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
        // Un rebote más limpio que te devuelve el control de la dirección de inmediato
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
