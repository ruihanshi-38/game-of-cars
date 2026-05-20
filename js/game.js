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

        // Guardar posiciones previas para el muro físico de meta unidireccional
        this.previousCarPositions = [{ z: 40 }, { z: 40 }];

        this.createTrack();
        this.createTrafficLight(); 
        this.initPlayers();
        this.startCountdown();    
        this.setupAbilityListeners(); 

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    createTrack() {
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 100, 10, 12, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); 
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.scale.set(1, 0.01, 1);
        this.scene.add(trackMesh);

        // Línea de meta visible a cuadros
        const rows = 2; const cols = 10; const squareSize = 2;
        this.finishGroup = new THREE.Group();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = (r + c) % 2 === 0 ? 0xffffff : 0x111111;
                const mat = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
                const geo = new THREE.PlaneGeometry(squareSize, squareSize);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.rotation.x = Math.PI / 2;
                mesh.position.set(-10 + (c * squareSize) + 1, 0.03, 39 + (r * squareSize)); 
                this.finishGroup.add(mesh);
            }
        }
        this.scene.add(this.finishGroup);
    }

    createTrafficLight() {
        this.lightGroup = new THREE.Group();
        const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 12);
        const structureMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        
        const postL = new THREE.Mesh(postGeo, structureMat); postL.position.set(-11, 6, 40);
        const postR = new THREE.Mesh(postGeo, structureMat); postR.position.set(11, 6, 40);
        const barGeo = new THREE.CylinderGeometry(0.15, 0.15, 22);
        const bar = new THREE.Mesh(barGeo, structureMat); bar.rotation.z = Math.PI / 2; bar.position.set(0, 12, 40);

        this.lightGroup.add(postL, postR, bar);

        const boxGeo = new THREE.BoxGeometry(4, 1.5, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const box = new THREE.Mesh(boxGeo, boxMat); box.position.set(0, 12, 40);
        this.lightGroup.add(box);

        const lightGeo = new THREE.SphereGeometry(0.5, 16, 16);
        this.redMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
        this.greenMat = new THREE.MeshBasicMaterial({ color: 0x005500 });

        this.leftLight = new THREE.Mesh(lightGeo, this.redMat); this.leftLight.position.set(-1, 12, 40.6);
        this.rightLight = new THREE.Mesh(lightGeo, this.greenMat); this.rightLight.position.set(1, 12, 40.6);

        this.lightGroup.add(this.leftLight, this.rightLight);
        this.scene.add(this.lightGroup);
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
        this.cars = [
            new Car(this.scene, -3, 41, 0xe74c3c, 1), 
            new Car(this.scene, 3, 41, 0x3498db, 2)   
        ];
        this.cars.forEach(car => car.angle = -Math.PI / 2);

        this.previousCarPositions[0].z = 41;
        this.previousCarPositions[1].z = 41;

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
        this.processLapsAndMetaWalls(); // Control unificado de la meta de un solo sentido
        this.cameraFollow();
        this.updateUI();

        // Actualizar el historial de posición para la comprobación del frame siguiente
        if (this.cars[0]) this.previousCarPositions[0].z = this.cars[0].z;
        if (this.cars[1]) this.previousCarPositions[1].z = this.cars[1].z;
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
        
        // Colisión ampliada de extremo a extremo para el muro del jugador 1
        if (c1 && c1.hasPassableWallActive && c1.myWallMesh && c2) {
            const wallPos = c1.myWallMesh.position;
            // Al ser un muro largo, rotamos el coche relativo al plano del muro para verificar la caja de colisión completa
            const dx = c2.x - wallPos.x;
            const dz = c2.z - wallPos.z;
            const rotatedX = dx * Math.cos(-c1.angle) - dz * Math.sin(-c1.angle);
            const rotatedZ = dx * Math.sin(-c1.angle) + dz * Math.cos(-c1.angle);

            // Caja de colisión extendida (Largo: 20 de extremo a extremo, Ancho: 1)
            if (Math.abs(rotatedX) < 10.5 && Math.abs(rotatedZ) < 1.0) {
                c2.bounce();
                c2.x -= Math.sin(c2.angle) * -1.2; c2.z -= Math.cos(c2.angle) * -1.2;
            }
        }

        // Colisión ampliada de extremo a extremo para el muro del jugador 2
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
        this.cars.forEach((car, index) => {
            const oldZ = this.previousCarPositions[index].z;
            const currentZ = car.z;

            // Marcador de punto de control intermedio
            if (currentZ < -20) car.passedCheckpoint = true;

            // Rango horizontal de la meta (Ancho de la pista)
            if (Math.abs(car.x) < 12) {
                
                // CASO 1: Cruza desde atrás (De Z > 40 hacia Z < 40) -> SENTIDO CORRECTO
                if (oldZ >= 40 && currentZ < 40) {
                    if (car.passedCheckpoint) {
                        car.passedCheckpoint = false;
                        if (car.currentLap < this.totalLaps) {
                            car.currentLap++;
                        } else {
                            alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} ha ganado tras 5 vueltas.`);
                            this.cars[0].x = -3; this.cars[0].z = 41; this.cars[0].currentLap = 1;
                            this.cars[1].x = 3;  this.cars[1].z = 41; this.cars[1].currentLap = 1;
                            
                            this.assignRandomSkills(this.cars[0]);
                            this.assignRandomSkills(this.cars[1]);
                            this.startCountdown();
                        }
                    }
                }
                
                // CASO 2: Intenta entrar por delante (De Z < 40 hacia Z > 40) -> SENTIDO PROHIBIDO (MURO ACTIVO)
                if (oldZ <= 40 && currentZ > 40) {
                    car.bounce();
                    car.z = 39.8; // Empuja el coche hacia atrás impidiéndole cruzar
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
        const speedEl = document.getElementById('speed-val');
        const lapEl = document.getElementById('lap-val');

        if (speedEl && this.cars[0] && this.cars[1]) {
            const sk1_a = this.cars[0].skills[0] || "NINGUNA";
            const sk1_b = this.cars[0].skills[1] || "NINGUNA";
            const sk2_a = this.cars[1].skills[0] || "NINGUNA";
            const sk2_b = this.cars[1].skills[1] || "NINGUNA";

            speedEl.innerHTML = `
                <span style="color:#e74c3c; font-weight: bold;">J1 (Rojo) Poderes [Teclas K, L]: ${sk1_a} | ${sk1_b}</span> <br/>
                <span style="color:#3498db; font-weight: bold;">J2 (Azul) Poderes [Teclas V, B]: ${sk2_a} | ${sk2_b}</span>
            `;
        }
        if (lapEl && this.cars[0] && this.cars[1]) {
            lapEl.innerText = `VUELTAS COMPLETADAS -> J1: ${this.cars[0].currentLap}/${this.totalLaps} | J2: ${this.cars[1].currentLap}/${this.totalLaps}`;
        }
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
