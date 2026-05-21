class Car {
    constructor(scene, x, z, color = 0xe74c3c, id = 1) {
        this.id = id;
        this.color = color;
        this.scene = scene;

        // Posición tridimensional y físicas
        this.x = x;
        this.y = 0; 
        this.z = z;
        this.angle = 0;
        this.speed = 0;
        this.verticalVelocity = 0;
        this.isGrounded = true;

        // Temporizadores de estados
        this.turboTimer = 0;
        this.explosionTimer = 0;

        // Ajustes de movimiento (Perspectiva de Pantalla)
        this.baseMaxSpeed = 0.65;    
        this.maxSpeed = this.baseMaxSpeed;
        this.acceleration = 0.045;
        this.friction = 0.025;
        this.turnSpeed = 0.16; 

        this.currentLap = 1;
        this.passedCheckpoint = false;
        
        // Habilidades e Inmunidad
        this.skills = []; 
        this.frozenBySkill = false;
        this.isImmune = false;
        this.blinkInterval = null;

        // --- MODELADO DETALLADO ESTILO FÓRMULA 1 ---
        this.mesh = new THREE.Group();

        // Fondo plano / Chasis base
        const chassisGeo = new THREE.BoxGeometry(1.6, 0.2, 3.4);
        const chassisMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.y = 0.1;
        this.mesh.add(chassis);

        // Carrocería principal (Nariz estilizada)
        this.bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const noseGeo = new THREE.ConeGeometry(0.5, 2.0, 16);
        noseGeo.rotateX(Math.PI / 2);
        const nose = new THREE.Mesh(noseGeo, this.bodyMat);
        nose.position.set(0, 0.3, -1.0);
        nose.scale.set(1, 0.6, 1);
        this.mesh.add(nose);

        // Pontones laterales aerodinámicos
        const podGeo = new THREE.BoxGeometry(0.3, 0.5, 1.4);
        const leftPod = new THREE.Mesh(podGeo, this.bodyMat);
        leftPod.position.set(-0.7, 0.35, 0.4);
        const rightPod = new THREE.Mesh(podGeo, this.bodyMat);
        rightPod.position.set(0.7, 0.35, 0.4);
        this.mesh.add(leftPod, rightPod);

        // Cockpit con protección Halo
        const cabinGeo = new THREE.SphereGeometry(0.45, 16, 16);
        const cabinMat = new THREE.MeshLambertMaterial({ color: 0x050505 });
        const cabin = new THREE.Mesh(cabinGeo, cabinMat);
        cabin.position.set(0, 0.5, 0.2);
        cabin.scale.set(1, 0.8, 1.4);
        this.mesh.add(cabin);

        const haloGeo = new THREE.TorusGeometry(0.3, 0.06, 8, 24, Math.PI);
        const halo = new THREE.Mesh(haloGeo, chassisMat);
        halo.position.set(0, 0.6, -0.1);
        halo.rotation.x = -Math.PI / 6;
        this.mesh.add(halo);

        // Alerón Delantero
        const frontWingGeo = new THREE.BoxGeometry(2.2, 0.08, 0.4);
        const frontWing = new THREE.Mesh(frontWingGeo, chassisMat);
        frontWing.position.set(0, 0.15, -1.9);
        this.mesh.add(frontWing);

        // Alerón Trasero con soportes
        const rearWingMainGeo = new THREE.BoxGeometry(2.0, 0.25, 0.5);
        const rearWing = new THREE.Mesh(rearWingMainGeo, this.bodyMat);
        rearWing.position.set(0, 0.9, 1.6);
        this.mesh.add(rearWing);

        const supportGeo = new THREE.BoxGeometry(0.1, 0.6, 0.3);
        const supL = new THREE.Mesh(supportGeo, chassisMat); supL.position.set(-0.4, 0.6, 1.5);
        const supR = new THREE.Mesh(supportGeo, chassisMat); supR.position.set(0.4, 0.6, 1.5);
        this.mesh.add(supL, supR);

        // Neumáticos anchos y llantas metalizadas
        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xdcdde1, roughness: 0.3, metalness: 0.8 });
        
        const frontWheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.45, 24);
        const rearWheelGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.60, 24); 
        frontWheelGeo.rotateZ(Math.PI / 2);
        rearWheelGeo.rotateZ(Math.PI / 2);

        const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.05, 12);
        rimGeo.rotateZ(Math.PI / 2);

        const wheelConfigs = [
            { geo: frontWheelGeo, pos: [-0.95, 0.38, -1.1] },
            { geo: frontWheelGeo, pos: [0.95, 0.38, -1.1] },
            { geo: rearWheelGeo, pos: [-1.05, 0.44, 1.1] },
            { geo: rearWheelGeo, pos: [1.05, 0.44, 1.1] }
        ];

        wheelConfigs.forEach(wConf => {
            const wGroup = new THREE.Group();
            const tire = new THREE.Mesh(wConf.geo, wheelMat);
            const rimOut = new THREE.Mesh(rimGeo, rimMat);
            rimOut.position.x = wConf.pos[0] > 0 ? 0.21 : -0.21;
            
            wGroup.add(tire, rimOut);
            wGroup.position.set(wConf.pos[0], wConf.pos[1], wConf.pos[2]);
            this.mesh.add(wGroup);
        });

        // Tubo de escape cromado
        const exhaustGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8);
        exhaustGeo.rotateX(Math.PI / 2);
        const exhaust = new THREE.Mesh(exhaustGeo, rimMat);
        exhaust.position.set(0, 0.25, 1.7);
        this.mesh.add(exhaust);

        this.mesh.position.set(this.x, this.y, this.z);
        scene.add(this.mesh);
    }

    update(input) {
        if (this.turboTimer > 0) this.turboTimer--;
        if (this.explosionTimer > 0) {
            this.explosionTimer--;
            this.speed = 0;
            this.applyGravity();
            this.mesh.position.set(this.x, this.y, this.z);
            return;
        }

        if (this.frozenBySkill) {
            this.speed = 0;
            this.applyGravity();
            this.mesh.position.set(this.x, this.y, this.z);
            return;
        }

        let currentMax = this.baseMaxSpeed;
        if (this.turboTimer > 0) {
            currentMax = this.baseMaxSpeed * 1.6; 
        } else if (this.maxSpeed < this.baseMaxSpeed) {
            currentMax = this.maxSpeed; 
        }

        let moveX = 0;
        let moveZ = 0;

        if (input) {
            if (input.forward)  moveZ -= 1;
            if (input.backward) moveZ += 1;
            if (input.left)     moveX -= 1;
            if (input.right)    moveX += 1;
        }

        if (moveX !== 0 || moveZ !== 0) {
            const targetAngle = Math.atan2(moveX, moveZ) + Math.PI;
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * this.turnSpeed;

            this.speed += this.acceleration;
            if (this.speed > currentMax) this.speed = currentMax;

            const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
            this.x += (moveX / length) * this.speed;
            this.z += (moveZ / length) * this.speed;
        } else {
            this.speed -= this.friction;
            if (this.speed < 0) this.speed = 0;

            if (this.speed > 0) {
                this.x -= Math.sin(this.angle) * this.speed;
                this.z -= Math.cos(this.angle) * this.speed;
            }
        }

        this.applyGravity();

        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.rotation.y = this.angle;

        if (!this.isGrounded) {
            this.mesh.rotation.x = -this.verticalVelocity * 0.4;
        } else {
            this.mesh.rotation.x = 0;
        }
    }

    applyGravity() {
        if (!this.isGrounded) {
            this.verticalVelocity -= 0.022; 
            this.y += this.verticalVelocity;
            
            if (this.y <= 0) {
                this.y = 0;
                this.verticalVelocity = 0;
                this.isGrounded = true;
            }
        }
    }

    launchIntoAir(force) {
        this.verticalVelocity = force;
        this.isGrounded = false;
    }

    bounce() {
        this.speed = -this.speed * 0.4;
        this.x += Math.sin(this.angle) * this.speed * 2.5;
        this.z += Math.cos(this.angle) * this.speed * 2.5;
    }

    activateBoost() {
        this.turboTimer = 180; 
        this.bodyMat.color.setHex(0xf1c40f); 
        setTimeout(() => {
            if (!this.isImmune) this.bodyMat.color.setHex(this.color); 
        }, 3000);
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
