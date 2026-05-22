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
        this.activeMissiles = []; 

        this.p1Alert = "";
        this.p2Alert = "";

        // Trazado de pista
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
        
        // Inicialización de eventos corregida
        this.setupAbilityListeners();
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
            <h4 style="color: #3498db; margin-bottom: 25px;">MODO PANTALLA ARCADE</h4>
            
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
            <h2 id="countdown-text" style="color: #2ecc71; margin-top: 30px; font-size: 26px;">Cargando simulador... 7s</h2>
        `;

        document.body.appendChild(overlay);

        let timeLeft = 7; 
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
        this.uiContainer.style.top = '20px'; 
        this.uiContainer.style.left = '50%';
        this.uiContainer.style.transform = 'translateX(-50%)';
        this.uiContainer.style.fontFamily = 'monospace, sans-serif';
        this.uiContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
        this.uiContainer.style.color = '#fff';
        this.uiContainer.style.padding = '12px 20px';
        this.uiContainer.style.borderRadius = '8px';
        this.uiContainer.style.zIndex = '9999';
        this.uiContainer.style.minWidth = '500px';
        this.uiContainer.style.textAlign = 'center';
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

        const turboPositions = [{ x: 25, z: 120 }, { x: 170, z: 25 }, { x: -30, z: -140 }];
        const turboGeo = new THREE.BoxGeometry(4, 0.08, 4);
        const turboMat = new THREE.MeshBasicMaterial({ color: 0x00ffff }); 
        turboPositions.forEach(pos => {
            const tMesh = new THREE.Mesh(turboGeo, turboMat);
            tMesh.position.set(pos.x, 0.06, pos.z);
            this.scene.add(tMesh);
            this.turboMats.push({ x: pos.x, z: pos.z });
        });

        const rampPositions = [{ x: 60, z: 120, w: 6, h: 2, l: 8, rotY: Math.PI / 2 }];
        rampPositions.forEach(pos => {
            const rampGeo = new THREE.BoxGeometry(pos.w, pos.h, pos.l);
            const rMesh = new THREE.Mesh(rampGeo, new THREE.MeshLambertMaterial({ color: '#e67e22' }));
            rMesh.position.set(pos.x, pos.h / 2, pos.z);
            rMesh.rotation.y = pos.rotY;
            this.scene.add(rMesh);
            this.ramps.push({ x: pos.x, z: pos.z, radius: 4.5 });
        });

        const minePositions = [{ x: 160, z: 55 }, { x: -70, z: -120 }];
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
        this.scene.add(this.metaGroupMaster);
    }

    startCountdown() {
        this.globalMatchFrozen = false;
    }

    initPlayers() {
        this.cars = [
            new Car(this.scene, this.metaCenter.x - 4, this.metaCenter.z, 0xe74c3c, 1), 
            new Car(this.scene, this.metaCenter.x + 4, this.metaCenter.z, 0x3498db, 2)   
        ];
        this.assignRandomSkills(this.cars[0]);
        this.assignRandomSkills(this.cars[1]);
    }

    assignRandomSkills(car) {
        car.skills = ["BOOST", "FREEZE"];
    }

    setupAbilityListeners() {
        window.addEventListener('keydown', (e) => {
            if (this.globalMatchFrozen) return;
            if (this.cars[0] && !this.cars[0].frozenBySkill) {
                if (e.key.toLowerCase() === 'k') this.triggerSkill(this.cars[0], 0);
                if (e.key.toLowerCase() === 'l') this.triggerSkill(this.cars[0], 1);
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
        
        if (skill === "BOOST") car.activateBoost();
        else if (skill === "FREEZE") this.cars[car.id === 1 ? 1 : 0].activateFreeze();

        car.skills[slotIndex] = "USADO";
    }

    start() { this.loop(); }

    loop() {
        requestAnimationFrame(this.loop);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    update() {
        if (this.globalMatchFrozen) {
            this.cars.forEach(c => c.update(null));
        } else {
            if (this.cars[0]) this.cars[0].update(this.input.getPlayer1Input());
            if (this.cars[1]) this.cars[1].update(this.input.getPlayer2Input());
        }

        this.processTrackCollisions();
        this.processHazardCollisions(); 
        this.cameraFollow();
        this.updateUI();
    }

    processTrackCollisions() {
        this.cars.forEach(car => {
            if (car.y > 0.5) return; 
            const carPos = new THREE.Vector3(car.x, 0, car.z);
            const closestPoint = this.getClosestPoint(carPos, this.trackCurve);
            if (carPos.distanceTo(closestPoint) > 21.5) {
                car.bounce();
            }
        });
    }

    processHazardCollisions() {
        this.cars.forEach(car => {
            const isFlying = car.y > 0.8;

            this.ramps.forEach(ramp => {
                if (!isFlying && Math.sqrt((car.x - ramp.x)**2 + (car.z - ramp.z)**2) < ramp.radius) {
                    car.launchIntoAir(0.75); 
                }
            });

            this.turboMats.forEach(mat => {
                if (!isFlying && Math.sqrt((car.x - mat.x)**2 + (car.z - mat.z)**2) < 3.0) {
                    car.turboTimer = Math.max(car.turboTimer, 60); 
                }
            });

            this.explosiveMines.forEach(mine => {
                if (!isFlying && !car.isImmune && !mine.triggered && Math.sqrt((car.x - mine.x)**2 + (car.z - mine.z)**2) < 2.5) {
                    mine.triggered = true;
                    this.scene.remove(mine.mesh);
                    car.launchIntoAir(1.4); 
                    car.explosionTimer = 60; 
                }
            });
        });
    }

    getClosestPoint(point, curve) {
        return curve.getPointAt(0); 
    }

    cameraFollow() {
        if(this.cars && this.cars[0]) {
            this.camera.position.set(this.cars[0].x, 60, this.cars[0].z + 60);
            this.camera.lookAt(this.cars[0].x, 0, this.cars[0].z);
        }
    }

    updateUI() {
        if (this.uiContainer && this.cars && this.cars[0] && this.cars[1]) {
            this.uiContainer.innerHTML = `
                <div style="display:flex; justify-content:space-around;">
                    <span style="color:#e74c3c">P1 Lap: ${this.cars[0].currentLap} [${this.cars[0].skills.join('/')}]</span>
                    <span style="color:#3498db">P2 Lap: ${this.cars[1].currentLap} [${this.cars[1].skills.join('/')}]</span>
                </div>
            `;
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}
