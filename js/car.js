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

        // --- AJUSTES DE MOVIMIENTO EN PERSPECTIVA DE PANTALLA ---
        this.maxSpeed = 0.6;    
        this.baseMaxSpeed = this.maxSpeed;
        this.acceleration = 0.04;
        this.friction = 0.02;
        this.turnSpeed = 0.15; // Velocidad de rotación fluida hacia el objetivo

        this.currentLap = 1;
        this.passedCheckpoint = false;
        
        // Habilidades
        this.skills = []; 
        this.frozenBySkill = false;
        
        // Habilidad: Inmunidad
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
            this.mesh.position.set(this.x, 0, this.z);
            return;
        }

        // Determinar vectores de dirección basados estrictamente en la pantalla (X y Z globales)
        let moveX = 0;
        let moveZ = 0;

        if (input) {
            if (input.forward)  moveZ -= 1; // Hacia arriba en la pantalla (-Z)
            if (input.backward) moveZ += 1; // Hacia abajo en la pantalla (+Z)
            if (input.left)     moveX -= 1; // Hacia la izquierda (-X)
            if (input.right)    moveX += 1; // Hacia la derecha (+X)
        }

        // Si hay alguna tecla pulsada
        if (moveX !== 0 || moveZ !== 0) {
            // Calcular el ángulo objetivo al que debe mirar el coche
            const targetAngle = Math.atan2(moveX, moveZ) + Math.PI;

            // Suavizar la rotación del coche hacia esa dirección
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * this.turnSpeed;

            // Incrementar velocidad de traslación
            this.speed += this.acceleration;
            if (this.speed > this.maxSpeed) this.speed = this.maxSpeed;

            // Mover el coche directamente en la dirección del joystick/teclas (normalizado)
            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            this.x += (moveX / length) * this.speed;
            this.z += (moveZ / length) * this.speed;
        } else {
            // Aplicar fricción si no se pulsa nada
            this.speed -= this.friction;
            if (this.speed < 0) this.speed = 0;

            // Avanzar inercialmente en la última dirección del ángulo actual
            if (this.speed > 0) {
                this.x -= Math.sin(this.angle) * this.speed;
                this.z -= Math.cos(this.angle) * this.speed;
            }
        }

        this.mesh.position.set(this.x, 0, this.z);
        this.mesh.rotation.y = this.angle;
    }

    bounce() {
        // Rebotar invirtiendo la inercia instantánea
        this.speed = -this.speed * 0.4;
        this.x += Math.sin(this.angle) * this.speed * 2;
        this.z += Math.cos(this.angle) * this.speed * 2;
    }

    activateBoost() {
        this.maxSpeed = this.baseMaxSpeed * 2.0; 
        this.speed = this.maxSpeed;
        this.bodyMat.color.setHex(0xf1c40f); 

        setTimeout(() => {
            this.maxSpeed = this.baseMaxSpeed;
            if (!this.isImmune) this.bodyMat.color.setHex(this.color); 
        }, 5000);
    }

    activateFreeze() {
        if (this.isImmune) return;

        this.frozenBySkill = true;
        this.bodyMat.color.setHex(0x34e7e4); 

        setTimeout(() => {
            this.frozenBySkill = false;
            if (!this.isImmune) this.bodyMat.color.setHex(this.color);
        }, 3000);
    }

    activateImmunity() {
        this.isImmune = true;
        
        let visible = false;
        this.blinkInterval = setInterval(() => {
            visible = !visible;
            this.bodyMat.color.setHex(visible ? 0xffffff : this.color);
        }, 150); 

        setTimeout(() => {
            clearInterval(this.blinkInterval);
            this.isImmune = false;
            this.bodyMat.color.setHex(this.color); 
        }, 5000);
    }
}
