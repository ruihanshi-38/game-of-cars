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
        this.availableSkills = ["BOOST", "SWAP", "FREEZE", "IMMUNE", "HOMING_MISSILE"];

        this.ignoreMetaWallTemporarily = false;
        this.globalMatchFrozen = true; 

        // Repositorios de elementos del mapa
        this.traps = [];
        this.invisibleTraps = []; 
        this.walls = [];
        this.surpriseBoxes = [];
        this.turboMats = [];
        this.ramps = [];
        this.explosiveMines = [];
        this.activeMissiles = []; // Control de proyectiles teledirigidos en vuelo

        this.p1Alert = "";
        this.p2Alert = "";

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
        this.spawnTrackHazards(); 
        this.createDynamicMetaAndLights(); 
        this.initPlayers();
        this.buildCustomUI(); 
        
        this.showControlsOverlay(); 

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    showControlsOverlay() {
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100%'; overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.95)';
        overlay.style.display = 'flex'; overlay.style.flexDirection = 'column';
        overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';
        overlay.style.zIndex = '100000'; overlay.style.fontFamily = 'monospace, sans-serif';
        overlay.style.color = '#fff';

        overlay.innerHTML = `
            <h1 style="color: #f1c40f; margin-bottom: 20px; font-size: 34px; text-shadow: 0 0 10px rgba(241,196,15,0.6);">MANUAL DE COMBATE Y CONTROLES</h1>
            <h4 style="color: #3498db; margin-bottom: 25px;">MODO PANTALLA ARCADE (Los coches giran hacia donde pulsas en la pantalla)</h4>
            
            <div style="display: flex; gap: 40px; background: rgba(255,255,255,0.04); padding: 25px; border-radius: 12px; border: 1px solid #444; max-width: 850px;">
                <div style="text-align: center; flex: 1;">
                    <h2 style="color: #e74c3c; border-bottom: 2px solid #e74c3c; padding-bottom: 5px; margin-top:0;">JUGADOR 1 (Rojo)</h2>
                    <p style="margin: 12px 0; font-size:15px;"><b>Dirección:</b> Flechas del Teclado</p>
                    <p style="margin: 5px 0;"><b>Habilidad 1:</b> Tecla K</p>
                    <p style="margin: 5px 0;"><b>Habilidad 2:</b> Tecla L</p>
                </div>
                
                <div style="border-left: 1px solid #555;"></div>

                <div style="text-align: center; flex: 1;">
                    <h2 style="color: #3498db; border-bottom: 2px solid #3498db; padding-bottom: 5px; margin-top:0;">JUGADOR 2 (Azul)</h2>
                    <p style="margin: 12px 0; font-size:15px;"><b>Dirección:</b> Teclas W, A, S, D</p>
                    <p style="margin: 5px 0;"><b>Habilidad 1:</b> Tecla 1</p>
                    <p style="margin: 5px 0;"><b>Habilidad 2:</b> Tecla 2</p>
                </div>
            </div>

            <div style="margin-top: 25px; text-align: center; background: rgba(241,196,15,0.1); padding: 15px; border-radius: 8px; border: 1px dashed #f1c40f; max-width:600px;">
                <b style="color: #f1c40f;">ELEMENTOS AGREGADOS DE ALTA INTENSIDAD:</b><br>
                <span style="color:#00ffff;">⚡ Turbo Mats (Cian):</span> Modificadores de hipervelocidad instantánea.<br>
                <span style="color:#e67e22;">📐 Rampas Metálicas:</span> ¡Sal por los aires para saltar por encima de muros!<br>
                <span style="color:#e74c3c;">💥 Minas Rojas:</span> Detonan provocando un descontrol aéreo total.<br>
                <span style="color:#9b59b6;">🚀 Misil Teledirigido:</span> Persigue automáticamente al rival hasta impactar.
            </div>

            <h2 id="countdown-text" style="color: #2ecc71; margin-top: 30px; font-size: 26px;">Cargando simulador... 7s</h2>
        `;

        document.body.appendChild(overlay);

        let timeLeft = 7; // Duración exacta de la interfaz a petición
        const interval = setInterval(() => {
            timeLeft--;
            const countText = document.getElementById('countdown-text');
            if (countText) countText.innerText = `Preparando motores en ${timeLeft}...`;
            
            if (timeLeft <= 0) {
                clearInterval(interval);
                document.body.removeChild(overlay);
                this.startCountdown();
            }
        }, 1000);
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
        this.uiContainer.style.minWidth = '580px';
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
        // 1. Trampas de arena estándar
        const trapPositions = [
            { x: 150, z: 20, radius: 9 },   
            { x: -80, z: -110, radius: 10 }, 
            { x: -140, z: 50, radius: 9 }   
        ];
        const trapGeo = new THREE.CylinderGeometry(1, 1, 0.1, 16);
        const trapMat = new THREE.MeshLambertMaterial({ color: '#d1ccc0' }); 
        trapPositions.forEach(pos => {
            const trapMesh = new THREE.Mesh(trapGeo, trapMat);
            trapMesh.position.set(pos.x, 0.05, pos.z);
            trapMesh.scale.set(pos.radius, 1, pos.radius); 
            this.scene.add(trapMesh);
            this.traps.push({ x: pos.x, z: pos.z, radius: pos.radius });
        });

        // Trampas 100% invisibles en tramos limpios
        this.invisibleTraps = [
            { x: 40, z: 120, radius: 6, name: "Charco Fantasma" },
            { x: 100, z: -100, radius: 6, name: "Mancha de Aceite Cruda" }
        ];

        // 2. Muros estructurales fijos
        const wallPositions = [
            { x: 145, z: -25, w: 9, l: 3 },   
            { x: -40, z: -140, w: 3, l: 15 }
        ];
        const wallMat = new THREE.MeshLambertMaterial({ color: '#7f8c8d' }); 
        wallPositions.forEach(pos => {
            const wallGeo = new THREE.BoxGeometry(pos.w, 3, pos.l);
            const wallMesh = new THREE.Mesh(wallGeo, wallMat);
            wallMesh.position.set(pos.x, 1.5, pos.z);
            this.scene.add(wallMesh);
            this.walls.push({ mesh: wallMesh, x: pos.x, z: pos.z, halfW: pos.w / 2, halfL: pos.l / 2, active: true });
        });

        // 3. Cajas Sorpresa sorpresa clásicas
        const boxPositions = [{ x: 110, z: 120 }, { x: -150, z: 20 }];
        const boxGeo = new THREE.BoxGeometry(2, 2, 2);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0xff3333 }); 
        boxPositions.forEach(pos => {
            const bMesh = new THREE.Mesh(boxGeo, boxMat); bMesh.position.set(pos.x, 1.5, pos.z);
            this.scene.add(bMesh);
            this.surpriseBoxes.push({ mesh: bMesh, x: pos.x, z: pos.z, triggered: false });
        });

        // --- NUEVO: TURBO MATS (Cian brillante) ---
        const turboPositions = [{ x: 25, z: 120 }, { x: 170, z: 25 }, { x: -30, z: -140 }, { x: -120, z: 60 }];
        const turboGeo = new THREE.BoxGeometry(4, 0.08, 4);
        const turboMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); // Color de energía cian
        turboPositions.forEach(pos => {
            const tMesh = new THREE.Mesh(turboGeo, turboMat);
            tMesh.position.set(pos.x, 0.06, pos.z);
            this.scene.add(tMesh);
            this.turboMats.push({ x: pos.x, z: pos.z });
        });

        // --- NUEVO: RAMPAS DE SALTO TRIDIMENSIONALES ---
        const rampPositions = [
            { x: 60, z: 120, w: 6, h: 2, l: 8, rotY: Math.PI / 2 }, 
            { x: -90, z: 80, w: 6, h: 2, l: 8, rotY: 0 }
        ];
        rampPositions.forEach(pos => {
            const rampGroup = new THREE.Group();
            const rampGeo = new THREE.BoxGeometry(pos.w, pos.h, pos.l);
            // Deformar cubo para hacerlo una cuña inclinada
            const posAttr = rampGeo.attributes.position;
            for(let i=0; i<posAttr.count; i++) {
                if(posAttr.getZ(i) < 0) { // Parte delantera de la cuña al nivel del suelo
                    posAttr.setY(i, -pos.h/2);
                }
            }
            rampGeo.computeVertexNormals();

            const rMesh = new THREE.Mesh(rampGeo, new THREE.MeshLambertMaterial({ color: '#e67e22' }));
            rampGroup.add(rMesh);
            rampGroup.position.set(pos.x, pos.h / 2, pos.z);
            rampGroup.rotation.y = pos.rotY;
            this.scene.add(rampGroup);

            this.ramps.push({ x: pos.x, z: pos.z, radius: 4.5 });
        });

        // --- NUEVO: MINAS EXPLOSIVAS ACTIVAS (Esferas parpadeantes) ---
        const minePositions = [{ x: 160, z: 55 }, { x: 130, z: -35 }, { x: -70, z: -120 }, { x: -140, z: 10 }];
        const mineGeo = new THREE.SphereGeometry(0.7, 12, 12);
        const mineMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        minePositions.forEach(pos => {
            const mMesh = new THREE.Mesh(mineGeo, mineMat);
            mMesh.position.set(pos.x, 0.3, pos.z);
            this.scene.add(mMesh);
            this.explosiveMines.push({ mesh: mMesh, x: pos.x, z: pos.z, triggered: false });
        });
    }

    createDynamicMetaAndLights() {
        this.metaGroupMaster = new THREE.Group();
        this.metaGroupMaster.position.copy(this.metaCenter);
        const metaAncho = 44; const metaLargo = 4; const metaAlto = 0.05; 
        const rows = 24; const cols = 2; const squareWidth = metaAncho / rows; const squareLength = metaLargo / cols; 

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = (r + c) % 2 === 0 ? 0xffffff : 0x1e272e;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(squareWidth, metaAlto, squareLength), new THREE.MeshLambertMaterial({ color: color }));
                mesh.position.set(- (metaAncho / 2) + (r * squareWidth) + (squareWidth / 2), metaAlto / 2, - (metaLargo / 2) + (c * squareLength) + (squareLength / 2));
                this.metaGroupMaster.add(mesh);
            }
        }
        const structureMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const postGeo = new THREE.CylinderGeometry(0.25, 0.25, 16);
        const postL = new THREE.Mesh(postGeo, structureMat); postL.position.set(-22, 8, 0);
        const postR = new THREE.Mesh(postGeo, structureMat); postR.position.set(22, 8, 0);
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, metaAncho), structureMat); bar.rotation.z = Math.PI / 2; bar.position.set(0, 16, 0);
        this.metaGroupMaster.add(postL, postR, bar);

        this.redMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
        this.greenMat = new THREE.MeshBasicMaterial({ color: 0x005500 });
        const lLight = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), this.redMat); lLight.position.set(-1.0, 16, 0.55);
        const rLight = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), this.greenMat); rLight.position.set(1.0, 16, 0.55);
        this.metaGroupMaster.add(lLight, rLight);

        this.metaGroupMaster.rotation.y = this.metaAngle;
        this.scene.add(this.metaGroupMaster);
    }

    startCountdown() {
        this.redMat.color.setHex(0xff0000); this.greenMat.color.setHex(0x003300);
        this.globalMatchFrozen = true;
        setTimeout(() => {
            this.redMat.color.setHex(0x330000); this.greenMat.color.setHex(0x00ff00); 
            this.globalMatchFrozen = false;
            setTimeout(() => { this.greenMat.color.setHex(0x005500); }, 2000);
        }, 3000);
    }

    initPlayers() {
        const forwardVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle).normalize();
        const sideVector = new THREE.Vector3(-forwardVector.z, 0, forwardVector.x).normalize();
        const startLineCenter = this.metaCenter.clone().addScaledVector(forwardVector, -10);

        this.cars = [
            new Car(this.scene, startLineCenter.clone().addScaledVector(sideVector, -5.0).x, startLineCenter.clone().addScaledVector(sideVector, -5.0).z, 0xe74c3c, 1), 
            new Car(this.scene, startLineCenter.clone().addScaledVector(sideVector, 5.0).x, startLineCenter.clone().addScaledVector(sideVector, 5.0).z, 0x3498db, 2)   
        ];
        this.cars.forEach(car => car.angle = this.metaAngle + Math.PI);

        this.assignRandomSkills(this.cars[0]);
        this.assignRandomSkills(this.cars[1]);
    }

    assignRandomSkills(car) {
        let pool = [...this.availableSkills];
        car.skills = [pool.splice(Math.floor(Math.random() * pool.length), 1)[0], pool.splice(Math.floor(Math.random() * pool.length), 1)[0]];
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
        let skill = car.skills[slotIndex]; if (!skill || skill === "USADO") return;
        
        if (skill === "BOOST") car.activateBoost();
        else if (skill === "SWAP") this.swapCarPositions();
        else if (skill === "FREEZE") this.cars[car.id === 1 ? 1 : 0].activateFreeze();
        else if (skill === "IMMUNE") car.activateImmunity();
        else if (skill === "HOMING_MISSILE") this.fireHomingMissile(car);

        car.skills[slotIndex] = "USADO";
    }

    fireHomingMissile(owner) {
        const target = owner.id === 1 ? this.cars[1] : this.cars[0];
        
        // Crear objeto visual del misil (Cilindro magenta/morado flotante)
        const misGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
        misGeo.rotateX(Math.PI / 2);
        const misMat = new THREE.MeshBasicMaterial({ color: 0x9b59b6 });
        const misMesh = new THREE.Mesh(misGeo, misMat);
        misMesh.position.set(owner.x, 1.5, owner.z);
        this.scene.add(misMesh);

        this.activeMissiles.push({
            mesh: misMesh,
            x: owner.x,
            z: owner.z,
            target: target,
            speed: 1.1 // El misil vuela más rápido que los coches base
        });
    }

    swapCarPositions() {
        const c1 = this.cars[0]; const c2 = this.cars[1]; if (!c1 || !c2) return;
        this.ignoreMetaWallTemporarily = true;
        const tempX = c1.x; const tempZ = c1.z; const tempAngle = c1.angle;
        c1.x = c2.x; c1.z = c2.z; c1.angle = c2.angle;
        c2.x = tempX; c2.z = tempZ; c2.angle = tempAngle;
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
        // Rotación y parpadeo estético de trampas fijas
        this.surpriseBoxes.forEach(b => { if (!b.triggered && b.mesh) b.mesh.rotation.y += 0.02; });
        this.explosiveMines.forEach(m => { if (!m.triggered && m.mesh) m.mesh.scale.setScalar(1 + Math.sin(Date.now() * 0.01)*0.15); });

        if (this.globalMatchFrozen) {
            if (this.cars[0]) this.cars[0].update(null);
            if (this.cars[1]) this.cars[1].update(null);
        } else {
            if (this.cars[0]) this.cars[0].update(this.input.getPlayer1Input());
            if (this.cars[1]) this.cars[1].update(this.input.getPlayer2Input());
        }

        this.updateHomingMissiles(); // <-- NUEVO: Cálculo vectorial de persecución de misiles
        this.processTrackCollisions();
        this.processCarCollisions();
        this.processHazardCollisions(); 
        this.processLapsAndMetaWalls(); 
        this.cameraFollow();
        this.updateUI();

        if (this.cars[0]) this.previousCarPositions[0] = { x: this.cars[0].x, z: this.cars[0].z };
        if (this.cars[1]) this.previousCarPositions[1] = { x: this.cars[1].x, z: this.cars[1].z };
    }

    updateHomingMissiles() {
        for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
            const m = this.activeMissiles[i];
            
            // Calcular vector de dirección hacia el coche objetivo
            const dx = m.target.x - m.x;
            const dz = m.target.z - m.z;
            const dist = Math.sqrt(dx*dx + dz*dz);

            if (dist < 3.0) { // Colisión directa del misil
                if (!m.target.isImmune) {
                    m.target.launchIntoAir(1.1); // Lo manda a volar
                    m.target.explosionTimer = 90; // Paralizado por impacto 1.5s
                }
                this.scene.remove(m.mesh);
                this.activeMissiles.splice(i, 1);
                continue;
            }

            // Desplazamiento y orientación inteligente hacia el rival
            const dirX = dx / dist;
            const dirZ = dz / dist;
            m.x += dirX * m.speed;
            m.z += dirZ * m.speed;

            m.mesh.position.set(m.x, 1.5, m.z);
            m.mesh.rotation.y = Math.atan2(dirX, dirZ) + Math.PI;
        }
    }

    processTrackCollisions() {
        this.cars.forEach(car => {
            if (car.y > 0.5) return; // Si va volando alto por una rampa, ignora colisión de bordes de pista
            const carPos = new THREE.Vector3(car.x, 0, car.z);
            const closestPoint = this.getClosestPoint(carPos, this.trackCurve);
            if (carPos.distanceTo(closestPoint) > 21.5) {
                car.bounce();
                const returnDir = new THREE.Vector3().subVectors(closestPoint, carPos).normalize();
                car.x += returnDir.x * 0.4; car.z += returnDir.z * 0.4;
            }
        });
    }

    processHazardCollisions() {
        this.cars.forEach(car => {
            const isFlying = car.y > 0.8; // Bandera física de altura

            // --- A) DETECTAR RAMPAS DE SALTO ---
            if (!isFlying) {
                this.ramps.forEach(ramp => {
                    if (Math.sqrt((car.x - ramp.x)**2 + (car.z - ramp.z)**2) < ramp.radius) {
                        car.launchIntoAir(0.75); // Impulso vertical ascendente
                    }
                });
            }

            // --- B) DETECTAR TURBO MATS ---
            if (!isFlying) {
                this.turboMats.forEach(mat => {
                    if (Math.sqrt((car.x - mat.x)**2 + (car.z - mat.z)**2) < 3.0) {
                        car.turboTimer = Math.max(car.turboTimer, 60); // 1 segundo inyección turbo
                    }
                });
            }

            // --- C) DETECTAR MINAS EXPLOSIVAS ---
            if (!isFlying && !car.isImmune) {
                this.explosiveMines.forEach(mine => {
                    if (!mine.triggered && Math.sqrt((car.x - mine.x)**2 + (car.z - mine.z)**2) < 2.5) {
                        mine.triggered = true;
                        this.scene.remove(mine.mesh);
                        car.launchIntoAir(1.4); // Explosión vertical brutal
                        car.explosionTimer = 60; // Queda inutilizado temporalmente
                    }
                });
            }

            // --- D) CAJAS SORPRESA ---
            if (!isFlying) {
                this.surpriseBoxes.forEach(box => {
                    if (!box.triggered && Math.sqrt((car.x - box.x)**2 + (car.z - box.z)**2) < 3.5) {
                        box.triggered = true; this.scene.remove(box.mesh);
                        if (Math.random() > 0.5) {
                            const wallGeo = new THREE.BoxGeometry(8, 3, 3);
                            const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshLambertMaterial({ color: '#c0392b' }));
                            wallMesh.position.set(box.x, 1.5, box.z); this.scene.add(wallMesh);
                            this.walls.push({ mesh: wallMesh, x: box.x, z: box.z, halfW: 4, halfL: 1.5, active: true });
                        } else {
                            this.invisibleTraps.push({ x: box.x, z: box.z, radius: 7, name: "Aceite Sorpresa" });
                        }
                    }
                });
            }

            // --- E) PRISIONEROS DE ARENA O ACEITE ---
            let inSlowZone = false;
            let trapDetectedName = "";

            if (!car.isImmune && !isFlying) {
                for (let trap of this.traps) {
                    if (Math.sqrt((car.x - trap.x)**2 + (car.z - trap.z)**2) < trap.radius) {
                        inSlowZone = true; break;
                    }
                }
                for (let trap of this.invisibleTraps) {
                    if (Math.sqrt((car.x - trap.x)**2 + (car.z - trap.z)**2) < trap.radius) {
                        inSlowZone = true; trapDetectedName = trap.name; break;
                    }
                }
            }

            if (trapDetectedName !== "") {
                if (car.id === 1) this.p1Alert = `⚠️ ¡PISASTE: ${trapDetectedName}!`;
                else this.p2Alert = `⚠️ ¡PISASTE: ${trapDetectedName}!`;
            } else {
                if (car.id === 1) this.p1Alert = ""; else this.p2Alert = "";
            }

            if (inSlowZone) {
                car.maxSpeed = car.baseMaxSpeed * 0.3; 
            } else if (car.maxSpeed < car.baseMaxSpeed * 1.5) { 
                car.maxSpeed = car.baseMaxSpeed;
            }

            // --- F) COLISIÓN DE MUROS (Solo si no vuela por encima de ellos) ---
            if (!car.isImmune && car.y < 2.0) { 
                for (let wall of this.walls) {
                    if (wall.active && car.x > wall.x - wall.halfW - 1.0 && car.x < wall.x + wall.halfW + 1.0 &&
                        car.z > wall.z - wall.halfL - 1.5 && car.z < wall.z + wall.halfL + 1.5) {
                        car.bounce();
                        car.x += (car.x > wall.x ? 1 : -1) * 0.5; car.z += (car.z > wall.z ? 1 : -1) * 0.5;
                    }
                }
            }
        });
    }

    getClosestPoint(pos, curve) {
        const points = curve.getPoints(150); let closest = points[0]; let minDist = pos.distanceTo(closest);
        for (let i = 1; i < points.length; i++) {
            let d = pos.distanceTo(points[i]); if (d < minDist) { minDist = d; closest = points[i]; }
        }
        return closest;
    }

    processCarCollisions() {
        const c1 = this.cars[0]; const c2 = this.cars[1]; if (!c1 || !c2 || c1.isImmune || c2.isImmune) return;
        // Evitar choques entre ellos si están a alturas radicalmente distintas (uno saltando)
        if (Math.abs(c1.y - c2.y) > 2.0) return;

        const dist = Math.sqrt((c2.x - c1.x)**2 + (c2.z - c1.z)**2);
        if (dist < 2.2) {
            c1.bounce(); c2.bounce();
            const push = (2.2 - dist) * 0.5;
            c1.x -= ((c2.x - c1.x) / (dist || 1)) * push; c1.z -= ((c2.z - c1.z) / (dist || 1)) * push;
            c2.x += ((c2.x - c1.x) / (dist || 1)) * push; c2.z += ((c2.z - c1.z) / (dist || 1)) * push;
        }
    }

    processLapsAndMetaWalls() {
        const planeNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle);
        this.cars.forEach((car, index) => {
            const oldPos = this.previousCarPositions[index]; if (car.z < -40) car.passedCheckpoint = true;
            const oldDist = new THREE.Vector3(oldPos.x, 0, oldPos.z).sub(this.metaCenter).dot(planeNormal);
            const currentDist = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).dot(planeNormal);
            const localPos = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.metaAngle);

            if (Math.abs(localPos.x) < 23) {
                if (oldDist <= 0 && currentDist > 0 && car.passedCheckpoint) {
                    car.passedCheckpoint = false;
                    if (car.currentLap < this.totalLaps) car.currentLap++;
                    else { alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} gana.`); this.initPlayers(); this.startCountdown(); }
                }
                if (oldDist >= 0 && currentDist < 0 && !this.ignoreMetaWallTemporarily) {
                    car.bounce();
                    const correctSide = this.metaCenter.clone().addScaledVector(planeNormal, 0.5);
                    car.x = correctSide.x; car.z = correctSide.z;
                }
            }
        });
    }

    cameraFollow() {
        if (!this.cars[0] || !this.cars[1]) return;
        const midX = (this.cars[0].x + this.cars[1].x) / 2; const midZ = (this.cars[0].z + this.cars[1].z) / 2;
        const targetHeight = Math.max(65, 50 + (Math.max(Math.abs(this.cars[0].x - this.cars[1].x), Math.abs(this.cars[0].z - this.cars[1].z)) * 1.0));
        this.camera.position.x += (midX - this.camera.position.x) * 0.05;
        this.camera.position.y += (targetHeight - this.camera.position.y) * 0.05;
        this.camera.position.z += ((midZ + targetHeight * 0.95) - this.camera.position.z) * 0.05;
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        if (!this.uiContainer || !this.cars[0] || !this.cars[1]) return;
        this.uiContainer.innerHTML = `
            <div style="margin-bottom: 5px;">
                <span style="color:#e74c3c; font-weight:bold;">J1 (Rojo) Vueltas: ${this.cars[0].currentLap}/${this.totalLaps}</span> 
                | Poderes [K, L]: <span style="color:#f1c40f;">${this.cars[0].skills[0]}</span>, <span style="color:#f1c40f;">${this.cars[0].skills[1]}</span>
                <span style="color:#ff3f34; font-weight:bold; margin-left:10px;">${this.p1Alert}</span>
            </div>
            <div>
                <span style="color:#3498db; font-weight:bold;">J2 (Azul) Vueltas: ${this.cars[1].currentLap}/${this.totalLaps}</span> 
                | Poderes [1, 2]: <span style="color:#f1c40f;">${this.cars[1].skills[0]}</span>, <span style="color:#f1c40f;">${this.cars[1].skills[1]}</span>
                <span style="color:#ff3f34; font-weight:bold; margin-left:10px;">${this.p2Alert}</span>
            </div>
        `;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight; this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

window.addEventListener('load', () => {
    const comprobar = setInterval(() => {
        if (typeof THREE !== 'undefined' && typeof InputHandler !== 'undefined') {
            clearInterval(comprobar); try { const game = new Game(); game.start(); } catch (e) { console.error(e); }
        }
    }, 100);
});
