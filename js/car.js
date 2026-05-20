class Car {
    constructor(scene, x, z, color = 0xe74c3c, id = 1) {
        this.id = id;
        this.color = color;

        // Posición y vectores en el plano horizontal (X, Z)
        this.x = x;
        this.z = z;
        this.angle = 0;
        this.speed = 0;
        this.vx = 0;
        this.vz = 0;

        // --- VELOCIDAD REDUCIDA PARA MAYOR CONTROL ---
        this.acceleration = 0.06;  // Antes 0.15 (Aceleración más suave)
        this.maxSpeed = 1.6;      // Antes 3.5 (Velocidad máxima reducida a la mitad)
        this.friction = 0.03;
        this.brakingForce = 0.15;
        this.driftFactor = 0.82;   // Más agarre para no deslizarse sin control
        this.steerSpeed = 0.045;   // Giro cómodo adaptado a la nueva velocidad

        this.currentLap = 1;
        this.passedCheckpoint = false;
        this.frozen = true; // Empiezan bloqueados por el semáforo

        // --- MODELADO DEL COCHE EN 3D ---
        this.mesh = new THREE.Group();

        // Carrocería principal
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.4;
        this.mesh.add(body);

        // Cabina
        const cabinGeo = new THREE.BoxGeometry(1.1, 0.5, 1.3);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.8, -0.1);
        this.mesh.add(cabin);

        // Alerón trasero
        const wingGeo = new THREE.BoxGeometry(2.0, 0.1, 0.5);
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(0, 0.9, 1.3);
        this.mesh.add(wing);

        // Ruedas (4 cilindros)
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        wheelGeo.rotateZ(Math.PI / 2);

        const wheelPositions = [
            [-0.9, 0.35, -1.0], // Delantera Izquierda
            [0.9, 0.35, -1.0],  // Delantera Derecha
            [-0.9, 0.35, 1.0],  // Trasera Izquierda
            [0.9, 0.35, 1.0]    // Trasera Derecha
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
        // Si el semáforo está en rojo, las teclas no hacen nada
        if (this.frozen) {
            this.speed = 0;
            this.vx = 0;
            this.vz = 0;
            this.mesh.position.set(this.x, 0, this.z);
            return;
        }

        // 1. Aceleración y freno
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

        // 2. Giro
        if (this.speed !== 0) {
            const dir = this.speed > 0 ? 1 : -1;
            if (input && input.left) this.angle += this.steerSpeed * dir;
            if (input && input.right) this.angle -= this.steerSpeed * dir;
        }

        // 3. Vectores
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
}
