class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); 

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 50, 50);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(20, 80, 20);
        this.scene.add(sun);

        this.input = new InputHandler();
        
        this.totalLaps = 5; 
        this.availableSkills = ["BOOST", "SWAP", "FREEZE", "WALL"];

        // Curva nativa del circuito
        this.trackPoints = [
            new THREE.Vector3(0, 0, 40),      
            new THREE.Vector3(50, 0, 40),     
            new THREE.Vector3(75, 0, 10),     
            new THREE.Vector3(60, 0, -30),    
            new THREE.Vector3(20, 0, -55),    
            new THREE.Vector3(-20, 0, -25),   
            new THREE.Vector3(-60, 0, -50),   
            new THREE.Vector3(-70, 0, 0),     
            new THREE.Vector3(-45, 0, 30),    
            new THREE.Vector3(-20, 0, 40)     
        ];
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);

        // --- CÁLCULO GEOMÉTRICO DINÁMICO DE LA META ---
        // Obtenemos la posición de inicio en la curva (t = 0)
        this.metaCenter = this.trackCurve.getPointAt(0); 
        // Obtenemos la dirección (tangente) de la carretera en ese punto
        const tangent = this.trackCurve.getTangentAt(0).normalize();
        // Calculamos el ángulo real de rotación Y del terreno
        this.metaAngle = Math.atan2(-tangent.z, tangent.x) + Math.PI / 2;

        // Historial de posiciones dinámicas inicializado en el punto de salida
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
        this.uiContainer.style.minWidth = '450px';
        this.uiContainer.style.boxShadow = '0px 4px 10px rgba(0,0,0,0.5)';
        document.body.appendChild(this.uiContainer);
    }

    createTrack() {
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 100, 10, 12, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); 
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.scale.set(1, 0.01, 1);
        this.scene.add(trackMesh);
    }

    createDynamicMetaAndLights() {
        // Contenedor maestro acoplado al centro real de la pista
        this.metaGroupMaster = new THREE.Group();
        this.metaGroupMaster.position.copy(this.metaCenter);

        // --- 1. LÍNEA DE META (Ancho de extremo a extremo exacto = 20) ---
        const metaAncho = 20; 
        const metaLargo = 3;  
        const metaAlto = 0.05; 

        const rows = 14; 
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

        // --- 2. SEMÁFORO ALINEADO AUTOMÁTICAMENTE ---
        const postGeo = new THREE.CylinderGeometry(0.18, 0.18, 12);
        const structureMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        
        // Postes en los extremos exactos del asfalto (-10 y 10 relativo al centro)
        const postL = new THREE.Mesh(postGeo, structureMat); postL.position.set(-10, 6, 0);
        const postR = new THREE.Mesh(postGeo, structureMat); postR.position.set(10, 6, 0);
        
        const barGeo = new THREE.CylinderGeometry(0.12, 0.12, 20);
        const bar = new THREE.Mesh(barGeo, structureMat); bar.rotation.z = Math.PI / 2; bar.position.set(0, 12, 0);

        this.metaGroupMaster.add(postL, postR, bar);

        const boxGeo = new THREE.BoxGeometry(3.5, 1.3, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const box = new THREE.Mesh(boxGeo, boxMat); box.position.set(0, 12, 0);
        this.metaGroupMaster.add(box);

        const lightGeo = new THREE.SphereGeometry(0.45, 16, 16);
        this.redMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
        this.greenMat = new THREE.MeshBasicMaterial({ color: 0x005500 });

        this.leftLight = new THREE.Mesh(lightGeo, this.redMat); this.leftLight.position.set(-0.8, 12, 0.55);
        this.rightLight = new THREE.Mesh(lightGeo, this.greenMat); this.rightLight.position.set(0.8, 12, 0.55);

        this.metaGroupMaster.add(this.leftLight, this.rightLight);

        // Rotamos todo el conjunto maestro al ángulo exacto calculado de la pista
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
        // Usamos la dirección de la meta para posicionar los coches en fila india perfecta
        const forwardVector = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle);

        // Posiciones espaciadas relativas al centro matemático de la meta
        const p1Pos = this.metaCenter.clone().addScaledVector(forwardVector, -4); // Coche 1 (Rojo) adelante
        const p2Pos = this.metaCenter.clone().addScaledVector(forwardVector, -8); // Coche 2 (Azul) detrás

        this.cars = [
            new Car(this.scene, p1Pos.x, p1Pos.z, 0xe74c3c, 1), 
            new Car(this.scene, p2Pos.x, p2Pos.z, 0x3498db, 2)   
        ];

        // Orientación inicial alineada con la pista
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
                if (e.key === 'v' || e.key === 'V') this.triggerSkill(this.cars[1], 0);
                if (e.key === 'b' || e.key === 'B') this.triggerSkill(this.cars[1], 1);
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
        } else if (skill === "WALL") {
            car.spawnSpecialWall();
        }

        car.skills[slotIndex] = "USADO";
    }

    swapCarPositions() {
        const c1 = this.cars[0]; const c2 = this.cars[1];
        if (!c1 || !c2) return;

        const tempX = c1.x; const tempZ = c1.z; const tempAngle = c1.angle;
        c1.x = c2.x; c1.z = c2.z; c1.angle = c2.angle;
        c2.x = tempX; c2.z = tempZ; c2.angle = tempAngle;
        c1.speed = 0; c2.speed = 0; 
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
        this.processWallCollisions(); 
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

            if (dist > 9.5) {
                car.bounce();
                const returnDir = new THREE.Vector3().subVectors(closestPoint, carPos).normalize();
                car.x += returnDir.x * 0.4;
                car.z += returnDir.z * 0.4;
            }
        });
    }

    processWallCollisions() {
        const c1 = this.cars[0]; const c2 = this.cars[1];
        
        if (c1 && c1.hasPassableWallActive && c1.myWallMesh && c2) {
            const wallPos = c1.myWallMesh.position;
            const dx = c2.x - wallPos.x;
            const dz = c2.z - wallPos.z;
            const rotatedX = dx * Math.cos(-c1.angle) - dz * Math.sin(-c1.angle);
            const rotatedZ = dx * Math.sin(-c1.angle) + dz * Math.cos(-c1.angle);

            if (Math.abs(rotatedX) < 10.5 && Math.abs(rotatedZ) < 1.0) {
                c2.bounce();
                c2.x -= Math.sin(c2.angle) * -1.2; c2.z -= Math.cos(c2.angle) * -1.2;
            }
        }

        if (c2 && c2.hasPassableWallActive && c2.myWallMesh && c1) {
            const wallPos = c2.myWallMesh.position;
            const dx = c1.x - wallPos.x;
            const dz = c1.z - wallPos.z;
            const rotatedX = dx * Math.cos(-c2.angle) - dz * Math.sin(-c2.angle);
            const rotatedZ = dx * Math.sin(-c2.angle) + dz * Math.cos(-c2.angle);

            if (Math.abs(rotatedX) < 10.5 && Math.abs(rotatedZ) < 1.0) {
                c1.bounce();
                c1.x -= Math.sin(c1.angle) * -1.2; c1.z -= Math.cos(c1.angle) * -1.2;
            }
        }
    }

    getClosestPoint(pos, curve) {
        const points = curve.getPoints(100);
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
        // Comprobación de paso por meta utilizando la matriz de transformación del plano local de la meta
        const planeNormal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.metaAngle);

        this.cars.forEach((car, index) => {
            const oldPos = this.previousCarPositions[index];
            if (car.z < -20) car.passedCheckpoint = true;

            // Calcular distancias relativas con el plano infinito de la meta
            const oldDist = new THREE.Vector3(oldPos.x, 0, oldPos.z).sub(this.metaCenter).dot(planeNormal);
            const currentDist = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).dot(planeNormal);

            // Verificar si el vehículo se encuentra dentro del rango de ancho de la carretera (20 unidades)
            const localPos = new THREE.Vector3(car.x, 0, car.z).sub(this.metaCenter).applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.metaAngle);

            if (Math.abs(localPos.x) < 11) {
                // Sentido de marcha correcto: cruza el plano de adelante hacia atrás
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
                
                // Muro físico si intentan ir en dirección contraria
                if (oldDist >= 0 && currentDist < 0) {
                    car.bounce();
                    const correctSide = this.metaCenter.clone().addScaledVector(planeNormal, 0.5);
                    car.x = correctSide.x;
                    car.z = correctSide.z;
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

        const targetHeight = Math.max(40, 30 + (maxDist * 1.1));

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
                | Poderes [V, B]: <span style="color:#f1c40f;">${sk2_a}</span>, <span style="color:#f1c40f;">${sk2_b}</span>
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
