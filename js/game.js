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
        // Cambiado "WALL" por "IMMUNE"
        this.availableSkills = ["BOOST", "SWAP", "FREEZE", "IMMUNE"];

        this.ignoreMetaWallTemporarily = false;

        // --- TRAZADO AUTÉNTICO FÓRMULA 1 (Escala ampliada tipo Monza/Spa) ---
        this.trackPoints = [
            new THREE.Vector3(0, 0, 120),       // Línea de Meta / Gran Recta Principal
            new THREE.Vector3(120, 0, 120),     // Fin de recta / Primera curva rápida
            new THREE.Vector3(180, 0, 60),      // Curvón amplio a la derecha
            new THREE.Vector3(140, 0, -20),     // Chicane técnica - Entrada izquierda
            new THREE.Vector3(160, 0, -50),     // Chicane técnica - Salida derecha
            new THREE.Vector3(80, 0, -120),     // Recta trasera de alta velocidad
            new THREE.Vector3(-40, 0, -140),    // Horquilla de frenada fuerte (Hairpin)
            new THREE.Vector3(-120, 0, -60),    // Curva media sinuosa
            new THREE.Vector3(-160, 0, 20),     // Sección rápida tipo "S" de Senna
            new THREE.Vector3(-100, 0, 80),     // Curva de entrada a meta
            new THREE.Vector3(-40, 0, 110)      // Enlace directo a la recta principal
        ];
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);

        // Geometría e indicaciones de meta
        this.metaCenter = this.trackCurve.getPointAt(0); 
        const tangent = this.trackCurve.getTangentAt(0).normalize();
        this.metaAngle = Math.atan2(-tangent.z, tangent.x) + Math.PI / 2;

        this.previousCarPositions = [{ x: 0, z: 0 }, { x: 0, z: 0 }];

        this.createTrack();
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
        // --- CARRETERA MUCHO MÁS ANCHA ---
        // Incrementamos el radio de la pista a 22 (antes era 10) para dar espacio a trampas
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 120, 22, 16, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); 
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.scale.set(1, 0.005, 1); // Más plano para simular asfalto de circuito
        this.scene.add(trackMesh);
    }

    createDynamicMetaAndLights() {
        this.metaGroupMaster = new THREE.Group();
        this.metaGroupMaster.position.copy(this.metaCenter);

        // Se adapta el tamaño de la estructura de meta a la nueva anchura de pista
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

        // Retrocedemos un poco más (10 unidades) por seguridad de escala de pista de F1
        const startLineCenter = this.metaCenter.clone().addScaledVector(forwardVector, -10);

        // Separación más cómoda gracias a la pista ancha: J1 a la izquierda (-5.0) y J2 a la derecha (+5.0)
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
            // Activación de la nueva habilidad de Inmunidad
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

            // Ajustada la colisión de los límites del circuito a 21.5 (medio punto menos que el grosor real)
            if (dist > 21.5) {
                car.bounce();
                const returnDir = new THREE.Vector3().subVectors(closestPoint, carPos).normalize();
                car.x += returnDir.x * 0.4;
                car.z += returnDir.z * 0.4;
            }
        });
    }

    getClosestPoint(pos, curve) {
        const points = curve.getPoints(150); // Incrementada la precisión por trazado F1 largo
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

        // Si ALGUNO de los coches tiene activada la habilidad IMMUNE, se ignoran los choques entre ellos
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
            // Marcador intermedio de paso por vuelta ampliado a la escala del nuevo circuito
            if (car.z < -40) car.passedCheckpoint = true;

            const oldDist = new THREE.Vector3(oldPos.x, 0, oldPos.z).sub(this.metaCenter).dot(planeNormal);
            const currentDist = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).dot(planeNormal);

            const localPos = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.metaAngle);

            // El control de paso de meta ahora cubre los 22 de ancho de la pista
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

        // Subimos un poco la cámara base para que se aprecie mejor la amplitud del circuito F1
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
