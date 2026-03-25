import { CONFIG, HITBOXES } from './config.js';
import { Utils, EventEmitter } from './utils.js';

export class Player extends EventEmitter {
    constructor(scene, assetManager) {
        super(); 
        this.scene = scene;
        this.assets = assetManager;
        
        this.lane = 0; // -1, 0, or 1
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vy = 0; // Vertical velocity
        
        this.isJumping = false;
        this.isSliding = false;
        this.actionReady = true;

        this.mesh = null;
        this.mixer = null;
        this.hitboxData = null;
        this.colliderMesh = null;
        
        this.actions = {}; // Holds Three.js AnimationActions
        
        this.internalIsDying = false; 
    }

    init() {
        this.hitboxData = { ...HITBOXES.player }; 
        this.colliderMesh = Utils.createColliderMesh(this.hitboxData, CONFIG.COLORS.colliderPlayer);
        this.scene.add(this.colliderMesh);

        const catBase = this.assets.models.catBase;
        if (catBase) {
            this.mesh = catBase;
            this.mixer = new THREE.AnimationMixer(this.mesh);
            
            // Helper to configure animations
            const setupAction = (anim, loop = false) => {
                if(!anim) return null;
                const action = this.mixer.clipAction(anim);
                if(!loop) {
                    action.setLoop(THREE.LoopOnce, 1);
                    action.clampWhenFinished = true;
                }
                return action;
            };

            this.actions.start = setupAction(this.assets.animations.start);
            this.actions.run = setupAction(this.assets.animations.run, true);
            this.actions.jump = setupAction(this.assets.animations.jump);
            this.actions.death = setupAction(this.assets.animations.death);
            this.actions.slide = setupAction(this.assets.animations.slide);
            this.actions.hit = setupAction(this.assets.animations.hit);

            // Listener for animation completion
            this.mixer.addEventListener('finished', (e) => {
                if (e.action === this.actions.start) {
                    this.actions.start.fadeOut(CONFIG.PLAYER.fadeSlow); 
                    if (this.actions.run) this.actions.run.reset().fadeIn(CONFIG.PLAYER.fadeSlow).play();
                    this.emit('startAnimationFinished'); // Notify the game state
                }
                if (e.action === this.actions.death) {
                    this.emit('deathAnimationFinished'); // Notify the game state
                }
                if (e.action === this.actions.slide) {
                    this.isSliding = false; 
                    this.actionReady = true; 
                    this.actions.slide.fadeOut(CONFIG.PLAYER.fadeSlow); 
                    if (this.actions.run && !this.internalIsDying) this.actions.run.reset().fadeIn(CONFIG.PLAYER.fadeSlow).play(); 
                    
                    // Reset hitbox height after slide
                    this.hitboxData.h = HITBOXES.player.h;
                    this.hitboxData.oy = HITBOXES.player.oy;
                    if (this.colliderMesh) this.colliderMesh.scale.y = CONFIG.PLAYER.normalScaleY;
                }
                if (e.action === this.actions.hit) {
                    this.actions.hit.fadeOut(CONFIG.PLAYER.fadeSlow); 
                    if (this.actions.run && !this.internalIsDying) this.actions.run.reset().fadeIn(CONFIG.PLAYER.fadeSlow).play(); 
                }
            });

            this.mesh.scale.set(CONFIG.playerScale, CONFIG.playerScale, CONFIG.playerScale); 
            this.mesh.rotation.y = Math.PI; // Face the camera
            
            // Apply materials and curved shader to the model
            this.mesh.traverse(child => {
                if (child.isMesh) {
                    if (child.material) {
                        if (child.material.isMeshStandardMaterial) {
                            child.material.metalness = CONFIG.GRAPHICS.catMetalness; 
                            child.material.roughness = CONFIG.GRAPHICS.catRoughness;
                        } else if (child.material.isMeshBasicMaterial) {
                            const oldMat = child.material;
                            // Need skinning: true for animated characters
                            child.material = new THREE.MeshPhongMaterial({
                                color: oldMat.color, map: oldMat.map, skinning: true 
                            });
                        }
                        child.material.needsUpdate = true;
                    }
                    Utils.applyCurveToMesh(child); 
                }
            });

            this.scene.add(this.mesh);
        }
    }

    startInitialAnimation() {
        if (this.actions.start) {
            this.actions.start.play();
        } else if (this.actions.run) {
            this.actions.run.play();
            this.emit('startAnimationFinished');
        }
    }

    reset() {
        if (this.mesh) this.mesh.visible = true;
        this.internalIsDying = false;
        this.isJumping = false; 
        this.isSliding = false; 
        this.actionReady = true;
        this.z = 0; this.x = 0; this.lane = 0; this.vy = 0;
        
        // Restore standard hitbox
        this.hitboxData.h = HITBOXES.player.h;
        this.hitboxData.oy = HITBOXES.player.oy;
        if(this.colliderMesh) this.colliderMesh.scale.y = CONFIG.PLAYER.normalScaleY;

        if(this.assets.models.catBase) {
            this.actions.jump?.stop();
            this.actions.run?.stop();
            this.actions.death?.stop(); 
            this.actions.slide?.stop();
            this.actions.hit?.stop();
            
            if (this.actions.start) {
                this.actions.start.reset().play();
            } else if (this.actions.run) {
                this.actions.run.reset().play();
                this.emit('startAnimationFinished');
            }
        }
    }

    performJump() {
        if (this.isJumping) return;
        
        // Cancel slide if jumping
        if (this.isSliding) {
            this.isSliding = false;
            this.hitboxData.h = HITBOXES.player.h;
            this.hitboxData.oy = HITBOXES.player.oy;
            if (this.colliderMesh) this.colliderMesh.scale.y = CONFIG.PLAYER.normalScaleY;
            if (this.actions.slide) this.actions.slide.fadeOut(CONFIG.PLAYER.fadeFast);
        }

        this.vy = CONFIG.jumpForce; 
        this.isJumping = true; 
        
        if (this.mesh && this.actions.jump) {
            if (this.actions.run) this.actions.run.fadeOut(CONFIG.PLAYER.fadeFast);
            this.actions.jump.reset().fadeIn(CONFIG.PLAYER.fadeFast).play();
        }
    }

    performSlide() {
        if (this.isSliding) return;
        
        // Fast fall if swiping down while in air
        if (this.isJumping) {
            this.vy = CONFIG.fastFallForce;
            if (this.actions.jump) this.actions.jump.fadeOut(CONFIG.PLAYER.fadeFast);
        }

        this.isSliding = true; 
        // Squish the hitbox dynamically
        this.hitboxData.h = HITBOXES.player.h / CONFIG.PLAYER.slideHitboxDivisor; 
        this.hitboxData.oy = HITBOXES.player.oy / CONFIG.PLAYER.slideHitboxDivisor;
        if (this.colliderMesh) this.colliderMesh.scale.y = CONFIG.PLAYER.slideScaleY;
        
        if (this.mesh && this.actions.slide) {
            if (this.actions.run && !this.isJumping) this.actions.run.fadeOut(CONFIG.PLAYER.fadeFast);
            this.actions.slide.reset().fadeIn(CONFIG.PLAYER.fadeFast).play();
        }
    }

    performHit() {
        if (this.actions.run) this.actions.run.fadeOut(CONFIG.PLAYER.fadeFast);
        if (this.actions.jump) this.actions.jump.fadeOut(CONFIG.PLAYER.fadeFast);
        
        // Reset slide state if taking damage mid-slide
        if (this.isSliding) {
            this.isSliding = false;
            if (this.actions.slide) this.actions.slide.fadeOut(CONFIG.PLAYER.fadeFast);
            this.hitboxData.h = HITBOXES.player.h;
            this.hitboxData.oy = HITBOXES.player.oy;
            if (this.colliderMesh) this.colliderMesh.scale.y = 1.0;
        }
        
        this.isJumping = false;

        if (this.mesh && this.actions.hit) {
            this.actions.hit.reset().fadeIn(CONFIG.PLAYER.fadeFast).play();
        }
    }

    triggerDeath() {
        this.internalIsDying = true;
        if (this.mesh && this.actions.death) {
            this.actions.run?.fadeOut(CONFIG.PLAYER.fadeFast);
            this.actions.jump?.fadeOut(CONFIG.PLAYER.fadeFast);
            this.actions.slide?.fadeOut(CONFIG.PLAYER.fadeFast); 
            this.actions.death.reset().fadeIn(CONFIG.PLAYER.fadeFast).play();
        } else {
            this.emit('deathAnimationFinished');
        }
    }

    update(dt, speedMultiplier, isWorldMoving, isPaused, isAnimFrozen, isStarting, isDying) {
        // Freeze animations during specific tutorial states
        if (this.actions.run && !isStarting && !isDying) {
            const scale = isAnimFrozen ? 0 : 1.0;
            this.actions.run.timeScale = scale;
            if (this.actions.slide) this.actions.slide.timeScale = scale; 
            if (this.actions.jump) this.actions.jump.timeScale = scale; 
        }

        // Forward movement and lateral interpolation
        if (isWorldMoving) {
            this.z -= CONFIG.baseSpeed * dt * speedMultiplier;
            const targetX = this.lane * CONFIG.laneWidth;
            this.x = THREE.MathUtils.lerp(this.x, targetX, CONFIG.laneSwitchSpeed * dt);
        }

        // Apply physics (gravity)
        if (!isPaused) {
            this.vy += CONFIG.gravity * dt;
            this.y += this.vy * dt;
       
            // Floor collision
            if (this.y <= CONFIG.groundY) { 
                if (this.isJumping) {
                    this.isJumping = false;
                    // Resume running animation upon landing
                    if (!this.isSliding && this.mesh && this.actions.run && !isDying) {
                        if (this.actions.jump) this.actions.jump.fadeOut(CONFIG.PLAYER.fadeSlow); 
                        this.actions.run.reset().fadeIn(CONFIG.PLAYER.fadeSlow).play(); 
                    }
                }
                this.y = CONFIG.groundY; 
                this.vy = 0; 
            }
        }

        // Apply positions to meshes
        if (this.mesh) {
            const zOffset = CONFIG.PLAYER.zOffset;
            this.mesh.position.set(this.x, this.y, this.z + zOffset);
            if (this.mixer && !isPaused) this.mixer.update(dt);
            if (!this.isJumping && !isDying) this.mesh.rotation.x = CONFIG.PLAYER.runRotationX;
        }
        if (this.colliderMesh) this.colliderMesh.position.copy(this.mesh.position);
    }
}