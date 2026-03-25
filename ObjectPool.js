import { CONFIG, HITBOXES } from './config.js';
import { Utils } from './utils.js';

// Object Pooling pattern prevents costly garbage collection spikes
// by reusing meshes instead of continuously creating and destroying them.
export class ObjectPool {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assets = assetManager.models;
        this.pools = {};
    }

    init() {
        const keys = ['ring', 'bin', 'car_blue', 'car_red', 'slide'];
        keys.forEach(key => {
            this.pools[key] = [];
            // Pre-instantiate objects based on configured counts
            const prewarmCount = key === 'ring' ? CONFIG.POOL.ringPrewarm : CONFIG.POOL.obstaclePrewarm;
            for (let i = 0; i < prewarmCount; i++) {
                this.pools[key].push(this.createNewObject(key));
            }
        });
    }

    createNewObject(key) {
        let mesh;
        const hitboxData = HITBOXES[key];

        // Clone appropriate model
        if (key === 'ring' && this.assets.ring) {
            mesh = this.assets.ring.clone();
            mesh.scale.set(CONFIG.POOL.ringScale, CONFIG.POOL.ringScale, CONFIG.POOL.ringScale);
            mesh.rotation.y = CONFIG.WORLD.ringInitialRotation;
        } else if (this.assets.obstacles[key]) {
            mesh = this.assets.obstacles[key].clone();
        } else {
            // Fallback geometry if asset is missing
            const size = CONFIG.POOL.fallbackGeoSize;
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(size, size, size), 
                new THREE.MeshStandardMaterial({ color: key === 'ring' ? CONFIG.COLORS.ring : CONFIG.COLORS.obstacleFallback })
            );
            Utils.applyCurveToMesh(mesh);
        }

        mesh.visible = false; 
        this.scene.add(mesh);

        // Add collider debug mesh
        const colliderColor = key === 'ring' ? CONFIG.COLORS.colliderRing : CONFIG.COLORS.colliderObstacle;
        const colliderMesh = Utils.createColliderMesh(hitboxData, colliderColor);
        colliderMesh.visible = false;
        this.scene.add(colliderMesh);

        return { 
            mesh, 
            colliderMesh, 
            type: key === 'ring' ? 'ring' : 'obstacle', 
            active: false, 
            hitboxData: { ...hitboxData }, 
            key 
        };
    }

    // Fetches an inactive object from the pool, creates a new one if pool is empty
    get(key) {
        let obj = this.pools[key].find(o => !o.active);
        
        if (!obj) {
            obj = this.createNewObject(key);
            this.pools[key].push(obj);
        }

        obj.active = true;
        obj.mesh.visible = true;
        
        if (key === 'ring') obj.mesh.rotation.y = Math.PI / 2; 

        if (CONFIG.showColliders) obj.colliderMesh.visible = true;
        
        return obj;
    }

    // Returns an object back to the pool by hiding it
    release(obj) {
        obj.active = false;
        obj.mesh.visible = false;
        obj.colliderMesh.visible = false;
        // Move far out of camera view
        obj.mesh.position.set(0, CONFIG.POOL.hiddenY, 0);
        obj.colliderMesh.position.set(0, CONFIG.POOL.hiddenY, 0);
    }

    // Utility to wipe the board completely
    releaseAll(activeObjectsArray) {
        activeObjectsArray.forEach(obj => this.release(obj));
        activeObjectsArray.length = 0; 
    }
}