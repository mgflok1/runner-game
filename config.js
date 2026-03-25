export const CONFIG = {
    // Game State Configurations
    maxLives: 3,
    maxDeltaTime: 0.1,   // Cap delta time to prevent physics glitches on lag
    scorePerRing: 1,     

    // Movement & Physics
    baseSpeed: 60,
    laneWidth: 25,
    lanes: [-1, 0, 1],   // Left, Center, Right lanes
    jumpForce: 120,
    fastFallForce: -400, // Force applied when swiping down mid-air
    gravity: -250,
    groundY: 0,
    laneSwitchSpeed: 8,  // Smoothness of lane transitions
    
    // Level Generation
    segmentLength: 100, 
    segmentCount: 15,
    spawnDistance: 160, 
    ringSpacing: 25,
    spawnThreshold: 1200,    // Distance ahead of player to spawn new objects
    tutorialSpawnOffset: 250,
    roadSegmentOffset: 10,   
    initialSpawnZ: -250,   
    
    // Difficulty Progression
    speedIncreaseRate: 0.015, 
    maxSpeedMultiplier: 5,
    distanceDivisor: 10,     // Convert Z coordinates to distance metric
    
    // Debug & Visuals
    showColliders: false,    // Set to true to see hitboxes
    globalScale: 8.5,
    playerScale: 0.15,
    invincibilityDuration: 2.0, // Seconds of invincibility after getting hit
    blinkRate: 15,              // Blinking speed during invincibility
    ringEmissiveIntensity: 0.2, 
    colliderOpacity: 0.8,       

    // Colors
    COLORS: {
        background: 0x87CEEB,
        fog: 0x87CEEB,
        hemiLightSky: 0xffffff,
        hemiLightGround: 0x444444,
        dirLight: 0xffffff,
        ring: 0xFFD700,
        ringEmissive: 0x886600,
        obstacleFallback: 0xcc3333,
        roadFallback: 0x888888,
        colliderPlayer: 0x00ff00,
        colliderRing: 0xffff00,
        colliderTutorial: 0xff0000,
        colliderObstacle: 0xff0000
    },

    // Graphics & Lighting
    GRAPHICS: {
        maxPixelRatio: 2,
        fogNear: 100,
        fogFar: 800,
        hemiLightIntensity: 1.0,
        dirLightIntensity: 0.5,
        catMetalness: 0.0,
        catRoughness: 0.8
    },

    // Camera Settings (Follows the player)
    CAMERA: {
        fov: 60,
        near: 5.0,
        far: 750,
        offsetY: 30,
        offsetZ: 45,
        lookAtY: 5,
        lookAtZ: -150
    },

    // Directional Lighting Position Relative to Player
    LIGHTING: {
        dirY: 80,
        dirZ: 40,
    },

    // Player & Animations
    PLAYER: {
        zOffset: -40,
        runRotationX: 0.2,     // Slight tilt while running
        fadeSlow: 0.2,         // Animation crossfade durations
        fadeFast: 0.1,
        slideHitboxDivisor: 2, // Shrinks height of hitbox during slide
        slideScaleY: 0.5,
        normalScaleY: 1.0
    },

    // World & Shader Curves
    WORLD: {
        curveUpdateInterval: 4.0, // How often the road changes direction
        curveLerpSpeed: 0.025,
        curveMaxVariance: 7,     
        curveStrength: 0.0001,    // Shader bending intensity
        ringRotationSpeed: 0.05,
        ringInitialRotation: Math.PI / 2, 
        ringY: 10,
        roadFallbackWidthMultiplier: 4,
        ringPatternMinCount: 3,
        ringPatternRandomCount: 3
    },

    // Spawn Probabilities
    PROBABILITY: {
        doubleObstacle: 0.30,
        ringWithDouble: 0.30,
        singleObstacle: 0.75,
        ringWithSingle: 0.80,
        doubleRing: 0.60
    },

    // Tutorial & UI Settings
    TUTORIAL: {
        swipeThreshold: 30,
        delayShort: 500,
        delayLong: 1200,
        pauseDelay: 1000,
        uiHideDelay: 800,
        obstacleZOffset: 140
    },

    // Object Pool Limits (Optimization)
    POOL: {
        ringPrewarm: 30,
        obstaclePrewarm: 10,
        hiddenY: -1000,        // Position to hide inactive objects
        cleanupDistanceZ: 20,  // Distance behind player to despawn
        broadphaseDistZ: 30,   // Collision check distance limit
        ringScale: 2,
        fallbackGeoSize: 10
    }
};

// Hitbox dimensions for collision detection
export const HITBOXES = {
    player:   { w: 9,  h: 15, d: 10, oy: 7.5, oz: 0 },
    ring:     { w: 5,  h: 5,  d: 8,  oy: 0,   oz: 0 },
    bin:      { w: 20, h: 17, d: 5,  oy: 8,   oz: 0 },
    car_blue: { w: 15, h: 13, d: 25, oy: 10,  oz: 0 },
    car_red:  { w: 15, h: 13, d: 25, oy: 7.5, oz: 0 },
    slide:    { w: 20, h: 7,  d: 5,  oy: 12,  oz: 0 },
    fallback: { w: 10, h: 10, d: 10, oy: 5,   oz: 0 }
};

// Global shader variables updated every frame
export const SHADER_UNIFORMS = {
    uCurveSide: { value: 0.0 }, // Left/Right bend
    uCurveDown: { value: 1.5 }, // Hill curve
    uPlayerCameraPos: { value: new THREE.Vector3() } // View distance reference
};