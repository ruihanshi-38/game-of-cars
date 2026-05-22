class Game {
    constructor() {
        // 1. Inicializar Escena
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); 

        // 2. Configurar Renderizador acoplado al Canvas inferior
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.domElement.style.position = 'absolute';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.left = '0';
        this.renderer.domElement.style.zIndex = '1'; 
        document.body.appendChild(this.renderer.domElement);

        // 3. Configurar Cámara
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 75, 85);

        // 4. Iluminación estable
        const ambient = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(30, 100, 30);
        this.scene.add(sun);

        this.input = new InputHandler();
        this.totalLaps = 3; 
        this.walls = [];

        // Circuito elíptico original estable
        this.trackPoints = [
            new THREE.Vector3(0, 0, 40),       
            new THREE.Vector3(40, 0, 40),     
            new THREE.Vector3(60, 0, 0),      
            new THREE.Vector3(40, 0, -40),     
            new THREE.Vector3(0, 0, -40),     
            new THREE.Vector3(-40, 0, -40),     
            new THREE.Vector3(-60, 0, 0),    
            new THREE.Vector3(-40, 0, 40)
        ];
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        this.metaCenter = this.trackCurve.getPointAt(0); 

        this.createTrack();
        this.createMetaLine(); 
        this.initPlayers();
        this.buildCleanUI(); 
        this.setupAbilityListeners();

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    buildCleanUI() {
        // Vinculación con los IDs de tu HTML
        this.speedValEl = document.getElementById('speed-val');
        this.lapValEl = document.getElementById('lap-val');
        this.circuitValEl = document.getElementById('circuit-val');
        if (this.circuitValEl) this.circuitValEl.innerText = "1 (EXTREMO)";
    }

    createTrack() {
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 64, 14, 8, true);
        const trackMesh = new THREE.Mesh(trackGeo, new THREE.MeshLambertMaterial({ color: 0x34495e }));
        trackMesh.scale.set(1, 0.005, 1); 
        this.scene.add(trackMesh);
    }

    createMetaLine() {
        const metaMesh = new THREE.Mesh(new THREE.BoxGeometry(28, 0.1, 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
        metaMesh.position.copy(this.metaCenter);
        this.scene.add(metaMesh);
    }

    initPlayers() {
        this.cars = [
            new Car(this.scene, this.metaCenter.x - 4, this.metaCenter.z, 0xe74c3c, 1), 
            new Car(this.scene, this.metaCenter.x + 4, this.metaCenter.z, 0x3498db, 2)   
        ];
        this.cars[0].skills = ["BOOST", "FREEZE"]; 
        this.cars[1].skills = ["FREEZE", "BOOST"]; 

        this.previousCarPositions = [
            { x: this.cars[0].x, z: this.cars[0].z },
            { x: this.cars[1].x, z: this.cars[1].z }
        ];
    }

    setupAbilityListeners() {
        window.addEventListener('keydown', (e) => {
            if (!this.cars || !this.cars[0]) return;
            const k = e.key.toLowerCase();

            if (k === 'k') this.useSkill(this.cars[0], 0);
            if (k === 'l') this.useSkill(this.cars[0], 1);

            if (k === 'v') this.useSkill(this.cars[1], 0);
            if (k === 'b') this.useSkill(this.cars[1], 1);
        });
    }

    useSkill(car, slot) {
        let skill = car.skills[slot]; 
        if (!skill || skill === "USADO") return;
        
        if (skill === "BOOST") car.activateBoost();
        if (skill === "FREEZE") {
            const enemy = car.id === 1 ? this.cars[1] : this.cars[0];
            enemy.activateFreeze();
        }
        car.skills[slot] = "USADO";
    }

    start() { 
        this.loop(); 
    }

    loop() {
        requestAnimationFrame(this.loop);
        
        if (this.cars && this.cars[0] && this.cars[1]) {
            this.cars[0].update(this.input.getPlayer1Input());
            this.cars[1].update(this.input.getPlayer2Input());
            
            this.processCollisions();
            this.processLapsAndMeta(); 
            this.cameraFollow();
            this.updateUI();

            this.previousCarPositions[0] = { x: this.cars[0].x, z: this.cars[0].z };
            this.previousCarPositions[1] = { x: this.cars[1].x, z: this.cars[1].z };
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    processCollisions() {
        this.cars.forEach(car => {
            const distCenter = Math.sqrt(car.x**2 + car.z**2);
            if (distCenter > 55 || distCenter < 22) {
                car.bounce();
            }
        });

        // Choque mutuo entre ambos coches
        const distCars = Math.sqrt((this.cars[1].x - this.cars[0].x)**2 + (this.cars[1].z - this.cars[0].z)**2);
        if (distCars < 2.0) {
            this.cars[0].bounce();
            this.cars[1].bounce();
        }
    }

    processLapsAndMeta() {
        this.cars.forEach((car, index) => {
            const oldPos = this.previousCarPositions[index];
            if (!oldPos) return;

            if (oldPos.z < this.metaCenter.z && car.z >= this.metaCenter.z && Math.abs(car.x - this.metaCenter.x) < 15) {
                if (car.currentLap < this.totalLaps) {
                    car.currentLap++;
                } else {
                    alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} ha ganado.`);
                    this.initPlayers();
                }
            }
        });
    }

    cameraFollow() {
        const midX = (this.cars[0].x + this.cars[1].x) / 2; 
        const midZ = (this.cars[0].z + this.cars[1].z) / 2;
        this.camera.position.set(midX, 65, midZ + 65);
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        if (!this.speedValEl || !this.lapValEl) return;
        
        let v1 = Math.round(this.cars[0].speed * 240);
        let v2 = Math.round(this.cars[1].speed * 240);
        
        this.speedValEl.innerHTML = `J1: <span style="color:#e74c3c;">${v1}</span> | J2: <span style="color:#3498db;">${v2}</span>`;
        this.lapValEl.innerHTML = `J1: ${this.cars[0].currentLap}/${this.totalLaps} | J2: ${this.cars[1].currentLap}/${this.totalLaps}`;
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight; 
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// Inicialización asíncrona segura
window.addEventListener('load', () => {
    setTimeout(() => {
        const game = new Game(); 
        game.start(); 
    }, 100);
});
