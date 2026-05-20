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

        // Velocidad ultra lenta base
        this.baseMaxSpeed = 0.8;    
        this.maxSpeed = this.baseMaxSpeed;
        this.acceleration = 0.03;
        this.friction = 0.02;
        this.brakingForce = 0.12;
        this.driftFactor = 0.80;   
        this.steerSpeed = 0.04;   

        this.currentLap = 1;
        this.passedCheckpoint = false;
        
        // --- NUEVO SISTEMA DE HABILIDADES LIMITADAS ---
        this.skills = []; // Guardará los nombres de las 2 habilidades aleatorias
        this.frozenBySkill = false;
        this.hasPassableWallActive = false;
        this.myWallMesh = null;

        // --- MODELADO DEL COCHE EN 3D ---
        this.mesh = new THREE.Group();

        const bodyGeo = new THREE.BoxGeometry(1.6, 0.6, 3.2);
        const bodyMat = new THREE.MeshLambertMaterial({ color: color });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
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

    // --- EJECUCIÓN DE HABILIDADES PROPIAS ---
    
    activateBoost() {
        this.maxSpeed = this.baseMaxSpeed * 2.2; 
        this.speed = this.maxSpeed;
        this.mesh.children[0].material.color.setHex(0xf1c40f); // Tinte dorado turbo

        setTimeout(() => {
            this.maxSpeed = this.baseMaxSpeed;
            this.mesh.children[0].material.color.setHex(this.color); 
        }, 5000);
    }

    activateFreeze() {
        this.frozenBySkill = true;
        this.mesh.children[0].material.color.setHex(0x34e7e4); // Tinte azul cian congelado

        setTimeout(() => {
            this.frozenBySkill = false;
            this.mesh.children[0].material.color.setHex(this.color);
        }, 3000);
    }

    spawnSpecialWall() {
        const wallGeo = new THREE.BoxGeometry(6, 3, 0.5);
        const wallMat = new THREE.MeshLambertMaterial({ 
            color: this.color, 
            transparent: true, 
            opacity: 0.6 
        });
        
        this.myWallMesh = new THREE.Mesh(wallGeo, wallMat);
        this.myWallMesh.position.set(this.x, 1.5, this.z);
        this.myWallMesh.rotation.y = this.angle; 
        this.scene.add(this.myWallMesh);
        this.hasPassableWallActive = true;

        setTimeout(() => {
            this.scene.remove(this.myWallMesh);
            this.myWallMesh = null;
            this.hasPassableWallActive = false;
        }, 15000);
    }
}
