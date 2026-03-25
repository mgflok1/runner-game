import { CONFIG } from './config.js';
import { Utils } from './utils.js';

export class AssetManager {
    constructor(uiManager) {
        this.ui = uiManager;
        // Storage for loaded 3D models
        this.models = {
            catBase: null,
            ring: null,
            road: null,
            road2: null,
            obstacles: { bin: null, car_blue: null, car_red: null, slide: null }
        };
        // Storage for parsed animations
        this.animations = {};
    }

    load(onCompleteCallback) {
        const manager = new THREE.LoadingManager();
        
        // Update loading progress bar in UI
        manager.onProgress = (url, loaded, total) => {
            const pct = (loaded / total) * 100;
            this.ui.updateLoadingProgress(pct); 
        };

        // Triggered when all assets are fully loaded
        manager.onLoad = () => {
            this.ui.showStartButton(); 
            if (onCompleteCallback) onCompleteCallback();
        };

        const gltfLoader = new THREE.GLTFLoader(manager);
        const loadGltf = (path, callback) => gltfLoader.load(path, callback);

        // --- Loading Models & Animations ---
        loadGltf('assets/models/Cat_Base.glb', (gltf) => { this.models.catBase = gltf.scene; });
        loadGltf('assets/models/Cat_Start.glb', (gltf) => { if (gltf.animations.length) this.animations.start = gltf.animations[0]; });
        loadGltf('assets/models/Cat_RunShort.glb', (gltf) => { if (gltf.animations.length) this.animations.run = gltf.animations[0]; });
        loadGltf('assets/models/Cat_Jump.glb', (gltf) => { if (gltf.animations.length) this.animations.jump = gltf.animations[0]; });
        loadGltf('assets/models/Cat_Slide.glb', (gltf) => { if (gltf.animations.length) this.animations.slide = gltf.animations[0]; });
        loadGltf('assets/models/Cat_Death.glb', (gltf) => { if (gltf.animations.length) this.animations.death = gltf.animations[0]; });
        loadGltf('assets/models/Cat_HitWall1.glb', (gltf) => { if (gltf.animations.length) this.animations.hit = gltf.animations[0]; });

        // --- Loading Collectibles ---
        loadGltf('assets/models/ring.glb', (gltf) => { 
            gltf.scene.traverse(c => { 
                if(c.isMesh) { 
                    // Apply custom material for glowing rings
                    c.material = new THREE.MeshLambertMaterial({ 
                        color: CONFIG.COLORS.ring, 
                        emissive: CONFIG.COLORS.ringEmissive, 
                        emissiveIntensity: CONFIG.ringEmissiveIntensity 
                    });
                    // Modify vertex shader for the curved world effect
                    Utils.applyCurveToMesh(c); 
                }
            });
            this.models.ring = gltf.scene; 
        });

        // --- Loading Environment (Roads) ---
        const setupEnv = (gltf, storeKey) => {
            gltf.scene.scale.set(CONFIG.globalScale, CONFIG.globalScale, CONFIG.globalScale);
            // Rotate alternating road segments to match seamlessly
            gltf.scene.rotation.y = storeKey === 'road2' ? Math.PI : 0;       
            gltf.scene.traverse(c => { if(c.isMesh) { Utils.applyCurveToMesh(c); }});
            
            // Calculate segment length dynamically based on the model's bounding box
            if(storeKey === 'road') {
                const box = new THREE.Box3().setFromObject(gltf.scene);
                const size = new THREE.Vector3(); box.getSize(size);
                CONFIG.segmentLength = size.z - CONFIG.roadSegmentOffset;
            }
            this.models[storeKey] = gltf.scene;
        };

        loadGltf('assets/models/road.glb', (g) => setupEnv(g, 'road'));
        loadGltf('assets/models/road2.glb', (g) => setupEnv(g, 'road2'));

        // --- Loading Obstacles ---
        const setupObs = (gltf, key) => {
            gltf.scene.scale.set(CONFIG.globalScale, CONFIG.globalScale, CONFIG.globalScale);
            gltf.scene.traverse(c => { if(c.isMesh) { Utils.applyCurveToMesh(c); }});
            this.models.obstacles[key] = gltf.scene;
        };
        
        loadGltf('assets/models/bin.glb', (g) => setupObs(g, 'bin'));
        loadGltf('assets/models/car_blue.glb', (g) => setupObs(g, 'car_blue'));
        loadGltf('assets/models/car_red.glb', (g) => setupObs(g, 'car_red'));
        loadGltf('assets/models/slide.glb', (g) => setupObs(g, 'slide'));
    }
}