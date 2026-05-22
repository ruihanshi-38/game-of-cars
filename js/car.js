class Car {
    constructor(scene, x, z, color = 0xe74c3c, id = 1) {
        this.id = id;
        this.color = color;
        this.scene = scene;

        this.x = x;
        this.y = 0; 
        this.z = z;
        this.angle = 0;
        this.speed = 0;

        this.turboTimer = 0;
        this.freezeTimer = 0;

        this.baseMaxSpeed = 0.65;    
        this.maxSpeed = this.baseMaxSpeed;
        this.acceleration = 0.045;
        this.friction = 0.025;
        this.turnSpeed = 0.16; 

        this.currentLap = 1;
        this.skills = [];

        // --- MODELO F1 RECOLECTADO ---
        this.mesh = new THREE.Group();
        this.bodyMat = new THREE.MeshLambertMaterial({ color: color });

        const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 3.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
        chassis.position.y = 0.1;
        this.mesh.add(chassis);

        const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.0, 16), this.bodyMat);
        nose.rotateX(Math.PI / 2);
        nose.position.set(0, 0.3, -1.0);
        this.mesh.add(nose);

        const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), new THREE.MeshLambertMaterial({ color: 0x050505 }));
        cabin.position.set(0, 0.5, 0.2);
        this.mesh.add(cabin);

        const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1c1c1c });
        const wGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12).rotateZ(Math.PI / 2);
        
        const positions = [[-0.95, 0.4, -1.1], [0.95, 0.4, -1.1], [-1.05, 0.4, 1.1], [1.05, 0.4, 1.1]];
        positions.forEach(pos => {
            const tire = new THREE.Mesh(wGeo, wheelMat);
            tire.position.set(pos[0], pos[1], pos[2]);
            this.mesh.add(tire);
        });

        this.mesh.position.set(this.x, this.y, this.z);
        scene.add(this.mesh);
    }

    update(input) {
        if (this.turboTimer > 0) this.turboTimer--;
        if (this.freezeTimer > 0) {
            this.freezeTimer--;
            this.speed = 0;
            return;
        }

        let currentMax = this.maxSpeed;
        if (this.turboTimer > 0) currentMax = this.baseMaxSpeed * 1.6;

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

        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.rotation.y = this.angle;
    }

    bounce() {
        this.speed = -this.speed * 0.4;
        this.x += Math.sin(this.angle) * this.speed * 3;
        this.z += Math.cos(this.angle) * this.speed * 3;
    }

    activateBoost() {
        this.turboTimer = 120;
        this.bodyMat.color.setHex(0xf1c40f);
        setTimeout(() => this.bodyMat.color.setHex(this.color), 2000);
    }

    activateFreeze() {
        this.freezeTimer = 100;
        this.bodyMat.color.setHex(0x34e7e4);
        setTimeout(() => this.bodyMat.color.setHex(this.color), 2000);
    }
}
