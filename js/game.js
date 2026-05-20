class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); 

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        // Altura inicial de la cámara
        this.camera.position.set(0, 60, 60);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(20, 80, 20);
        this.scene.add(sun);

        this.input = new InputHandler();
        this.totalLaps = 3;

        // Circuito
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

        this.createTrack();
        this.createTrafficLight(); // Crear estructura del semáforo
        this.initPlayers();
        this.startCountdown();    // Iniciar secuencia de luces

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    createTrack() {
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        
        // Pista ancha (Radio 10)
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 100, 10, 12, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); 
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        trackMesh.scale.set(1, 0.01, 1);
        this.scene.add(trackMesh);

        // --- LÍNEA DE META A CUADROS (Blanco y Negro) ---
        const rows = 2;
        const cols = 10;
        const squareSize = 2; 
        
        this.finishGroup = new THREE.Group();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = (r + c) % 2 === 0 ? 0xffffff : 0x111111;
                const mat = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
                const geo = new THREE.PlaneGeometry(squareSize, squareSize);
                const mesh = new THREE.Mesh(geo, mat);
                
                mesh.rotation.x = Math.PI / 2;
                // Posicionar baldosas rellenando el ancho de la pista en Z = 40
                mesh.position.set(-10 + (c * squareSize) + 1, 0.02, 39 + (r * squareSize));
                this.finishGroup.add(mesh);
            }
        }
        this.scene.add(this.finishGroup);
    }

    createTrafficLight() {
        // Estructura de postes del semáforo sobre la meta
        this.lightGroup = new THREE.Group();

        const postGeo = new THREE.CylinderGeometry(0.2, 0.2, 12);
        const structureMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        
        const postL = new THREE.Mesh(postGeo, structureMat);
        postL.position.set(-11, 6, 40);
        const postR = new THREE.Mesh(postGeo, structureMat);
        postR.position.set(11, 6, 40);

        const barGeo = new THREE.CylinderGeometry(0.15, 0.15, 22);
        const bar = new THREE.Mesh(barGeo, structureMat);
        bar.rotation.z = Math.PI / 2;
        bar.position.set(0, 12, 40);

        this.lightGroup.add(postL, postR, bar);

        // Caja de luces central
        const boxGeo = new THREE.BoxGeometry(4, 1.5, 1);
        const boxMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const box = new THREE.Mesh(boxGeo, boxMat);
        box.position.set(0, 12, 40);
        this.lightGroup.add(box);

        // Focos de Luz (Esferas)
        const lightGeo = new THREE.SphereGeometry(0.5, 16, 16);
        
        // Materiales apagados por defecto
        this.redMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
        this.greenMat = new THREE.MeshBasicMaterial({ color: 0x005500 });

        this.leftLight = new THREE.Mesh(lightGeo, this.redMat);
        this.leftLight.position.set(-1, 12, 40.6); // Orientados hacia la salida

        this.rightLight = new THREE.Mesh(lightGeo, this.greenMat);
        this.rightLight.position.set(1, 12, 40.6);

        this.lightGroup.add(this.leftLight, this.rightLight);
        this.scene.add(this.lightGroup);
    }

    startCountdown() {
        console.log("Semáforo en ROJO. ¡Preparaos!");
        // Luz roja encendida brillante
        this.redMat.color.setHex(0xff0000); 
        this.greenMat.color.setHex(0x003300);

        setTimeout(() => {
            // Cambio a VERDE tras 3 segundos
            console.log("¡VERDE! ¡YA YA YA!");
            this.redMat.color.setHex(0x330000); // Apagar rojo
            this.greenMat.color.setHex(0x00ff00); // Encender verde

            // Desbloquear coches
            this.cars.forEach(car => car.frozen = false);

            // Apagar por completo el semáforo tras unos segundos de carrera
            setTimeout(() => {
                this.greenMat.color.setHex(0x005500);
            }, 3000);

        }, 3000);
    }

    initPlayers() {
        this.cars = [
            new Car(this.scene, -3, 40, 0xe74c3c, 1), 
            new Car(this.scene, 3, 40, 0x3498db, 2)   
        ];
        this.cars.forEach(car => car.angle = -Math.PI / 2);
    }

    start() {
        this.loop();
    }

    loop() {
        requestAnimationFrame(this.loop);
        this.update();
        this.renderer.render(this.scene, this.camera);
    }

    update() {
        const p1 = this.input.getPlayer1Input();
        const p2 = this.input.getPlayer2Input();

        if (this.cars[0]) this.cars[0].update(p1);
        if (this.cars[1]) this.cars[1].update(p2);

        this.processTrackCollisions();
        this.processCarCollisions();
        this.processLaps();
        this.cameraFollow();
        this.updateUI();
    }

    processTrackCollisions() {
        this.cars.forEach(car => {
            if (car.frozen) return;
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

    getClosestPoint(pos, curve) {
        const points = curve.getPoints(100);
        let closest = points[0];
        let minDist = pos.distanceTo(closest);
        for (let i = 1; i < points.length; i++) {
            let d = pos.distanceTo(points[i]);
            if (d < minDist) {
                minDist = d;
                closest = points[i];
            }
        }
        return closest;
    }

    processCarCollisions() {
        const c1 = this.cars[0];
        const c2 = this.cars[1];
        if (!c1 || !c2 || c1.frozen || c2.frozen) return;

        const dx = c2.x - c1.x;
        const dz = c2.z - c1.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        const minDist = 2.2;

        if (dist < minDist) {
            c1.bounce();
            c2.bounce();
            const push = (minDist - dist) * 0.5;
            c1.x -= (dx / (dist || 1)) * push;
            c1.z -= (dz / (dist || 1)) * push;
            c2.x += (dx / (dist || 1)) * push;
            c2.z += (dz / (dist || 1)) * push;
        }
    }

    processLaps() {
        this.cars.forEach(car => {
            if (car.frozen) return;
            if (car.z < -20) car.passedCheckpoint = true;

            if (car.passedCheckpoint && car.z >= 38 && car.z <= 42 && Math.abs(car.x) < 12) {
                car.passedCheckpoint = false;
                if (car.currentLap < this.totalLaps) {
                    car.currentLap++;
                } else {
                    alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} ha ganado.`);
                    // Resetear y reiniciar semáforo
                    this.cars[0].x = -3; this.cars[0].z = 40; this.cars[0].currentLap = 1; this.cars[0].frozen = true;
                    this.cars[1].x = 3;  this.cars[1].z = 40; this.cars[1].currentLap = 1; this.cars[1].frozen = true;
                    this.startCountdown();
                }
            }
        });
    }

    cameraFollow() {
        if (!this.cars[0] || !this.cars[1]) return;
        
        // 1. Encontrar el punto medio entre ambos bólidos
        const midX = (this.cars[0].x + this.cars[1].x) / 2;
        const midZ = (this.cars[0].z + this.cars[1].z) / 2;

        // 2. Calcular la distancia actual entre ellos en los dos ejes
        const distX = Math.abs(this.cars[0].x - this.cars[1].x);
        const distZ = Math.abs(this.cars[0].z - this.cars[1].z);
        const maxDist = Math.max(distX, distZ);

        // 3. Modificar la altura (Zoom de la cámara) dinámicamente según la distancia
        // Mínimo de altura: 45 (cerca), se abre progresivamente hasta donde haga falta
        const targetHeight = Math.max(45, 35 + (maxDist * 0.8));

        // 4. Aplicar suavizado a la posición e interpolación de la cámara
        this.camera.position.x += (midX - this.camera.position.x) * 0.05;
        this.camera.position.y += (targetHeight - this.camera.position.y) * 0.05;
        this.camera.position.z += ((midZ + targetHeight * 0.9) - this.camera.position.z) * 0.05;
        
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        const speedEl = document.getElementById('speed-val');
        const lapEl = document.getElementById('lap-val');

        if (speedEl && this.cars[0] && this.cars[1]) {
            const s1 = Math.round(Math.abs(this.cars[0].speed) * 110);
            const s2 = Math.round(Math.abs(this.cars[1].speed) * 110);
            speedEl.innerText = `J1 (Rojo): ${s1} KM/H | J2 (Azul): ${s2} KM/H`;
        }
        if (lapEl && this.cars[0] && this.cars[1]) {
            lapEl.innerText = `J1: ${this.cars[0].currentLap}/${this.totalLaps} | J2: ${this.cars[1].currentLap}/${this.totalLaps}`;
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
                console.log("¡Todo listo! Motor 3D con cámara inteligente iniciado.");
            } catch (e) {
                console.error("Fallo de arranque:", e);
            }
        }
    }, 100);
});
