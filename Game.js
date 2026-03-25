import { CONFIG, SHADER_UNIFORMS, HITBOXES } from './config.js';
import { Utils } from './utils.js';
import { UIManager } from './UIManager.js';
import { AssetManager } from './AssetManager.js';
import { ObjectPool } from './ObjectPool.js';
import { Player } from './Player.js';
import { World } from './World.js';

export const GAME_STATE = {
    LOADING: 'LOADING',               
    STARTING: 'STARTING',             
    TUTORIAL_MOVE: 'TUTORIAL_MOVE',   
    TUTORIAL_INPUT: 'TUTORIAL_INPUT', 
    PLAYING: 'PLAYING',               
    PAUSED: 'PAUSED',                 
    DYING: 'DYING',                   
    GAMEOVER: 'GAMEOVER'              
};

export class Game {
    constructor() {
        this.currentState = GAME_STATE.LOADING;

        this.state = {
            score: 0, 
            distance: 0, 
            speedMultiplier: 1.0,
            lives: CONFIG.maxLives,                 
            isInvincible: false,      
            invincibilityTimer: 0,
            tutorialStep: 0,
            hasCompletedTutorial: false
        };

        this.frameCount = 0;
        this.fpsAccumulator = 0;

        this.ui = new UIManager();

        // Touch input coordinates
        this.touchStartX = 0;
        this.touchStartY = 0;

        this.assetManager = new AssetManager(this.ui); 
        this.clock = new THREE.Clock();
        
        // Bind methods to preserve context and allow removing event listeners later
        this.animate = this.animate.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        // Used to stop the render loop completely
        this.animationFrameId = null; 
    }

    init() {
        this.setupEventListeners();
        this.assetManager.load(); 
    }

    setupEventListeners() {
        this.ui.bindEvents({
            onStart: () => this.startGame(),
            onTogglePause: () => this.togglePause(),
            onRestartFromPause: () => this.restartGameFromPause(),
            onExit: () => window.location.href = '../index.html',
            onRestart: () => this.restartGame()
        });

        window.addEventListener('resize', this.onWindowResize);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        window.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        document.addEventListener('visibilitychange', this.handleVisibilityChange);
    }

    handleVisibilityChange() {
        // Automatically pause game when switching tabs
        if (document.visibilityState === 'hidden' && this.currentState === GAME_STATE.PLAYING) {
            this.togglePause();
        } 
    }

    onWindowResize() {
        if (this.camera && this.renderer) {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
    }

    handleTouchEnd(e) {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const dx = touchEndX - this.touchStartX;
        const dy = touchEndY - this.touchStartY;
        const minSwipeDist = CONFIG.TUTORIAL.swipeThreshold; 

        // Determine swipe direction based on largest delta
        let action = null;
        if (Math.abs(dx) > Math.abs(dy)) {
            if (Math.abs(dx) > minSwipeDist) action = dx > 0 ? 'right' : 'left';
        } else {
            if (Math.abs(dy) > minSwipeDist) action = dy > 0 ? 'down' : 'up';
        }

        if (action) this.triggerAction(action);
    }

    handleKeyDown(e) {
        // Map keyboard keys to actions
        switch(e.key) {
            case 'ArrowLeft': case 'a': case 'A': this.triggerAction('left'); break;
            case 'ArrowRight': case 'd': case 'D': this.triggerAction('right'); break;
            case 'ArrowUp': case 'w': case 'W': this.triggerAction('up'); break;
            case 'ArrowDown': case 's': case 'S': this.triggerAction('down'); break;
        }
    }

    setState(newState) {
        if (this.currentState === newState) return;

        // Cleanup before state change
        if (this.currentState === GAME_STATE.PAUSED) {
            this.ui.togglePauseScreen(false);
        } else if (this.currentState === GAME_STATE.TUTORIAL_INPUT) {
            this.ui.hideAllTutorialImages();
        }

        this.currentState = newState;

        // Handle entering new states
        switch (this.currentState) {
            case GAME_STATE.STARTING:
                this.ui.hideLoadingScreen();
                this.player.startInitialAnimation();
                this.clock.start();
                break;
            case GAME_STATE.TUTORIAL_INPUT:
                this.ui.showTutorialStep(this.state.tutorialStep);
                break;
            case GAME_STATE.PLAYING:
                break;
            case GAME_STATE.PAUSED:
                this.ui.togglePauseScreen(true);
                break;
            case GAME_STATE.DYING:
                this.player.triggerDeath();
                break;
            case GAME_STATE.GAMEOVER:
                this.ui.showGameOverScreen(this.state.score);
                break;
        }
    }

    triggerAction(action) {
        if (this.currentState !== GAME_STATE.PLAYING && this.currentState !== GAME_STATE.TUTORIAL_INPUT) return;

        // Handle specific actions requested by tutorial
        if (this.currentState === GAME_STATE.TUTORIAL_INPUT) {
            if (this.state.tutorialStep === 0 && action === 'left') { this.player.lane = -1; this.completeTutorialStep(CONFIG.TUTORIAL.delayShort); }
            else if (this.state.tutorialStep === 1 && action === 'right') { this.player.lane = 1; this.completeTutorialStep(CONFIG.TUTORIAL.delayShort); }
            else if (this.state.tutorialStep === 2 && action === 'up' && this.player.actionReady) { this.player.performJump(); this.completeTutorialStep(CONFIG.TUTORIAL.delayLong); }
            else if (this.state.tutorialStep === 3 && action === 'down' && this.player.actionReady) { this.player.performSlide(); this.completeTutorialStep(CONFIG.TUTORIAL.delayLong, true); }
            return; 
        }

        // Handle normal gameplay actions
        if (action === 'left') this.player.lane = Math.max(-1, this.player.lane - 1);
        else if (action === 'right') this.player.lane = Math.min(1, this.player.lane + 1);
        else if (action === 'up') this.player.performJump();
        else if (action === 'down') this.player.performSlide();
    }

    startGame() {
        if (this.currentState && this.currentState !== GAME_STATE.LOADING) return;
        
        this.ui.hideLoadingScreen();
        
        // Initialize Scene & Fog
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(CONFIG.COLORS.background);
        this.scene.fog = new THREE.Fog(CONFIG.COLORS.fog, CONFIG.GRAPHICS.fogNear, CONFIG.GRAPHICS.fogFar);

        // Initialize Camera
        this.camera = new THREE.PerspectiveCamera(CONFIG.CAMERA.fov, window.innerWidth / window.innerHeight, CONFIG.CAMERA.near, CONFIG.CAMERA.far);
        
        // Initialize WebGL Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, CONFIG.GRAPHICS.maxPixelRatio));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding; 
        
        this.ui.getCanvasContainer().appendChild(this.renderer.domElement);
        
        // Setup Lighting
        this.scene.add(new THREE.HemisphereLight(CONFIG.COLORS.hemiLightSky, CONFIG.COLORS.hemiLightGround, CONFIG.GRAPHICS.hemiLightIntensity));
        this.dirLight = new THREE.DirectionalLight(CONFIG.COLORS.dirLight, CONFIG.GRAPHICS.dirLightIntensity);
        this.scene.add(this.dirLight);
        this.scene.add(this.dirLight.target); 

        // Initialize Object Pool
        this.pool = new ObjectPool(this.scene, this.assetManager);
        this.pool.init();

        // Initialize World Generator
        this.world = new World(this.scene, this.assetManager, this.pool);
        this.world.init();

        // Initialize Player
        this.player = new Player(this.scene, this.assetManager);
        
        // Event listener for starting gameplay after start intro animation
        this.player.on('startAnimationFinished', () => {
            if (!this.state.hasCompletedTutorial) {
                this.setState(GAME_STATE.TUTORIAL_MOVE);
                this.prepareTutorialStep();
            } else {
                this.setState(GAME_STATE.PLAYING);
            }
        });

        this.player.on('deathAnimationFinished', () => {
            this.setState(GAME_STATE.GAMEOVER);
        });

        this.player.init();
        
        this.setState(GAME_STATE.STARTING);
        
        // Begin the main render loop
        this.animate();
    }

    update(dt) {
        if (this.currentState === GAME_STATE.LOADING || this.currentState === GAME_STATE.GAMEOVER) return;

        // Update shaders for world curving effect relative to camera position
        SHADER_UNIFORMS.uPlayerCameraPos.value.copy(this.camera.position);

        const isWorldMoving = (this.currentState === GAME_STATE.PLAYING || this.currentState === GAME_STATE.TUTORIAL_MOVE);
        const isAnimFrozen = (this.currentState === GAME_STATE.PAUSED || this.currentState === GAME_STATE.TUTORIAL_INPUT);

        // Handle i-frames blinking logic
        if (this.state.isInvincible) {
            this.state.invincibilityTimer -= dt;
            if (this.player.mesh) {
                this.player.mesh.visible = Math.floor(this.state.invincibilityTimer * CONFIG.blinkRate) % 2 === 0;
            }
            if (this.state.invincibilityTimer <= 0) {
                this.state.isInvincible = false;
                if (this.player.mesh) this.player.mesh.visible = true;
            }
        }

        // Gradually increase game speed
        if (this.currentState === GAME_STATE.PLAYING) {
            this.state.speedMultiplier = Math.min(
                this.state.speedMultiplier + CONFIG.speedIncreaseRate * dt, 
                CONFIG.maxSpeedMultiplier
            );
        }

        // Update player logic and animations
        this.player.update(
            dt, 
            this.state.speedMultiplier, 
            isWorldMoving, 
            isAnimFrozen,                                   
            this.currentState === GAME_STATE.STARTING,      
            this.currentState === GAME_STATE.PAUSED,        
            this.currentState === GAME_STATE.DYING          
        );
        
        // Update world chunks
        this.world.update(dt, this.player.z, isWorldMoving);

        // Update distance HUD
        if (isWorldMoving) {
            const newDist = Math.floor(Math.abs(this.player.z) / CONFIG.distanceDivisor);
            if (this.state.distance !== newDist) {
                this.state.distance = newDist;
                this.updateHUD();
            }
        }

        // Smoothly follow player with camera
        this.camera.position.set(0, CONFIG.groundY + CONFIG.CAMERA.offsetY, this.player.z + CONFIG.CAMERA.offsetZ);
        this.camera.lookAt(0, CONFIG.groundY + CONFIG.CAMERA.lookAtY, this.player.z + CONFIG.CAMERA.lookAtZ);

        // Update light position relative to player
        if (this.dirLight) {
            this.dirLight.position.set(0, CONFIG.LIGHTING.dirY, this.player.z + CONFIG.LIGHTING.dirZ); 
            this.dirLight.target.position.set(0, 0, this.player.z - CONFIG.LIGHTING.dirZ); 
            this.dirLight.target.updateMatrixWorld();
        }

        // Level Generation
        if (isWorldMoving) {
            if (this.currentState === GAME_STATE.PLAYING) {
                // Spawn new segments ahead
                if (this.player.z < this.world.nextSpawnZ + CONFIG.spawnThreshold) {
                    this.world.spawnLevelSegment();
                }
            } else if (this.currentState === GAME_STATE.TUTORIAL_MOVE) {
                // Prevent real obstacles from spawning during tutorial
                this.world.nextSpawnZ = this.player.z - CONFIG.tutorialSpawnOffset;
            }
            
            this.checkCollisions();
        }
    }

    animate() {
        this.animationFrameId = requestAnimationFrame(this.animate);
        
        const rawDt = this.clock.getDelta();
        
        // Clamp delta time to avoid large jumps if window hangs
        let dt = rawDt;
        if (dt > CONFIG.maxDeltaTime) dt = CONFIG.maxDeltaTime;
        
        this.update(dt);
        
        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    checkCollisions() {
        // Player broadphase position
        const pPos = { x: this.player.x, y: this.player.y, z: this.player.z + CONFIG.PLAYER.zOffset }; 
        const objects = this.world.activeObjects;

        // Iterate backwards because we might remove elements
        for (let i = objects.length - 1; i >= 0; i--) {
            const obj = objects[i];
            
            if (!obj.active) continue;

            const objZ = obj.mesh.position.z;

            // Despawn objects that are far behind the player
            if (objZ > this.player.z + CONFIG.POOL.cleanupDistanceZ) {
                this.pool.release(obj);
                objects[i] = objects[objects.length - 1]; // Fast array removal
                objects.pop();
                continue;
            }

            if (obj.type === 'ring') {
                obj.mesh.rotation.y += CONFIG.WORLD.ringRotationSpeed;
            }

            // Broadphase skip if object is too far forward
            if (Math.abs(objZ - pPos.z) > CONFIG.POOL.broadphaseDistZ) {
                continue; 
            }

            // Perform exact AABB (Axis-Aligned Bounding Box) collision check
            const isCollision = Utils.checkAABB(this.player.hitboxData, pPos, obj.hitboxData, obj.mesh.position);

            if (isCollision) {
                if (obj.type === 'ring') {
                    // Collect ring
                    this.pool.release(obj);
                    objects[i] = objects[objects.length - 1];
                    objects.pop();
                    
                    this.state.score += CONFIG.scorePerRing;
                    this.updateHUD();
                } else if (obj.type === 'obstacle') {
                    // Hit obstacle
                    if (!this.state.isInvincible && this.currentState !== GAME_STATE.DYING) {
                        this.takeDamage(); 
                        break; 
                    }
                }
            }
        }
    }

    takeDamage() {
        this.state.lives -= 1;
        this.updateHUD();

        if (this.state.lives <= 0) {
            this.setState(GAME_STATE.DYING);
        } else {
            this.state.isInvincible = true;
            this.state.invincibilityTimer = CONFIG.invincibilityDuration;
            this.player.performHit();
        }
    }

    updateHUD() {
        this.ui.updateHUD(this.state.score, this.state.distance, this.state.lives);
    }

    togglePause() {
        if (this.currentState === GAME_STATE.PLAYING) {
            this.setState(GAME_STATE.PAUSED);
        } else if (this.currentState === GAME_STATE.PAUSED) {
            this.setState(GAME_STATE.PLAYING);
        }
    }

    restartGameFromPause() {
        this.togglePause(); 
        this.restartGame();
    }

    restartGame() {
        // Reset state variables
        this.state.lives = CONFIG.maxLives;
        this.state.isInvincible = false;
        this.state.invincibilityTimer = 0;
        this.state.score = 0; 
        this.state.distance = 0;
        this.state.speedMultiplier = 1.0;
        
        if (!this.state.hasCompletedTutorial) {
            this.state.tutorialStep = 0;
            this.ui.setPauseButtonVisible(false); 
        } else {
            this.ui.setPauseButtonVisible(true); 
        }
        
        // Reset sub-systems
        this.ui.resetScreens();
        this.world.reset();
        this.player.reset();
        this.updateHUD();

        this.currentState = null; 
        this.setState(GAME_STATE.STARTING);
    }

    spawnTutorialObstacle(step, playerZ) {
        let key;
        if (step === 0) key = 'car_blue';
        else if (step === 1) key = 'car_red'; 
        else if (step === 2) key = 'bin'; 
        else if (step === 3) key = 'slide';
        else return;

        const z = playerZ - CONFIG.TUTORIAL.obstacleZOffset;
        if (this.assetManager.models.obstacles[key]) {
            const mesh = this.assetManager.models.obstacles[key].clone();
            const hitboxData = HITBOXES[key];
            
            mesh.position.set(0, CONFIG.groundY, z);
            this.scene.add(mesh);

            const colliderMesh = Utils.createColliderMesh(hitboxData, CONFIG.COLORS.colliderTutorial);
            colliderMesh.position.copy(mesh.position);
            this.scene.add(colliderMesh);

            // Add specifically as tutorial obstacle
            this.world.activeObjects.push({ mesh, colliderMesh, type: 'tutorial_obstacle', active: true, hitboxData: { ...hitboxData } });
        }
    }

    prepareTutorialStep() {
        if (this.state.hasCompletedTutorial) return;
        
        this.spawnTutorialObstacle(this.state.tutorialStep, this.player.z);

        setTimeout(() => {
            this.setState(GAME_STATE.TUTORIAL_INPUT);
        }, CONFIG.TUTORIAL.pauseDelay);
    }

    completeTutorialStep(nextStepDelay, finish = false) {
        this.setState(GAME_STATE.TUTORIAL_MOVE);
        
        setTimeout(() => {
            // Force player back to middle lane for subsequent jumps/slides
            if (this.state.tutorialStep <= 1) this.player.lane = 0; 
            
            setTimeout(() => {
                if (!finish) {
                    this.state.tutorialStep++;
                    this.prepareTutorialStep();
                } else {
                    // Tutorial is over
                    this.state.hasCompletedTutorial = true;
                    this.ui.hideTutorialLayer();
                    this.ui.setPauseButtonVisible(true); 
                    
                    this.world.nextSpawnZ = this.player.z - CONFIG.tutorialSpawnOffset;
                    this.setState(GAME_STATE.PLAYING);
                }
            }, nextStepDelay);
        }, CONFIG.TUTORIAL.delayLong);
    }

    destroy() {
        // Stop render loop
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        // Remove global event listeners
        window.removeEventListener('resize', this.onWindowResize);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('touchstart', this.handleTouchStart);
        window.removeEventListener('touchend', this.handleTouchEnd);
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);

        // Unbind UI elements
        if (this.ui && typeof this.ui.destroy === 'function') {
            this.ui.destroy();
        }

        // Clear video memory / dispose WebGL context to prevent memory leaks
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.forceContextLoss();
            const canvas = this.renderer.domElement;
            if (canvas && canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        }

        // Dispose geometries and materials
        if (this.scene) {
            this.scene.traverse((child) => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => this.disposeMaterial(mat));
                        } else {
                            this.disposeMaterial(child.material);
                        }
                    }
                }
            });
        }
    }

    disposeMaterial(mat) {
        mat.dispose();
        if (mat.map) mat.map.dispose();
        if (mat.normalMap) mat.normalMap.dispose();
        if (mat.roughnessMap) mat.roughnessMap.dispose();
        if (mat.metalnessMap) mat.metalnessMap.dispose();
    }
}