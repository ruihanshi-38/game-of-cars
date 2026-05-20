class Car {
    constructor(scene, x, z, color = 0xe74c3c, id = 1) {
        this.id = id;
        this.color = color;

        // Propiedades de movimiento en el plano XZ
        this.x = x;
        this.z = z;
        this.angle = 0;
        this.speed = 0;
        this.vx = 0;
        this.vz = 0;

        // Configuración física arcade refinada
        this.acceleration = 0.12;
        this.maxSpeed = 3.2;
        this.friction = 0.04;
        this.brakingForce = 0.25;
        this.driftFactor = 0.88; // Agarre lateral equilibrado
        this.steerSpeed = 0.045;

        this.currentLap = 1;
        this.passedCheckpoint = false;

        // --- CONSTRUCCIÓN DEL MODELO 3D ---
        this.mesh = new THREE.Group();

        // Chasis principal (Cuerpo del coche)
        const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = 0.4;
        this.mesh.add(body);

        // Cabina/Cristal
        const cabinGeo = new THREE.BoxGeometry(1.2, 0.5, 1.4);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0x1e272e });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.8, -0.2);
        this.mesh.add(cabin);

        // Alerón de carreras trasero deportivo
        const wingGeo = new THREE.BoxGeometry(2.0, 0.1, 0.5);
        const wingMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const wing = new THREE.Mesh(wingGeo, wingMat);
        wing.position.set(0, 0.9, 1.4);
        this.mesh.add(wing);

        // Soportes del alerón
        const supGeo = new THREE.BoxGeometry(0.1, 0.4, 0.1);
        const supL = new THREE.Mesh(supGeo, wingMat);
        supL.position.set(-0.6, 0.7, 1.4);
        const supR = supL.clone();
        supR.position.x = 0.6;
        this.mesh.add(supL, supR);

        // Ruedas (4 cilindros en 3D colocados en las esquinas inferiores)
        const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 12);
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        // Girar cilindros para que rueden de lado
        wheelGeo.rotateZ(Math.PI / 2);

        this.wheels = [];
        const positions = [
            [-0.9, 0.35, -1.0], // Delantera Izq
            [0.9, 0.35, -1.0],  // Delantera Der
            [-0.9, 0.35, 1.0],  // Trasera Izq
            [0.9, 0.35, 1.0]    // Trasera Der
        ];

        positions.forEach(pos => {
            const w = new THREE.Mesh(wheelGeo, wheelMat);
            w.position.set(pos[0], pos[1], pos[2]);
            this.mesh.add(w);
            this.wheels.push(w);
        });

        // Añadir el coche completo al mundo 3D
        this.mesh.position.set(this.x, 0, this.z);
        scene.add(this.mesh);
    }

    update(input) {
        // 1. Aceleración y Freno
        if (input && input.forward) {
            this.speed += this.acceleration;
        } else if (input && input.backward) {
            if (this.speed > 0) this.speed -= this.brakingForce;
            else this.speed -= this.acceleration * 0.6;
        }

        // Fricción pasiva
        if (this.speed > 0) this.speed -= this.friction;
        if (this.speed < 0) this.speed += this.friction;
        if (Math.abs(this.speed) < this.friction) this.speed = 0;

        // Límites de velocidad
        if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;
        if (this.speed < -this.maxSpeed * 0.4) this.speed = -this.maxSpeed * 0.4;

        // 2. Dirección de giro proporcional a la velocidad
        if (this.speed !== 0) {
            const factorGiro = Math.min(Math.abs(this.speed) / 1.5, 1.0);
            const dir = this.speed > 0 ? 1 : -1;
            if (input && input.left) this.angle += this.steerSpeed * factorGiro * dir;
            if (input && input.right) this.angle -= this.steerSpeed * factorGiro * dir;
        }

        // 3. Descomposición de vectores en el plano 3D (X, Z)
        // En Three.js el frente del coche apunta hacia -Z por defecto, así que invertimos senos y cosenos
        const forwardX = -Math.sin(this.angle) * this.speed;
        const forwardZ = -Math.cos(this.angle) * this.speed;

        this.vx = this.vx * this.driftFactor + forwardX * (1 - this.driftFactor);
        this.vz = this.vz * this.driftFactor + forwardZ * (1 - this.driftFactor);

        this.x += this.vx;
        this.z += this.vz;

        // Sincronizar coordenadas con la malla gráfica de Three.js
        this.mesh.position.x = this.x;
        this.mesh.position.z = this.z;
        this.mesh.rotation.y = this.angle;

        // Animación simple de rotación de ruedas al avanzar
        this.wheels.forEach(w => {
            w.rotation.x -= this.speed * 0.15;
        });
    }

    bounce() {
        this.speed = -this.speed * 0.3;
        this.vx = -this.vx * 0.3;
        this.vz = -this.vz * 0.3;
    }
}
