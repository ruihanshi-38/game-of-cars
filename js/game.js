class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); 

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
        this.camera.position.set(0, 80, 80);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(40, 150, 40);
        this.scene.add(sun);

        this.input = new InputHandler();
        
        this.totalLaps = 5; 
        this.availableSkills = ["BOOST", "SWAP", "FREEZE", "IMMUNE"];

        this.ignoreMetaWallTemporarily = false;

        // Listas de peligros en el mapa
        this.traps = [];
        this.walls = [];

        // --- TRAZADO FÓRMULA 1 (Monza/Spa ampliado) ---
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

        this.previousCarPositions = [{ x: 0, z: 0 }, { x: 0, z: 0 }];

        this.createTrack();
        this.spawnTrackHazards(); // <-- Inyección de trampas y muros estáticos
        this.createDynamicMetaAndLights(); 
        this.initPlayers();
        this.buildCustomUI(); 
        this.startCountdown();    
        this.setupAbilityListeners(); 

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    buildCustomUI() {
        this.uiContainer = document.createElement('div');
        this.uiContainer.style.position = 'absolute';
        this.uiContainer.style.top = '70px'; 
        this.uiContainer.style.left = '50%';
        this.uiContainer.style.transform = 'translateX(-50%)';
        this.uiContainer.style.fontFamily = 'monospace, sans-serif';
        this.uiContainer.style.fontSize = '14px';
        this.uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        this.uiContainer.style.color = '#fff';
        this.uiContainer.style.padding = '12px 20px';
        this.uiContainer.style.borderRadius = '8px';
        this.uiContainer.style.border = '1px solid #555';
        this.uiContainer.style.textAlign = 'center';
        this.uiContainer.style.zIndex = '9999';
        this.uiContainer.style.minWidth = '500px';
        this.uiContainer.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        document.body.appendChild(this.uiContainer);
    }

    createTrack() {
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 120, 22, 16, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); 
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.scale.set(1, 0.005, 1); 
        this.scene.add(trackMesh);
    }

    spawnTrackHazards() {
        // --- CONFIGURACIÓN DE TRAMPAS DE ARENA (Ralentizan) ---
        // Las colocamos en puntos clave del trazado (coordenadas x, z y su radio de acción)
        const trapPositions = [
            { x: 150, z: 20, radius: 8 },   // Mitad de la primera curva abierta
            { x: 150, z: -35, radius: 7 },  // En plena chicane técnica
            { x: -80, z: -110, radius: 9 }, // Entrada a la horquilla cerrada
            { x: -140, z: 50, radius: 8 }   // Zona de las eses rápidas
        ];

        const trapGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);
        const trapMat = new THREE.MeshLambertMaterial({ color: '#d1ccc0' }); // Color arena de escape

        trapPositions.forEach(pos => {
            const trapMesh = new THREE.Mesh(trapGeo, trapMat);
            trapMesh.position.set(pos.x, 0.05, pos.z);
            trapMesh.scale.set(pos.radius, 1, pos.radius); // Escalado dinámico según el radio
            this.scene.add(trapMesh);
            
            this.traps.push({ x: pos.x, z: pos.z, radius: pos.radius });
        });

        // --- CONFIGURACIÓN DE MUROS DE HORMIGÓN (Bloqueos) ---
        // Estructuras cuadradas elevadas en medio de la carretera
        const wallPositions = [
            { x: 60, z: 125, w: 3, l: 12 },    // Obstáculo en la gran recta principal
            { x: 145, z: -25, w: 10, l: 3 },   // Bloqueo interior de la chicane
            { x: -40, z: -140, w: 3, l: 14 },  // Muro divisor en el ápice de la horquilla fuerte
            { x: -110, z: 75, w: 12, l: 3 }    // Muro a sortear antes de encarar la meta
        ];

        const wallMat = new THREE.MeshLambertMaterial({ color: '#7f8c8d' }); // Gris hormigón

        wallPositions.forEach(pos => {
            const wallGeo = new THREE.BoxGeometry(pos.w, 3, pos.l);
            const wallMesh = new THREE.Mesh(wallGeo, wallMat);
            wallMesh.position.set(pos.x, 1.5, pos.z);
            this.scene.add(wallMesh);

            this.walls.push({
                x: pos.x,
                z: pos.z,
                halfW: pos.w / 2,
                halfL: pos.l / 2
            });
        });
    }

    createDynamicMetaAndLights() {
        this.metaGroupMaster = new THREE.Group();
        this.metaGroupMaster.position.copy(this.metaCenter);

        const metaAncho = 44; 
        const metaLargo = 4;  
        const metaAlto = 0.05; 

        const rows = 24; 
        const cols = 2; 
        const squareWidth = metaAncho / rows;   
        const squareLength = metaLargo / cols; 

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = (r + c) % 2 === 0 ? 0xffffff : 0x1e272e;
                const mat = new THREE.MeshLambertMaterial({ color: color });
                const geo = new THREE.BoxGeometry(squareWidth, metaAlto, squareLength);
                const mesh = new THREE.Mesh(geo, mat);
                
                const posX = - (metaAncho / 2) + (r * squareWidth) + (squareWidth / 2);
                const posZ = - (metaLargo / 2) + (c * squareLength) + (squareLength / 2);
                
                mesh.position.set(posX, metaAlto / 2, posZ);
                this.metaGroupMaster.add(mesh);
            }
        }

        const postGeo = new THREE.CylinderGeometry(0.25, 0.25, 16);
        const structureMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        const postL = new THREE.Mesh(postGeo, structureMat); postL.position.set(-22, 8, 0);
        const postR = new THREE.Mesh(postGeo, structureMat); postR.position.set(22, 8, 0);
        
        const barGeo = new THREE.CylinderGeometry(0.15, 0.15, metaAncho);
        const bar = new THREE.Mesh(barGeo, structureMat); bar.rotation.z = Math.PI / 2; bar.position.set(0, 16, 0);

        this.metaGroupMaster.add(postL, postR, bar);

        const boxGeo = new THREE.BoxGeometry(4.5, 1.5, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const box = new THREE.Mesh(boxGeo, boxMat); box.position.set(0, 16, 0);
        this.metaGroupMaster.add(box);

        const lightGeo = new THREE.SphereGeometry(0.55, 16, 16);
        this.redMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
        this.greenMat = new THREE.MeshBasicMaterial({ color: 0x005500 });

        this.leftLight = new THREE.Mesh(lightGeo, this.redMat); this.leftLight.position.set(-1.0, 16, 0.55);
        this.rightLight = new THREE.Mesh(lightGeo, this.greenMat); this.rightLight.position.set(1.0, 16, 0.55);

        this.metaGroupMaster.add(this.leftLight, this.rightLight);

        this.metaGroupMaster.rotation.y = this.metaAngle;
        this.scene.add(this.metaGroupMaster);
    }

    startCountdown() {
        this.redMat.color.setHex(0xff0000); 
        this.greenMat.color.setHex(0x003300);
        this.globalMatchFrozen = true;

        setTimeout(() => {
            this.redMat.color.setHex(0x330000); 
            this.greenMat.color.setHex(0x00ff00); 
            this.globalMatchFrozen = false;

            setTimeout(() => { this.greenMat.color.setHex(0x005500); }, 2000);
        }, 3000);
    }

    initPlayers() {
        const forwardVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle).normalize();
        const sideVector = new THREE.Vector3(-forwardVector.z, 0, forwardVector.x).normalize();

        const startLineCenter = this.metaCenter.clone().addScaledVector(forwardVector, -10);

        const p1Pos = startLineCenter.clone().addScaledVector(sideVector, -5.0);
        const p2Pos = startLineCenter.clone().addScaledVector(sideVector, 5.0);

        this.cars = [
            new Car(this.scene, p1Pos.x, p1Pos.z, 0xe74c3c, 1), 
            new Car(this.scene, p2Pos.x, p2Pos.z, 0x3498db, 2)   
        ];

        this.cars.forEach(car => car.angle = this.metaAngle + Math.PI);

        this.previousCarPositions[0] = { x: this.cars[0].x, z: this.cars[0].z };
        this.previousCarPositions[1] = { x: this.cars[1].x, z: this.cars[1].z };

        this.assignRandomSkills(this.cars[0]);
        this.assignRandomSkills(this.cars[1]);
    }

    assignRandomSkills(car) {
        let pool = [...this.availableSkills];
        let idx1 = Math.floor(Math.random() * pool.length);
        let skill1 = pool.splice(idx1, 1)[0];
        let idx2 = Math.floor(Math.random() * pool.length);
        let skill2 = pool.splice(idx2, 1)[0];
        car.skills = [skill1, skill2];
    }

    setupAbilityListeners() {
        window.addEventListener('keydown', (e) => {
            if (this.globalMatchFrozen) return;

            if (this.cars[0] && !this.cars[0].frozenBySkill) {
                if (e.key === 'k' || e.key === 'K') this.triggerSkill(this.cars[0], 0);
                if (e.key === 'l' || e.key === 'L') this.triggerSkill(this.cars[0], 1);
            }

            if (this.cars[1] && !this.cars[1].frozenBySkill) {
                if (e.key === '1') this.triggerSkill(this.cars[1], 0);
                if (e.key === '2') this.triggerSkill(this.cars[1], 1);
            }
        });
    }

    triggerSkill(car, slotIndex) {
        let skill = car.skills[slotIndex];
        if (!skill || skill === "USADO") return;

        if (skill === "BOOST") {
            car.activateBoost();
        } else if (skill === "SWAP") {
            this.swapCarPositions();
        } else if (skill === "FREEZE") {
            let rival = car.id === 1 ? this.cars[1] : this.cars[0];
            rival.activateFreeze();
        } else if (skill === "IMMUNE") {
            car.activateImmunity();
        }

        car.skills[slotIndex] = "USADO";
    }

    swapCarPositions() {
        const c1 = this.cars[0]; const c2 = this.cars[1];
        if (!c1 || !c2) return;

        this.ignoreMetaWallTemporarily = true;

        const tempX = c1.x; const tempZ = c1.z; const tempAngle = c1.angle;
        c1.x = c2.x; c1.z = c2.z; c1.angle = c2.angle;
        c2.x = tempX; c2.z = tempZ; c2.angle = tempAngle;
        
        c1.speed = 0; c2.speed = 0; 

        setTimeout(() => {
            this.ignoreMetaWallTemporarily = false;
        }, 500); 
    }

    start() { this.loop(); }

    loop() {
        requestAnimationFrame(this.loop);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    update() {
        const p1 = this.input.getPlayer1Input();
        const p2 = this.input.getPlayer2Input();

        if (this.globalMatchFrozen) {
            if (this.cars[0]) this.cars[0].update(null);
            if (this.cars[1]) this.cars[1].update(null);
        } else {
            if (this.cars[0]) this.cars[0].update(p1);
            if (this.cars[1]) this.cars[1].update(p2);
        }

        this.processTrackCollisions();
        this.processCarCollisions();
        this.processHazardCollisions(); // <-- Comprobador de trampas de arena y muros
        this.processLapsAndMetaWalls(); 
        this.cameraFollow();
        this.updateUI();

        if (this.cars[0]) this.previousCarPositions[0] = { x: this.cars[0].x, z: this.cars[0].z };
        if (this.cars[1]) this.previousCarPositions[1] = { x: this.cars[1].x, z: this.cars[1].z };
    }

    processTrackCollisions() {
        this.cars.forEach(car => {
            const carPos = new THREE.Vector3(car.x, 0, car.z);
            const closestPoint = this.getClosestPoint(carPos, this.trackCurve);
            const dist = carPos.distanceTo(closestPoint);

            if (dist > 21.5) {
                car.bounce();
                const returnDir = new THREE.Vector3().subVectors(closestPoint, carPos).normalize();
                car.x += returnDir.x * 0.4;
                car.z += returnDir.z * 0.4;
            }
        });
    }

    processHazardCollisions() {
        this.cars.forEach(car => {
            // --- 1. PROCESAR TRAMPAS DE ARENA (RALENTIZACIÓN) ---
            let inSand = false;
            
            // Si el coche es inmune, se salta por completo el chequeo de arena
            if (!car.isImmune) {
                for (let trap of this.traps) {
                    const dx = car.x - trap.x;
                    const dz = car.z - trap.z;
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist < trap.radius) {
                        inSand = true;
                        break;
                    }
                }
            }

            // Aplicar castigo de velocidad en arena si corresponde
            if (inSand) {
                car.maxSpeed = car.baseMaxSpeed * 0.35; // Frenazo importante
            } else if (car.maxSpeed < car.baseMaxSpeed * 1.5) { 
                // Restaura velocidad base (siempre que no esté bajo los efectos del BOOST)
                car.maxSpeed = car.baseMaxSpeed;
            }

            // --- 2. PROCESAR MUROS SÓLIDOS (COLISIONES AABB) ---
            if (!car.isImmune) { // ¡Si eres inmune, atraviesas los muros limpiamente!
                for (let wall of this.walls) {
                    if (car.x > wall.x - wall.halfW - 1.0 && car.x < wall.x + wall.halfW + 1.0 &&
                        car.z > wall.z - wall.halfL - 1.5 && car.z < wall.z + wall.halfL + 1.5) {
                        
                        car.bounce();
                        // Expulsión simple del coche fuera del cuadro de colisión del muro
                        const dirX = car.x > wall.x ? 1 : -1;
                        const dirZ = car.z > wall.z ? 1 : -1;
                        car.x += dirX * 0.5;
                        car.z += dirZ * 0.5;
                    }
                }
            }
        });
    }

    getClosestPoint(pos, curve) {
        const points = curve.getPoints(150); 
        let closest = points[0]; let minDist = pos.distanceTo(closest);
        for (let i = 1; i < points.length; i++) {
            let d = pos.distanceTo(points[i]);
            if (d < minDist) { minDist = d; closest = points[i]; }
        }
        return closest;
    }

    processCarCollisions() {
        const c1 = this.cars[0]; const c2 = this.cars[1];
        if (!c1 || !c2) return;

        if (c1.isImmune || c2.isImmune) return;

        const dx = c2.x - c1.x; const dz = c2.z - c1.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = 2.2;

        if (dist < minDist) {
            c1.bounce(); c2.bounce();
            const push = (minDist - dist) * 0.5;
            c1.x -= (dx / (dist || 1)) * push; c1.z -= (dz / (dist || 1)) * push;
            c2.x += (dx / (dist || 1)) * push; c2.z += (dz / (dist || 1)) * push;
        }
    }

    processLapsAndMetaWalls() {
        const planeNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle);

        this.cars.forEach((car, index) => {
            const oldPos = this.previousCarPositions[index];
            if (car.z < -40) car.passedCheckpoint = true;

            const oldDist = new THREE.Vector3(oldPos.x, 0, oldPos.z).sub(this.metaCenter).dot(planeNormal);
            const currentDist = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).dot(planeNormal);

            const localPos = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.metaAngle);

            if (Math.abs(localPos.x) < 23) {
                if (oldDist <= 0 && currentDist > 0) {
                    if (car.passedCheckpoint) {
                        car.passedCheckpoint = false;
                        if (car.currentLap < this.totalLaps) {
                            car.currentLap++;
                        } else {
                            alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} gana.`);
                            this.initPlayers();
                            this.startCountdown();
                        }
                    }
                }
                
                if (oldDist >= 0 && currentDist < 0) {
                    if (!this.ignoreMetaWallTemporarily) {
                        car.bounce();
                        const correctSide = this.metaCenter.clone().addScaledVector(planeNormal, 0.5);
                        car.x = correctSide.x;
                        car.z = correctSide.z;
                    }
                }
            }
        });
    }

    cameraFollow() {
        if (!this.cars[0] || !this.cars[1]) return;
        
        const midX = (this.cars[0].x + this.cars[1].x) / 2;
        const midZ = (this.cars[0].z + this.cars[1].z) / 2;

        const distX = Math.abs(this.cars[0].x - this.cars[1].x);
        const distZ = Math.abs(this.cars[0].z - this.cars[1].z);
        const maxDist = Math.max(distX, distZ);

        const targetHeight = Math.max(55, 45 + (maxDist * 1.0));

        this.camera.position.x += (midX - this.camera.position.x) * 0.05;
        this.camera.position.y += (targetHeight - this.camera.position.y) * 0.05;
        this.camera.position.z += ((midZ + targetHeight * 0.9) - this.camera.position.z) * 0.05;
        
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        if (!this.uiContainer || !this.cars[0] || !this.cars[1]) return;

        const sk1_a = this.cars[0].skills[0] || "NINGUNA";
        const sk1_b = this.cars[0].skills[1] || "NINGUNA";
        const sk2_a = this.cars[1].skills[0] || "NINGUNA";
        const sk2_b = this.cars[1].skills[1] || "NINGUNA";

        this.uiContainer.innerHTML = `
            <div style="margin-bottom: 5px;">
                <span style="color:#e74c3c; font-weight:bold;">J1 (Rojo) Vueltas: ${this.cars[0].currentLap}/${this.totalLaps}</span> 
                | Poderes [K, L]: <span style="color:#f1c40f;">${sk1_a}</span>, <span style="color:#f1c40f;">${sk1_b}</span>
            </div>
            <div>
                <span style="color:#3498db; font-weight:bold;">J2 (Azul) Vueltas: ${this.cars[1].currentLap}/${this.totalLaps}</span> 
                | Poderes [1, 2]: <span style="color:#f1c40f;">${sk2_a}</span>, <span style="color:#f1c40f;">${sk2_b}</span>
            </div>
        `;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('load', () => {
    const comprobarLibrerias = setInterval(() => {
        if (typeof THREE !== 'undefined' && typeof InputHandler !== 'undefined') {
            clearInterval(comprobarLibrerias);
            try {
                const game = new Game();
                game.start();
            } catch (e) {
                console.error("Fallo de arranque:", e);
            }
        }
    }, 100);
});
