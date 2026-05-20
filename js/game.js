class Game {
    constructor() {
        // 1. Escena y Renderizador
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x27ae60); // Fondo césped verde

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // 2. Cámara desde el cielo inclinada
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
        this.camera.position.set(0, 60, 60);

        // 3. Luces
        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const sun = new THREE.DirectionalLight(0xffffff, 0.6);
        sun.position.set(20, 80, 20);
        this.scene.add(sun);

        this.input = new InputHandler();
        this.totalLaps = 3;

        // --- TRAZADO DEL CIRCUITO ANCHO Y DIFÍCIL ---
        this.trackPoints = [
            new THREE.Vector3(0, 0, 40),      // Salida / Meta
            new THREE.Vector3(50, 0, 40),     // Recta de salida
            new THREE.Vector3(75, 0, 10),     // Curva 1 cerrada
            new THREE.Vector3(60, 0, -30),    // Contra-curva
            new THREE.Vector3(20, 0, -55),    // Zona de chicanes del norte
            new THREE.Vector3(-20, 0, -25),   // Curva interior técnica
            new THREE.Vector3(-60, 0, -50),   // Horquilla del Noroeste
            new THREE.Vector3(-70, 0, 0),     // Bajada oeste
            new THREE.Vector3(-45, 0, 30),    // Penúltima curva de 90°
            new THREE.Vector3(-20, 0, 40)     // Curva de entrada a meta
        ];

        this.createTrack();
        this.initPlayers();

        window.addEventListener('resize', () => this.onWindowResize(), false);
        this.loop = this.loop.bind(this);
    }

    createTrack() {
        // Creamos la curva del circuito basada en los puntos
        this.trackCurve = new THREE.CatmullRomCurve3(this.trackPoints, true);
        
        // Pista extra ancha (Radio 10 = 20 metros de ancho de carretera)
        const trackGeo = new THREE.TubeGeometry(this.trackCurve, 100, 10, 12, true);
        const trackMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50 }); // Asfalto gris oscuro
        const trackMesh = new THREE.Mesh(trackGeo, trackMat);
        
        // Aplastamos el tubo cilíndrico en el eje Y para convertirlo en una carretera plana
        trackMesh.scale.set(1, 0.01, 1);
        this.scene.add(trackMesh);

        // Pintamos la Línea de Meta blanca en el suelo
        const finishGeo = new THREE.PlaneGeometry(20, 2);
        const finishMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        const finish = new THREE.Mesh(finishGeo, finishMat);
        finish.rotation.x = Math.PI / 2;
        finish.position.set(0, 0.02, 40);
        this.scene.add(finish);
    }

    initPlayers() {
        // Colocamos los dos bólidos en paralelo sobre la pista ancha
        this.cars = [
            new Car(this.scene, -3, 40, 0xe74c3c, 1), // J1 (Rojo)
            new Car(this.scene, 3, 40, 0x3498db, 2)   // J2 (Azul)
        ];

        // Apuntar los coches hacia la dirección correcta de salida (la derecha de la pantalla)
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
            const carPos = new THREE.Vector3(car.x, 0, car.z);
            const closestPoint = this.getClosestPoint(carPos, this.trackCurve);
            const dist = carPos.distanceTo(closestPoint);

            // Si se aleja más de 9.5 del centro del asfalto, choca contra el borde de la pista
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
        if (!c1 || !c2) return;

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
            // Checkpoint en mitad del circuito (zona norte) para evitar fraudes
            if (car.z < -20) car.passedCheckpoint = true;

            // Paso por meta (Z = 40)
            if (car.passedCheckpoint && car.z >= 38 && car.z <= 42 && Math.abs(car.x) < 12) {
                car.passedCheckpoint = false;
                if (car.currentLap < this.totalLaps) {
                    car.currentLap++;
                } else {
                    alert(`¡FIN DE LA CARRERA! El Jugador ${car.id} ha ganado.`);
                    this.cars[0].x = -3; this.cars[0].z = 40; this.cars[0].speed = 0; this.cars[0].angle = -Math.PI/2; this.cars[0].currentLap = 1;
                    this.cars[1].x = 3;  this.cars[1].z = 40; this.cars[1].speed = 0; this.cars[1].angle = -Math.PI/2; this.cars[1].currentLap = 1;
                }
            }
        });
    }

    cameraFollow() {
        if (!this.cars[0] || !this.cars[1]) return;
        // La cámara apunta dinámicamente al punto medio de ambos coches
        const midX = (this.cars[0].x + this.cars[1].x) / 2;
        const midZ = (this.cars[0].z + this.cars[1].z) / 2;

        this.camera.position.x += (midX - this.camera.position.x) * 0.05;
        this.camera.position.z += ((midZ + 55) - this.camera.position.z) * 0.05;
        this.camera.lookAt(midX, 0, midZ);
    }

    updateUI() {
        const speedEl = document.getElementById('speed-val');
        const lapEl = document.getElementById('lap-val');

        if (speedEl && this.cars[0] && this.cars[1]) {
            const s1 = Math.round(Math.abs(this.cars[0].speed) * 55);
            const s2 = Math.round(Math.abs(this.cars[1].speed) * 55);
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

// Bucle inteligente de inicialización para evitar retrasos de servidores CDN
window.addEventListener('load', () => {
    const comprobarLibrerias = setInterval(() => {
        if (typeof THREE !== 'undefined' && typeof InputHandler !== 'undefined') {
            clearInterval(comprobarLibrerias);
            try {
                const game = new Game();
                game.start();
                console.log("¡Todo listo! Motor 3D iniciado.");
            } catch (e) {
                console.error("Fallo de arranque:", e);
            }
        }
    }, 100);
});
