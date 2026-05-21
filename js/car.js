class Car {
    constructor(scene, x, z, color = 0xe74c3c, id = 1) {
        this.id = id;
        this.color = color;
        this.scene = scene;

        // Posición y vectores
        this.x = x;
        this.z = z;
        this.angle = 0;
        this.speed = 0;
        this.vx = 0;
        this.vz = 0;

        // --- VELOCIDAD Y CONTROL ---
        this.baseMaxSpeed = 0.6;    
        this.maxSpeed = this.baseMaxSpeed;
        this.acceleration = 0.025;
        this.friction = 0.02;
        this.brakingForce = 0.10;
        this.driftFactor = 0.75;   
        this.steerSpeed = 0.038;   

        this.currentLap = 1;
        this.passedCheckpoint = false;
        
        // Sistema de habilidades limitadas
        this.skills = []; 
        this.frozenBySkill = false;
        
        // --- NUEVA HABILIDAD: INMUNIDAD ---
        this.isImmune = false;
        this.blinkInterval = null;

        // --- MODELADO DEL COCHE EN 3D ---
        this.mesh = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2);
        this.bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, this.bodyMat);
        body.position.y = 0.4;
        this.mesh.add(body);

        const cabinGeo = new THREE.BoxGeometry(1.1, 0.5, 1.3);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.8, -0.1);
        this.mesh.add(cabin);

        const wingGeo = new THREE.BoxGeometry(2.0, 0.1, 0.5);
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(0, 0.9, 1.3);
        this.mesh.add(wing);

        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        wheelGeo.rotateZ(Math.PI / 2);

        const wheelPositions = [
            [-0.9, 0.35, -1.0], [0.9, 0.35, -1.0],
            [-0.9, 0.35, 1.0], [0.9, 0.35, 1.0]
        ];

        wheelPositions.forEach(pos => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.position.set(pos[0], pos[1], pos[2]);
            this.mesh.add(w);
        });

        this.mesh.position.set(this.x, 0, this.z);
        scene.add(this.mesh);
    }

    update(input) {
        if (this.frozenBySkill) {
            this.speed = 0;
            this.vx = 0;
            this.vz = 0;
            this.mesh.position.set(this.x, 0, this.z);
            return;
        }

        if (input && input.forward) {
            this.speed += this.acceleration;
        } else if (input && input.backward) {
            this.speed -= this.brakingForce;
        } else {
            if (this.speed > 0) this.speed -= this.friction;
            if (this.speed < 0) this.speed += this.friction;
            if (Math.abs(this.speed) < this.friction) this.speed = 0;
        }

        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed * 0.4) this.speed = -this.maxSpeed * 0.4;

        if (this.speed !== 0) {
            const dir = this.speed > 0 ? 1 : -1;
            if (input && input.left) this.angle += this.steerSpeed * dir;
            if (input && input.right) this.angle -= this.steerSpeed * dir;
        }

        const forwardX = -Math.sin(this.angle) * this.speed;
        const forwardZ = -Math.cos(this.angle) * this.speed;

        this.vx = this.vx * this.driftFactor + forwardX * (1 - this.driftFactor);
        this.vz = this.vz * this.driftFactor + forwardZ * (1 - this.driftFactor);

        this.x += this.vx;
        this.z += this.vz;

        this.mesh.position.set(this.x, 0, this.z);
        this.mesh.rotation.y = this.angle;
    }

    bounce() {
        this.speed = -this.speed * 0.3;
        this.vx = -this.vx * 0.3;
        this.vz = -this.vz * 0.3;
    }

    activateBoost() {
        this.maxSpeed = this.baseMaxSpeed * 2.0; 
        this.speed = this.maxSpeed;
        this.bodyMat.color.setHex(0xf1c40f); // Dorado/Amarillo

        setTimeout(() => {
            this.maxSpeed = this.baseMaxSpeed;
            if (!this.isImmune) this.bodyMat.color.setHex(this.color); 
        }, 5000);
    }

    activateFreeze() {
        // Si el coche es inmune, ignora por completo el ataque de congelación
        if (this.isImmune) return;

        this.frozenBySkill = true;
        this.bodyMat.color.setHex(0x34e7e4); // Color hielo azulado

        setTimeout(() => {
            this.frozenBySkill = false;
            if (!this.isImmune) this.bodyMat.color.setHex(this.color);
        }, 3000);
    }

    activateImmunity() {
        this.isImmune = true;
        
        // Efecto visual: Parpadeo brillante de inmunidad
        let visible = false;
        this.blinkInterval = setInterval(() => {
            visible = !visible;
            this.bodyMat.color.setHex(visible ? 0xffffff : this.color);
        }, 1500);

        setTimeout(() => {
            clearInterval(this.blinkInterval);
            this.isImmune = false;
            this.bodyMat.color.setHex(this.color); // Restaurar color original
        }, 5000);
    }
}
