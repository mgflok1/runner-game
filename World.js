import { CONFIG, SHADER_UNIFORMS } from './config.js';

export class World {
    constructor(scene, assetManager, objectPool) {
        this.scene = scene;
        this.assets = assetManager;
        this.pool = objectPool;
        
        this.groundSegments = [];
        this.activeObjects = [];
        this.nextSpawnZ = CONFIG.initialSpawnZ;
        
        // Tracks the side-to-side bending of the track shader
        this.curveState = { timer: 0, currentSide: 0, targetSide: 0 };
    }

    init() {
        // Instantiate road chunks continuously looping
        for(let i = 0; i < CONFIG.segmentCount; i++) {
            let mesh;
            if (this.assets.models.road && this.assets.models.road2) {
                mesh = (i % 2 === 0) ? this.assets.models.road.clone() : this.assets.models.road2.clone();
            } else {
                // Fallback geometry if road fails to load
                const geo = new THREE.PlaneGeometry(CONFIG.laneWidth * CONFIG.WORLD.roadFallbackWidthMultiplier, CONFIG.segmentLength);
                const mat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.roadFallback });
                mesh = new THREE.Mesh(geo, mat);
                mesh.rotation.x = -Math.PI / 2; 
                Utils.applyCurveToMesh(mesh); 
            }
            mesh.position.z = CONFIG.segmentLength - (i * CONFIG.segmentLength); 
            mesh.position.y = CONFIG.groundY; 
            this.scene.add(mesh);
            this.groundSegments.push(mesh);
        }
    }

    reset() {
        this.nextSpawnZ = -250;
        this.groundSegments.forEach((seg, i) => {
            seg.position.z = CONFIG.segmentLength - (i * CONFIG.segmentLength);
        });
        this.pool.releaseAll(this.activeObjects);
    }

    update(dt, playerZ, isWorldMoving) {
        if (isWorldMoving) {
            // Update the curve shader dynamically over time to twist the road
            this.curveState.timer += dt;
            if (this.curveState.timer > CONFIG.WORLD.curveUpdateInterval) { 
                this.curveState.timer = 0;
                // Pick a new random curve target
                this.curveState.targetSide = Math.floor(Math.random() * (CONFIG.WORLD.curveMaxVariance * 2)) - CONFIG.WORLD.curveMaxVariance;
            }
            // Smoothly interpolate to new curve target
            this.curveState.currentSide = THREE.MathUtils.lerp(this.curveState.currentSide, this.curveState.targetSide, dt * CONFIG.WORLD.curveLerpSpeed);
            SHADER_UNIFORMS.uCurveSide.value = this.curveState.currentSide;

            // Infinite treadmill loop for ground segments
            this.groundSegments.forEach(seg => {
                const totalLength = CONFIG.segmentCount * CONFIG.segmentLength;
                if (seg.position.z > playerZ + CONFIG.segmentLength) seg.position.z -= totalLength; 
            });
        }
    }

    spawnLevelSegment() {
        const spawnZ = this.nextSpawnZ;
        const rand = Math.random();
        let availableLanes = [...CONFIG.lanes];
        
        // Randomly pick unique lanes
        const laneA = availableLanes.splice(Math.floor(Math.random() * availableLanes.length), 1)[0];
        const laneB = availableLanes.splice(Math.floor(Math.random() * availableLanes.length), 1)[0];
        const laneC = availableLanes[0];

        // Level generation logic based on probability configs
        if (rand < CONFIG.PROBABILITY.doubleObstacle) {
            const type = this.createObstacle(laneA, spawnZ);
            this.createObstacle(laneB, spawnZ, type); 
            if (Math.random() > CONFIG.PROBABILITY.ringWithDouble) this.createRingPattern(laneC, spawnZ);
        } else if (rand < CONFIG.PROBABILITY.singleObstacle) {
            this.createObstacle(laneA, spawnZ);
            this.createRingPattern(laneB, spawnZ);
            if (Math.random() > CONFIG.PROBABILITY.ringWithSingle) this.createRingPattern(laneC, spawnZ); 
        } else {
            this.createRingPattern(laneA, spawnZ);
            if (Math.random() > CONFIG.PROBABILITY.doubleRing) this.createRingPattern(laneB, spawnZ);
        }
        
        // Move spawn cursor further into the background
        this.nextSpawnZ -= CONFIG.spawnDistance; 
    }

    createObstacle(lane, z, excludeKey = null) {
        let keys = ['bin', 'car_blue', 'car_red', 'slide'];
        if (excludeKey) keys = keys.filter(k => k !== excludeKey);

        const pickedKey = keys[Math.floor(Math.random() * keys.length)];
        const obj = this.pool.get(pickedKey); // Pull from pool
        
        obj.mesh.position.set(lane * CONFIG.laneWidth, CONFIG.groundY, z);
        obj.colliderMesh.position.copy(obj.mesh.position);
        
        this.activeObjects.push(obj);
        return pickedKey;
    }

    createRingPattern(lane, startZ) {
        // Spawn a string of rings
        const ringCount = Math.floor(Math.random() * CONFIG.WORLD.ringPatternRandomCount) + CONFIG.WORLD.ringPatternMinCount;
        const localSpacing = CONFIG.ringSpacing; 

        for(let i = 0; i < ringCount; i++) {
            const obj = this.pool.get('ring');
            const z = startZ - (i * localSpacing); 
            const y = CONFIG.WORLD.ringY;

            obj.mesh.position.set(lane * CONFIG.laneWidth, y, z);
            obj.colliderMesh.position.copy(obj.mesh.position);
            
            this.activeObjects.push(obj);
        }
    }
}