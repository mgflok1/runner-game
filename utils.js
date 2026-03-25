import { CONFIG, SHADER_UNIFORMS } from './config.js';

// Simple pub/sub pattern for managing events between classes
export class EventEmitter {
    constructor() {
        this.listeners = {};
    }

    on(eventName, callback) {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName].push(callback);
    }

    emit(eventName, ...args) {
        if (this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(...args));
        }
    }
}

export class Utils {
    // Injects code into Three.js default materials to dynamically bend vertices
    // Creates the illusion of a curved track like in Subway Surfers or Animal Crossing
    static applyCurveToMesh(mesh) {
        if (!mesh.isMesh) return;
        
        const shaderPatcher = (shader) => {
            shader.uniforms.uCurveSide = SHADER_UNIFORMS.uCurveSide;
            shader.uniforms.uCurveDown = SHADER_UNIFORMS.uCurveDown;
            shader.uniforms.uPlayerCameraPos = SHADER_UNIFORMS.uPlayerCameraPos;
            
            // Override the vertex shader logic 
            shader.vertexShader = `
                uniform float uCurveSide;
                uniform float uCurveDown;
                uniform vec3 uPlayerCameraPos;
                ${shader.vertexShader}
            `.replace(
                '#include <project_vertex>',
                `
                vec4 worldPosForCurve = vec4(transformed, 1.0);
                #ifdef USE_INSTANCING
                    worldPosForCurve = instanceMatrix * worldPosForCurve;
                #endif
                worldPosForCurve = modelMatrix * worldPosForCurve;
                
                // Calculate distance squared from camera
                float distZ = worldPosForCurve.z - uPlayerCameraPos.z;
                float zSq = (distZ * distZ) * ${CONFIG.WORLD.curveStrength}; 
                
                // Bend world positions
                worldPosForCurve.y -= uCurveDown * zSq;
                worldPosForCurve.x += uCurveSide * zSq;
                
                vec4 mvPosition = viewMatrix * worldPosForCurve;
                gl_Position = projectionMatrix * mvPosition;
                `
            );
        };

        if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            materials.forEach(mat => { mat.onBeforeCompile = shaderPatcher; });
        }
    }

    // Generates a simple wireframe box for collision debugging
    static createColliderMesh(hitbox, color) {
        const geo = new THREE.BoxGeometry(hitbox.w, hitbox.h, hitbox.d);
        geo.translate(0, hitbox.oy, hitbox.oz); // Offset center
        
        const mat = new THREE.MeshBasicMaterial({ color: color, wireframe: true, transparent: true, opacity: CONFIG.colliderOpacity });
        const mesh = new THREE.Mesh(geo, mat);
        
        mesh.visible = CONFIG.showColliders; 
        Utils.applyCurveToMesh(mesh); 
        return mesh;
    }

    // Standard Axis-Aligned Bounding Box (AABB) intersection check
    static checkAABB(pBox, pPos, oBox, oPos) {
        return (pPos.x - pBox.w/2 < oPos.x + oBox.w/2 &&
                pPos.x + pBox.w/2 > oPos.x - oBox.w/2 &&
                pPos.y + pBox.oy - pBox.h/2 < oPos.y + oBox.oy + oBox.h/2 &&
                pPos.y + pBox.oy + pBox.h/2 > oPos.y + oBox.oy - oBox.h/2 &&
                pPos.z + pBox.oz - pBox.d/2 < oPos.z + oBox.oz + oBox.d/2 &&
                pPos.z + pBox.oz + pBox.d/2 > oPos.z + oBox.oz - oBox.d/2);
    }
}