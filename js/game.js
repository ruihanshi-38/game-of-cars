class Game {
    constructor() {
        // 1. Crear la escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); 

        // 2. Configurar el renderizador
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1'; 
        document.body.appendChild(this.renderer.domElement);

        // 3. Posicionar la cámara
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
        this.camera.position.set(0, 80, 80);

        // 4. Iluminación total
        const ambient = new THREE.AmbientLight(0xffffff, 0.85);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(40, 150, 40);
        this.scene.add(sun);

        this.input = new InputHandler();
        
        this.totalLaps = 3; 
        this.availableSkills = ["BOOST", "SWAP", "FREEZE", "WALL", "HOMING_MISSILE"];

        this.ignoreMetaWallTemporarily = false;
        this.globalMatchFrozen = false; 

        // Repositorios de elementos del circuito
        this.traps = [];
        this.invisibleTraps = []; 
        this.walls = [];
        this.surpriseBoxes = [];
        this.turboMats = [];
        this.ramps = [];
        this.explosiveMines = [];
        this.activeMissiles = []; 

        // Trazado del circuito original
        this.trackPoints = [
            new THREE.Vector3(0, 0, 120),       
            new THREE.Vector3(120, 0, 120),     
            new THREE.Vector3(180, 0, 60),      
            new THREE.Vector3(140, 0, -20),     
            new THREE.Vector3(160, 0, -50),     
            new THREE.Vector3(80, 0, -120),     
            new THREE.Vector3(-40, 0, -140),    
            new THREE.Vector3(-120, 0, -60),    
            new THREE.Vector3(-160, 0, 20),     
            new THREE.Vector3(-100, 0, 80),     
            new THREE.Vector3(-40, 0, 110)      
        ];
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);

        this.metaCenter = this.trackCurve.getPointAt(0); 
        const tangent = this.trackCurve.getTangentAt(0).normalize();
        this.metaAngle = Math.atan2(-tangent.z, tangent.x) + Math.PI / 2;

        // SOLUCIÓN AL ERROR: Inicializar posiciones previas para que no de 'undefined'
        this.previousCarPositions = [{ x: this.metaCenter.x, z: this.metaCenter.z }, { x: this.metaCenter.x, z: this.metaCenter.z }];

        // Construcción del mapa
        this.createTrack();
        this.spawnTrackHazards(); 
        this.createMetaStructure(); 
        this.initPlayers();
        this.buildCleanUI(); 
        
        this.setupAbilityListeners(); 

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    buildCleanUI() {
        // Enlazamos directamente con tu #ui-panel del HTML
        this.speedValEl = document.getElementById('speed-val');
        this.lapValEl = document.getElementById('lap-val');
    }

    createTrack() {
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 120, 22, 16, true);
        const trackMesh = new THREE.Mesh(trackGeo, new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
        trackMesh.scale.set(1, 0.005, 1); 
        this.scene.add(trackMesh);
    }

    spawnTrackHazards() {
        // Trampas de arena visibles
        const trapPositions = [{ x: 150, z: 20, radius: 9 }, { x: -80, z: -110, radius: 10 }];
        const trapGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);
        const trapMat = new THREE.MeshLambertMaterial({ color: '#d1ccc0' }); 
        trapPositions.forEach(pos => {
            const trapMesh = new THREE.Mesh(trapGeo, trapMat);
            trapMesh.position.set(pos.x, 0.05, pos.z);
            trapMesh.scale.set(pos.radius, 1, pos.radius); 
            this.scene.add(trapMesh);
            this.traps.push({ x: pos.x, z: pos.z, radius: pos.radius });
        });

        // Trampas Invisibles
        this.invisibleTraps = [
            { x: 40, z: 120, radius: 6, name: "Charco Fantasma" },
            { x: 100, z: -100, radius: 6, name: "Aceite Derramado" }
        ];

        // Muros estáticos
        const wallPositions = [{ x: 145, z: -25, w: 9, l: 3 }, { x: -40, z: -140, w: 3, l: 15 }];
        const wallMat = new THREE.MeshLambertMaterial({ color: '#7f8c8d' }); 
        wallPositions.forEach(pos => {
            const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(pos.w, 3, pos.l), wallMat);
            wallMesh.position.set(pos.x, 1.5, pos.z);
            this.scene.add(wallMesh);
            this.walls.push({ x: pos.x, z: pos.z, halfW: pos.w / 2, halfL: pos.l / 2, active: true });
        });

        // Cajas Sorpresa
        const boxPositions = [{ x: 110, z: 120 }, { x: -150, z: 20 }];
        const boxGeo = new THREE.BoxGeometry(2, 2, 2);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0xff3333 }); 
        boxPositions.forEach(pos => {
            const bMesh = new THREE.Mesh(boxGeo, boxMat); bMesh.position.set(pos.x, 1.5, pos.z);
            this.scene.add(bMesh);
            this.surpriseBoxes.push({ mesh: bMesh, x: pos.x, z: pos.z, triggered: false });
        });

        // Turbo Mats
        const turboPositions = [{ x: 25, z: 120 }, { x: 170, z: 25 }, { x: -30, z: -140 }];
        const turboGeo = new THREE.BoxGeometry(4, 0.08, 4);
        const turboMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); 
        turboPositions.forEach(pos => {
            const tMesh = new THREE.Mesh(turboGeo, turboMat); tMesh.position.set(pos.x, 0.06, pos.z);
            this.scene.add(tMesh);
            this.turboMats.push({ x: pos.x, z: pos.z });
        });

        // Rampas de Salto
        const rampPositions = [{ x: 60, z: 120, w: 6, h: 2, l: 8, rotY: Math.PI / 2 }, { x: -90, z: 80, w: 6, h: 2, l: 8, rotY: 0 }];
        rampPositions.forEach(pos => {
            const rampGroup = new THREE.Group();
            const rampGeo = new THREE.BoxGeometry(pos.w, pos.h, pos.l);
            const posAttr = rampGeo.attributes.position;
            for(let i=0; i<posAttr.count; i++) {
                if(posAttr.getZ(i) < 0) posAttr.setY(i, -pos.h/2);
            }
            rampGeo.computeVertexNormals();

            const rMesh = new THREE.Mesh(rampGeo, new THREE.MeshLambertMaterial({ color: '#e67e22' }));
            rampGroup.add(rMesh);
            rampGroup.position.set(pos.x, pos.h / 2, pos.z);
            rampGroup.rotation.y = pos.rotY;
            this.scene.add(rampGroup);
            this.ramps.push({ x: pos.x, z: pos.z, radius: 4.5 });
        });

        // Minas Explosivas
        const minePositions = [{ x: 160, z: 55 }, { x: -70, z: -120 }];
        const mineGeo = new THREE.SphereGeometry(0.7, 12, 12);
        const mineMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        minePositions.forEach(pos => {
            const mMesh = new THREE.Mesh(mineGeo, mineMat); mMesh.position.set(pos.x, 0.3, pos.z);
            this.scene.add(mMesh);
            this.explosiveMines.push({ mesh: mMesh, x: pos.x, z: pos.z, triggered: false });
        });
    }

    createMetaStructure() {
        this.metaGroupMaster = new THREE.Group();
        this.metaGroupMaster.position.copy(this.metaCenter);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(44, 0.05, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        this.metaGroupMaster.add(mesh);
        this.metaGroupMaster.rotation.y = this.metaAngle;
        this.scene.add(this.metaGroupMaster);
    }

    initPlayers() {
        const forwardVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle).normalize();
        const sideVector = new THREE.Vector3(-forwardVector.z, 0, forwardVector.x).normalize();
        const startLineCenter = this.metaCenter.clone().addScaledVector(forwardVector, -10);

        this.cars = [
            new Car(this.scene, startLineCenter.clone().addScaledVector(sideVector, -5.0).x, startLineCenter.clone().addScaledVector(sideVector, -5.0).z, 0xe74c3c, 1), 
            new Car(this.scene, startLineCenter.clone().addScaledVector(sideVector, 5.0).x, startLineCenter.clone().addScaledVector(sideVector, 5.0).z, 0x3498db, 2)   
        ];
        this.cars[0].angle = this.metaAngle + Math.PI;
        this.cars[1].angle = this.metaAngle + Math.PI;

        this.assignRandomSkills(this.cars[0]);
        this.assignRandomSkills(this.cars[1]);
    }

    assignRandomSkills(car) {
        let pool = [...this.availableSkills];
        car.skills = [
            pool.splice(Math.floor(Math.random() * pool.length), 1)[0], 
            pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
        ];
    }

    setupAbilityListeners() {
        window.addEventListener('keydown', (e) => {
            if (this.globalMatchFrozen || !this.cars || !this.cars[0]) return;
            const k = e.key.toLowerCase();
            
            if (k === 'k') this.triggerSkill(this.cars[0], 0);
            if (k === 'l') this.triggerSkill(this.cars[0], 1);

            if (k === 'v') this.triggerSkill(this.cars[1], 0);
            if (k === 'b') this.triggerSkill(this.cars[1], 1);
        });
    }

    triggerSkill(car, slotIndex) {
        let skill = car.skills[slotIndex]; if (!skill || skill === "USADO") return;
        
        if (skill === "BOOST") car.activateBoost();
        else if (skill === "SWAP") this.swapCarPositions();
        else if (skill === "FREEZE") this.cars[car.id === 1 ? 1 : 0].activateFreeze();
        else if (skill === "HOMING_MISSILE") this.fireHomingMissile(car);
        else if (skill === "WALL") {
            const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 2), new THREE.MeshLambertMaterial({ color: 0x95a5a6 }));
            wallMesh.position.set(car.x, 1.5, car.z + 4);
            this.scene.add(wallMesh);
            this.walls.push({ x: wallMesh.position.x, z: wallMesh.position.z, halfW: 3.5, halfL: 1.0, active: true });
        }

        car.skills[slotIndex] = "USADO";
    }

    fireHomingMissile(owner) {
        const target = owner.id === 1 ? this.cars[1] : this.cars[0];
        const misGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8).rotateX(Math.PI / 2);
        const misMesh = new THREE.Mesh(misGeo, new THREE.MeshBasicMaterial({ color: 0x9b59b6 }));
        misMesh.position.set(owner.x, 1.2, owner.z);
        this.scene.add(misMesh);
        this.activeMissiles.push({ mesh: misMesh, x: owner.x, z: owner.z, target: target, speed: 1.2 });
    }

    swapCarPositions() {
        const c1 = this.cars[0]; const c2 = this.cars[1];
        this.ignoreMetaWallTemporarily = true;
        const tx = c1.x; const tz = c1.z; const ta = c1.angle;
        c1.x = c2.x; c1.z = c2.z; c1.angle = c2.angle;
        c2.x = tx; c2.z = tz; c2.angle = ta;
        c1.speed = 0; c2.speed = 0; 
        setTimeout(() => { this.ignoreMetaWallTemporarily = false; }, 500); 
    }

    start() { this.loop(); }

    loop() {
        requestAnimationFrame(this.loop);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    update() {
        this.surpriseBoxes.forEach(b => { if (!b.triggered && b.mesh) b.mesh.rotation.y += 0.02; });

        if (this.cars && this.cars[0] && this.cars[1]) {
            this.cars[0].update(this.input.getPlayer1Input());
            this.cars[1].update(this.input.getPlayer2Input());
            
            this.updateHomingMissiles(); 
            this.processTrackCollisions();
            this.processCarCollisions();
            this.processHazardCollisions(); 
            this.processLapsAndMeta(); 
            this.cameraFollow();
            this.updateUI();

            // Guardar el rastro de posiciones de forma segura
            this.previousCarPositions[0] = { x: this.cars[0].x, z: this.cars[0].z };
            this.previousCarPositions[1] = { x: this.cars[1].x, z: this.cars[1].z };
        }
    }

    updateHomingMissiles() {
        for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
            const m = this.activeMissiles[i];
            const dx = m.target.x - m.x; const dz = m.target.z - m.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < 3.0) { 
                m.target.launchIntoAir(1.2); 
                this.scene.remove(m.mesh); this.activeMissiles.splice(i, 1); continue;
            }
            const dirX = dx / dist; const dirZ = dz / dist;
            m.x += dirX * m.speed; m.z += dirZ * m.speed;
            m.mesh.position.set(m.x, 1.2, m.z);
            m.mesh.rotation.y = Math.atan2(dirX, dirZ) + Math.PI;
        }
    }

    processTrackCollisions() {
        this.cars.forEach(car => {
            if (car.y > 0.5) return; 
            const carPos = new THREE.Vector3(car.x, 0, car.z);
            const closestPoint = this.getClosestPoint(carPos, this.trackCurve);
            if (carPos.distanceTo(closestPoint) > 21.5) {
                car.bounce();
                const returnDir = new THREE.Vector3().subVectors(closestPoint, carPos).normalize();
                car.x += returnDir.x * 0.4; car.z += returnDir.z * 0.4;
            }
        });
    }

    getClosestPoint(pos, curve) {
        const points = curve.getPoints(120); let closest = points[0]; let minDist = pos.distanceTo(closest);
        for (let i = 1; i < points.length; i++) {
            let d = pos.distanceTo(points[i]); if (d < minDist) { minDist = d; closest = points[i]; }
        }
        return closest;
    }

    processHazardCollisions() {
        this.cars.forEach(car => {
            const isFlying = car.y > 0.8;

            if (!isFlying) {
                this.ramps.forEach(ramp => {
                    if (Math.sqrt((car.x - ramp.x)**2 + (car.z - ramp.z)**2) < ramp.radius) { car.launchIntoAir(0.75); }
                });

                this.turboMats.forEach(mat => {
                    if (Math.sqrt((car.x - mat.x)**2 + (car.z - mat.z)**2) < 3.0) { car.turboTimer = Math.max(car.turboTimer, 60); }
                });

                this.explosiveMines.forEach(mine => {
                    if (!mine.triggered && Math.sqrt((car.x - mine.x)**2 + (car.z - mine.z)**2) < 2.5) {
                        mine.triggered = true; this.scene.remove(mine.mesh); car.launchIntoAir(1.3);
                    }
                });
            }

            let inSlowZone = false;
            if (!isFlying) {
                this.traps.forEach(t => { if (Math.sqrt((car.x - t.x)**2 + (car.z - t.z)**2) < t.radius) inSlowZone = true; });
                this.invisibleTraps.forEach(t => { if (Math.sqrt((car.x - t.x)**2 + (car.z - t.z)**2) < t.radius) inSlowZone = true; });
            }
            car.maxSpeed = inSlowZone ? car.baseMaxSpeed * 0.35 : car.baseMaxSpeed;

            for (let wall of this.walls) {
                if (car.x > wall.x - wall.halfW - 1.0 && car.x < wall.x + wall.halfW + 1.0 &&
                    car.z > wall.z - wall.halfL - 1.5 && car.z < wall.z + wall.halfL + 1.5) {
                    car.bounce();
                }
            }
        });
    }

    processCarCollisions() {
        const c1 = this.cars[0]; const c2 = this.cars[1]; if (!c1 || !c2) return;
        const dist = Math.sqrt((c2.x - c1.x)**2 + (c2.z - c1.z)**2);
        if (dist < 2.2) {
            c1.bounce(); c2.bounce();
        }
    }

    processLapsAndMeta() {
        const planeNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle);
        this.cars.forEach((car, index) => {
            if (car.z < -20) car.passedCheckpoint = true;
            
            // Verificación segura de que las posiciones previas existan
            const oldPos = this.previousCarPositions[index] || { x: car.x, z: car.z };
            const oldDist = new THREE.Vector3(oldPos.x, 0, oldPos.z).sub(this.metaCenter).dot(planeNormal);
            const currentDist = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).dot(planeNormal);

            if (oldDist <= 0 && currentDist > 0 && car.passedCheckpoint) {
                car.passedCheckpoint = false;
                if (car.currentLap < this.totalLaps) car.currentLap++;
                else { alert(`¡VICTORIA! El Jugador ${car.id} ha ganado la carrera.`); this.initPlayers(); }
            }
        });
    }

    cameraFollow() {
        const midX = (this.cars[0].x + this.cars[1].x) / 2; const midZ = (this.cars[0].z + this.cars[1].z) / 2;
        this.camera.position.set(midX, 70, midZ + 75);
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        if (!this.speedValEl || !this.lapValEl) return;
        
        let v1 = Math.round(this.cars[0].speed * 300);
        let v2 = Math.round(this.cars[1].speed * 300);
        
        this.speedValEl.innerHTML = `J1: ${v1} | J2: ${v2}`;
        this.lapValEl.innerHTML = `J1: ${this.cars[0].currentLap}/${this.totalLaps} [${this.cars[0].skills[0]}, ${this.cars[0].skills[1]}] | J2: ${this.cars[1].currentLap}/${this.totalLaps} [${this.cars[1].skills[0]}, ${this.cars[1].skills[1]}]`;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('load', () => {
    setTimeout(() => {
        const game = new Game(); game.start();
    }, 100);
});
