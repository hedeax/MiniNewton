/*
 * MiniNewton Enhanced - 2D Physics Engine for After Effects
 * Inspired by Newton 4 - Comprehensive mini version with core features
 * 
 * Key Features:
 * - Multiple body types (Dynamic, Static, Kinematic)
 * - Physics properties (Density, Friction, Restitution, Damping)
 * - Joint system (Distance, Pivot, Weld, Spring)
 * - Material presets and collision groups
 * - Proper Box2D-inspired physics scaling (100px = 1m)
 * - Contact detection and export
 */

(function(thisObj) {
    "use strict";

    // Constants and Settings
    var PIXELS_TO_METERS = 100; // Newton 4 scale: 100px = 1m
    var DEFAULT_SETTINGS = {
        gravity: 980,
        gravityVector: [0, 980],
        bounce: 0.8,
        floorY: 1000,
        duration: 5,
        frameRate: 30,
        damping: 0.99,
        friction: 0.3,
        material: 'default',
        enableInterBodyCollision: true,
        enableSleeping: true,
        collisionTolerance: 1.0,
        timeScale: 1.0
    };

    // Body Types (inspired by Newton 4)
    var BODY_TYPES = {
        DYNAMIC: 'dynamic',     // Fully physics-driven
        STATIC: 'static',       // Immovable (walls, anchors)
        KINEMATIC: 'kinematic'  // Animated but can affect others
    };

    // Joint Types
    var JOINT_TYPES = {
        DISTANCE: 'distance',   // Fixed distance constraint
        PIVOT: 'pivot',         // Hinge/rotation point
        WELD: 'weld',          // Rigid connection
        SPRING: 'spring'        // Elastic connection
    };

    // Collision Groups (5 groups like Newton 4)
    var COLLISION_GROUPS = {
        GROUP_A: 1,
        GROUP_B: 2,
        GROUP_C: 4,
        GROUP_D: 8,
        GROUP_E: 16,
        ALL: 31 // Binary: 11111
    };

    // Utility Functions
    var Utils = {
        log: function(message) {
            if (typeof $.writeln !== "undefined") {
                $.writeln("[MiniNewton] " + message);
            }
        },
        
        showError: function(message) {
            alert("MiniNewton Error:\n" + message);
            this.log("ERROR: " + message);
        },
        
        showInfo: function(message) {
            alert("MiniNewton:\n" + message);
            this.log("INFO: " + message);
        },
        
        getActiveComp: function() {
            if (!app.project) return null;
            return app.project.activeItem;
        },
        
        validateComp: function(comp) {
            if (!comp) return "No active composition";
            if (!(comp instanceof CompItem)) return "Active item is not a composition";
            return null;
        },
        
        isValidPhysicsLayer: function(layer) {
            try {
                if (!layer.enabled) return false;
                if (layer.hasAudio && !layer.hasVideo) return false; // Audio-only layers
                if (layer.threeDLayer) return false; // 3D layers not supported
                if (layer.guide) return false; // Guide layers
                
                var transform = layer.property("Transform");
                if (!transform) return false;
                var position = transform.property("Position");
                if (!position) return false;
                
                return true;
            } catch (error) {
                this.log("Layer validation error: " + error.message);
                return false;
            }
        },
        
        clamp: function(value, min, max) {
            return Math.max(min, Math.min(max, value));
        },
        
        distance: function(x1, y1, x2, y2) {
            var dx = x2 - x1;
            var dy = y2 - y1;
            return Math.sqrt(dx * dx + dy * dy);
        },
        
        normalize: function(vector) {
            var length = Math.sqrt(vector[0] * vector[0] + vector[1] * vector[1]);
            if (length > 0) {
                return [vector[0] / length, vector[1] / length];
            }
            return [0, 0];
        },
        
        // Convert AE pixels to Box2D meters
        pixelsToMeters: function(pixels) {
            return pixels / PIXELS_TO_METERS;
        },
        
        // Convert Box2D meters to AE pixels
        metersToPixels: function(meters) {
            return meters * PIXELS_TO_METERS;
        }
    };

    // Enhanced Physics Engine
    var Physics = {
        // Material definitions (Newton 4 inspired)
        materials: {
            'rubber': { density: 0.9, restitution: 0.9, friction: 0.7, color: [1, 0.8, 0] },
            'metal': { density: 7.8, restitution: 0.3, friction: 0.1, color: [0.7, 0.7, 0.8] },
            'wood': { density: 0.6, restitution: 0.5, friction: 0.8, color: [0.8, 0.6, 0.3] },
            'ice': { density: 0.92, restitution: 0.1, friction: 0.02, color: [0.8, 0.9, 1] },
            'concrete': { density: 2.4, restitution: 0.2, friction: 0.9, color: [0.6, 0.6, 0.6] },
            'glass': { density: 2.5, restitution: 0.1, friction: 0.4, color: [0.9, 0.9, 0.9] },
            'default': { density: 1.0, restitution: 0.8, friction: 0.3, color: [0.5, 0.7, 1] }
        },

        createBody: function(layer, settings, bodyType) {
            if (!layer) return null;
            
            try {
                var transform = layer.property("Transform");
                var position = transform.property("Position").value;
                var rotation = transform.property("Rotation").value;
                var scale = transform.property("Scale").value;
                
                // Calculate body dimensions
                var width = layer.width * scale[0] / 100;
                var height = layer.height * scale[1] / 100;
                
                // Calculate mass based on area and density (Newton 4 style)
                var area = Utils.pixelsToMeters(width) * Utils.pixelsToMeters(height);
                var materialProps = this.materials[settings.material] || this.materials['default'];
                var baseMass = Math.max(area * materialProps.density, 0.1);
                
                var body = {
                    // Core properties
                    id: Date.now() + Math.random(), // Unique ID
                    layer: layer,
                    type: bodyType || BODY_TYPES.DYNAMIC,
                    
                    // Transform
                    originalPosition: [position[0], position[1]],
                    position: [position[0], position[1]],
                    velocity: [0, 0],
                    acceleration: [0, 0],
                    
                    // Rotation
                    originalRotation: rotation,
                    rotation: rotation,
                    angularVelocity: 0,
                    angularAcceleration: 0,
                    
                    // Physical properties
                    mass: baseMass,
                    density: materialProps.density,
                    width: width,
                    height: height,
                    
                    // Material properties
                    restitution: settings.bounce !== undefined ? settings.bounce : materialProps.restitution,
                    friction: settings.friction !== undefined ? settings.friction : materialProps.friction,
                    material: settings.material || 'default',
                    color: materialProps.color,
                    
                    // State flags
                    isGrounded: false,
                    isSleeping: false,
                    sleepTimer: 0,
                    fixedRotation: false,
                    
                    // Advanced properties (Newton 4 features)
                    gravityScale: 1.0,
                    linearDamping: 0.01,
                    angularDamping: 0.05,
                    collisionGroup: COLLISION_GROUPS.GROUP_A,
                    collidesWith: COLLISION_GROUPS.ALL,
                    hidden: false,
                    
                    // Contact tracking
                    contacts: [],
                    contactCount: 0,
                    
                    // Initial velocity (can be set)
                    initialVelocity: [0, 0],
                    initialAngularVelocity: 0
                };
                
                // Apply initial velocity if set
                body.velocity = [body.initialVelocity[0], body.initialVelocity[1]];
                body.angularVelocity = body.initialAngularVelocity;
                
                return body;
                
            } catch (error) {
                Utils.log("Error creating body for layer " + layer.name + ": " + error.message);
                return null;
            }
        },

        applyGravity: function(body, gravityVector, deltaTime) {
            if (body.type !== BODY_TYPES.DYNAMIC) return;
            if (body.isGrounded && gravityVector[1] > 0) return;
            if (body.gravityScale === 0) return;
            
            // Apply gravity with gravity scale (Newton 4 feature)
            var scaledGravity = [
                gravityVector[0] * body.gravityScale,
                gravityVector[1] * body.gravityScale
            ];
            
            body.acceleration[0] += scaledGravity[0];
            body.acceleration[1] += scaledGravity[1];
        },

        applyDamping: function(body, globalDamping) {
            if (body.type !== BODY_TYPES.DYNAMIC) return;
            
            // Apply both global and body-specific damping
            var totalLinearDamping = globalDamping * (1 - body.linearDamping);
            var totalAngularDamping = globalDamping * (1 - body.angularDamping);
            
            body.velocity[0] *= totalLinearDamping;
            body.velocity[1] *= totalLinearDamping;
            body.angularVelocity *= totalAngularDamping;
        },

        updatePosition: function(body, deltaTime) {
            if (body.type === BODY_TYPES.STATIC) return;
            if (body.isSleeping) return;
            
            // Update velocity from acceleration
            body.velocity[0] += body.acceleration[0] * deltaTime;
            body.velocity[1] += body.acceleration[1] * deltaTime;
            
            // Update angular velocity
            body.angularVelocity += body.angularAcceleration * deltaTime;
            
            // Update position from velocity
            body.position[0] += body.velocity[0] * deltaTime;
            body.position[1] += body.velocity[1] * deltaTime;
            
            // Update rotation (if not fixed)
            if (!body.fixedRotation) {
                body.rotation += body.angularVelocity * deltaTime;
            }
            
            // Clear accelerations
            body.acceleration[0] = 0;
            body.acceleration[1] = 0;
            body.angularAcceleration = 0;
        },

        checkFloorCollision: function(body, floorY, globalBounce, settings) {
            if (body.type === BODY_TYPES.STATIC) return;
            
            var bodyBottom = body.position[1] + (body.height / 2);
            var tolerance = settings.collisionTolerance || 1.0;
            
            if (bodyBottom >= floorY - tolerance) {
                // Position correction
                body.position[1] = floorY - (body.height / 2);
                
                // Collision response
                if (body.velocity[1] > 0) {
                    var bounceForce = body.restitution * globalBounce;
                    body.velocity[1] = -body.velocity[1] * bounceForce;
                    
                    // Add contact to tracking
                    body.contacts.push({
                        time: Date.now(),
                        type: 'floor',
                        position: [body.position[0], body.position[1]],
                        impulse: Math.abs(body.velocity[1])
                    });
                    body.contactCount++;
                    
                    // Add rotation on impact
                    var impactStrength = Math.abs(body.velocity[1]);
                    if (!body.fixedRotation) {
                        body.angularVelocity += (Math.random() - 0.5) * impactStrength * 0.1;
                    }
                    
                    // Check for sleep state
                    if (Math.abs(body.velocity[1]) < 5) {
                        body.velocity[1] = 0;
                        body.isGrounded = true;
                    }
                }
                
                // Apply ground friction
                if (body.isGrounded) {
                    var frictionForce = body.friction * 0.8;
                    body.velocity[0] *= (1 - frictionForce);
                    if (!body.fixedRotation) {
                        body.angularVelocity *= 0.9;
                    }
                }
            } else {
                body.isGrounded = false;
            }
        },

        checkBodyCollision: function(bodyA, bodyB, settings) {
            // Check collision groups
            if (!(bodyA.collisionGroup & bodyB.collidesWith) || 
                !(bodyB.collisionGroup & bodyA.collidesWith)) {
                return false;
            }
            
            // Simple AABB collision detection
            var aLeft = bodyA.position[0] - bodyA.width / 2;
            var aRight = bodyA.position[0] + bodyA.width / 2;
            var aTop = bodyA.position[1] - bodyA.height / 2;
            var aBottom = bodyA.position[1] + bodyA.height / 2;
            
            var bLeft = bodyB.position[0] - bodyB.width / 2;
            var bRight = bodyB.position[0] + bodyB.width / 2;
            var bTop = bodyB.position[1] - bodyB.height / 2;
            var bBottom = bodyB.position[1] + bodyB.height / 2;
            
            var tolerance = settings.collisionTolerance || 1.0;
            
            if (aLeft < bRight + tolerance && aRight > bLeft - tolerance &&
                aTop < bBottom + tolerance && aBottom > bTop - tolerance) {
                
                this.resolveCollision(bodyA, bodyB, settings);
                return true;
            }
            
            return false;
        },

        resolveCollision: function(bodyA, bodyB, settings) {
            if (bodyA.type === BODY_TYPES.STATIC && bodyB.type === BODY_TYPES.STATIC) return;
            
            // Calculate collision normal and depth
            var dx = bodyB.position[0] - bodyA.position[0];
            var dy = bodyB.position[1] - bodyA.position[1];
            var distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance === 0) return; // Avoid division by zero
            
            var normal = [dx / distance, dy / distance];
            
            // Separate bodies
            var overlapX = (bodyA.width + bodyB.width) / 2 - Math.abs(dx);
            var overlapY = (bodyA.height + bodyB.height) / 2 - Math.abs(dy);
            
            if (overlapX > 0 && overlapY > 0) {
                var separationX = overlapX * 0.5 * Math.sign(dx);
                var separationY = overlapY * 0.5 * Math.sign(dy);
                
                if (bodyA.type === BODY_TYPES.DYNAMIC) {
                    bodyA.position[0] -= separationX;
                    bodyA.position[1] -= separationY;
                }
                if (bodyB.type === BODY_TYPES.DYNAMIC) {
                    bodyB.position[0] += separationX;
                    bodyB.position[1] += separationY;
                }
                
                // Apply collision impulse
                var relativeVelocity = [
                    bodyB.velocity[0] - bodyA.velocity[0],
                    bodyB.velocity[1] - bodyA.velocity[1]
                ];
                
                var velocityAlongNormal = relativeVelocity[0] * normal[0] + relativeVelocity[1] * normal[1];
                
                if (velocityAlongNormal > 0) return; // Objects separating
                
                var restitution = Math.min(bodyA.restitution, bodyB.restitution);
                var impulseScalar = -(1 + restitution) * velocityAlongNormal;
                impulseScalar /= (1/bodyA.mass + 1/bodyB.mass);
                
                var impulse = [impulseScalar * normal[0], impulseScalar * normal[1]];
                
                if (bodyA.type === BODY_TYPES.DYNAMIC) {
                    bodyA.velocity[0] -= impulse[0] / bodyA.mass;
                    bodyA.velocity[1] -= impulse[1] / bodyA.mass;
                }
                if (bodyB.type === BODY_TYPES.DYNAMIC) {
                    bodyB.velocity[0] += impulse[0] / bodyB.mass;
                    bodyB.velocity[1] += impulse[1] / bodyB.mass;
                }
                
                // Record contacts
                bodyA.contacts.push({
                    time: Date.now(),
                    type: 'body',
                    other: bodyB.id,
                    position: [(bodyA.position[0] + bodyB.position[0]) / 2, (bodyA.position[1] + bodyB.position[1]) / 2],
                    impulse: Math.sqrt(impulse[0] * impulse[0] + impulse[1] * impulse[1])
                });
                bodyA.contactCount++;
                
                bodyB.contacts.push({
                    time: Date.now(),
                    type: 'body',
                    other: bodyA.id,
                    position: [(bodyA.position[0] + bodyB.position[0]) / 2, (bodyA.position[1] + bodyB.position[1]) / 2],
                    impulse: Math.sqrt(impulse[0] * impulse[0] + impulse[1] * impulse[1])
                });
                bodyB.contactCount++;
            }
        },

        updateSleepState: function(body, deltaTime) {
            if (body.type !== BODY_TYPES.DYNAMIC) return;
            
            var velocityThreshold = 3;
            var angularThreshold = 0.05;
            var sleepTimeout = 1.0;
            
            var totalVelocity = Math.sqrt(body.velocity[0] * body.velocity[0] + body.velocity[1] * body.velocity[1]);
            
            if (totalVelocity < velocityThreshold && Math.abs(body.angularVelocity) < angularThreshold) {
                body.sleepTimer += deltaTime;
                if (body.sleepTimer > sleepTimeout) {
                    body.isSleeping = true;
                    body.velocity = [0, 0];
                    body.angularVelocity = 0;
                }
            } else {
                body.sleepTimer = 0;
                body.isSleeping = false;
            }
        }
    };

    // Joint System (Newton 4 inspired)
    var Joints = {
        joints: [],
        
        createJoint: function(bodyA, bodyB, type, options) {
            options = options || {};
            
            var joint = {
                id: Date.now() + Math.random(),
                type: type,
                bodyA: bodyA,
                bodyB: bodyB,
                
                // Common properties
                anchorA: options.anchorA || [0, 0],
                anchorB: options.anchorB || [0, 0],
                collideConnected: options.collideConnected || false,
                
                // Type-specific properties
                targetDistance: 0,
                stiffness: options.stiffness || 1.0,
                damping: options.damping || 0.1,
                
                // Motor properties (for pivot joints)
                motorEnabled: options.motorEnabled || false,
                motorSpeed: options.motorSpeed || 0,
                maxMotorTorque: options.maxMotorTorque || 1000,
                
                // Limits (for pivot joints)
                enableLimits: options.enableLimits || false,
                lowerLimit: options.lowerLimit || -Math.PI,
                upperLimit: options.upperLimit || Math.PI
            };
            
            // Calculate initial distance for distance joints
            if (type === JOINT_TYPES.DISTANCE) {
                joint.targetDistance = options.targetDistance || 
                    Utils.distance(bodyA.position[0], bodyA.position[1], bodyB.position[0], bodyB.position[1]);
            }
            
            this.joints.push(joint);
            Utils.log("Created " + type + " joint between " + bodyA.layer.name + " and " + bodyB.layer.name);
            
            return joint;
        },
        
        updateJoints: function(deltaTime) {
            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                
                switch (joint.type) {
                    case JOINT_TYPES.DISTANCE:
                        this.updateDistanceJoint(joint, deltaTime);
                        break;
                    case JOINT_TYPES.SPRING:
                        this.updateSpringJoint(joint, deltaTime);
                        break;
                    case JOINT_TYPES.PIVOT:
                        this.updatePivotJoint(joint, deltaTime);
                        break;
                    case JOINT_TYPES.WELD:
                        this.updateWeldJoint(joint, deltaTime);
                        break;
                }
            }
        },
        
        updateDistanceJoint: function(joint, deltaTime) {
            var bodyA = joint.bodyA;
            var bodyB = joint.bodyB;
            
            var dx = bodyB.position[0] - bodyA.position[0];
            var dy = bodyB.position[1] - bodyA.position[1];
            var currentDistance = Math.sqrt(dx * dx + dy * dy);
            
            if (currentDistance === 0) return;
            
            var difference = currentDistance - joint.targetDistance;
            var correctionFactor = difference * joint.stiffness * 0.5;
            
            var normalX = dx / currentDistance;
            var normalY = dy / currentDistance;
            
            var correctionX = normalX * correctionFactor;
            var correctionY = normalY * correctionFactor;
            
            if (bodyA.type === BODY_TYPES.DYNAMIC) {
                bodyA.position[0] += correctionX;
                bodyA.position[1] += correctionY;
            }
            if (bodyB.type === BODY_TYPES.DYNAMIC) {
                bodyB.position[0] -= correctionX;
                bodyB.position[1] -= correctionY;
            }
        },
        
        updateSpringJoint: function(joint, deltaTime) {
            var bodyA = joint.bodyA;
            var bodyB = joint.bodyB;
            
            var dx = bodyB.position[0] - bodyA.position[0];
            var dy = bodyB.position[1] - bodyA.position[1];
            var currentDistance = Math.sqrt(dx * dx + dy * dy);
            
            if (currentDistance === 0) return;
            
            var springForce = (currentDistance - joint.targetDistance) * joint.stiffness;
            var dampingForce = joint.damping;
            
            var normalX = dx / currentDistance;
            var normalY = dy / currentDistance;
            
            var forceX = normalX * springForce;
            var forceY = normalY * springForce;
            
            if (bodyA.type === BODY_TYPES.DYNAMIC) {
                bodyA.acceleration[0] += forceX / bodyA.mass;
                bodyA.acceleration[1] += forceY / bodyA.mass;
                bodyA.velocity[0] *= (1 - dampingForce);
                bodyA.velocity[1] *= (1 - dampingForce);
            }
            if (bodyB.type === BODY_TYPES.DYNAMIC) {
                bodyB.acceleration[0] -= forceX / bodyB.mass;
                bodyB.acceleration[1] -= forceY / bodyB.mass;
                bodyB.velocity[0] *= (1 - dampingForce);
                bodyB.velocity[1] *= (1 - dampingForce);
            }
        },
        
        updatePivotJoint: function(joint, deltaTime) {
            // Simplified pivot joint - keeps bodies at same relative position
            var bodyA = joint.bodyA;
            var bodyB = joint.bodyB;
            
            var targetX = bodyA.position[0] + joint.anchorA[0];
            var targetY = bodyA.position[1] + joint.anchorA[1];
            
            var dx = targetX - (bodyB.position[0] + joint.anchorB[0]);
            var dy = targetY - (bodyB.position[1] + joint.anchorB[1]);
            
            var correctionFactor = joint.stiffness * 0.5;
            
            if (bodyB.type === BODY_TYPES.DYNAMIC) {
                bodyB.position[0] += dx * correctionFactor;
                bodyB.position[1] += dy * correctionFactor;
            }
        },
        
        updateWeldJoint: function(joint, deltaTime) {
            // Rigid connection - bodies move as one
            var bodyA = joint.bodyA;
            var bodyB = joint.bodyB;
            
            if (bodyA.type === BODY_TYPES.STATIC && bodyB.type === BODY_TYPES.DYNAMIC) {
                // B follows A
                bodyB.position[0] = bodyA.position[0] + joint.anchorA[0];
                bodyB.position[1] = bodyA.position[1] + joint.anchorA[1];
                bodyB.velocity[0] = 0;
                bodyB.velocity[1] = 0;
            } else if (bodyB.type === BODY_TYPES.STATIC && bodyA.type === BODY_TYPES.DYNAMIC) {
                // A follows B
                bodyA.position[0] = bodyB.position[0] + joint.anchorB[0];
                bodyA.position[1] = bodyB.position[1] + joint.anchorB[1];
                bodyA.velocity[0] = 0;
                bodyA.velocity[1] = 0;
            }
        },
        
        removeJoint: function(jointId) {
            for (var i = this.joints.length - 1; i >= 0; i--) {
                if (this.joints[i].id === jointId) {
                    this.joints.splice(i, 1);
                    Utils.log("Removed joint: " + jointId);
                    return true;
                }
            }
            return false;
        },
        
        clearAllJoints: function() {
            this.joints = [];
            Utils.log("Cleared all joints");
        }
    };

    // Enhanced MiniNewton Core Engine
    var MiniNewton = {
        settings: DEFAULT_SETTINGS,
        bodies: [],
        joints: [],
        simulationData: [],
        contactData: [],
        isSimulating: false,
        
        init: function(customSettings) {
            if (customSettings) {
                for (var key in customSettings) {
                    if (this.settings.hasOwnProperty(key)) {
                        this.settings[key] = customSettings[key];
                    }
                }
            }
            
            // Initialize gravity vector if only gravity magnitude is provided
            if (typeof this.settings.gravity === 'number') {
                this.settings.gravityVector = [0, this.settings.gravity];
            }
            
            Utils.log("MiniNewton Enhanced initialized with Box2D-style physics");
            return this;
        },
        
        addBodiesFromSelection: function(bodyType) {
            var comp = Utils.getActiveComp();
            if (!comp) {
                Utils.showError("No active composition found");
                return false;
            }
            
            var selectedLayers = comp.selectedLayers;
            if (selectedLayers.length === 0) {
                Utils.showError("No layers selected");
                return false;
            }
            
            bodyType = bodyType || BODY_TYPES.DYNAMIC;
            var addedCount = 0;
            
            for (var i = 0; i < selectedLayers.length; i++) {
                var layer = selectedLayers[i];
                
                if (!Utils.isValidPhysicsLayer(layer)) {
                    Utils.log("Skipping invalid layer: " + layer.name);
                    continue;
                }
                
                var body = Physics.createBody(layer, this.settings, bodyType);
                if (body) {
                    this.bodies.push(body);
                    addedCount++;
                    Utils.log("Added " + bodyType + " body: " + layer.name);
                }
            }
            
            Utils.log("Added " + addedCount + " physics bodies (" + bodyType + ")");
            return addedCount > 0;
        },
        
        simulate: function() {
            if (this.bodies.length === 0) {
                Utils.log("No physics bodies to simulate");
                return false;
            }
            
            this.isSimulating = true;
            this.simulationData = [];
            this.contactData = [];
            
            var totalFrames = Math.floor(this.settings.duration * this.settings.frameRate);
            var deltaTime = (1.0 / this.settings.frameRate) * this.settings.timeScale;
            
            Utils.log("Starting enhanced simulation:");
            Utils.log("- Frames: " + totalFrames + ", Bodies: " + this.bodies.length);
            Utils.log("- Gravity: [" + this.settings.gravityVector[0] + ", " + this.settings.gravityVector[1] + "]");
            Utils.log("- Floor Y: " + this.settings.floorY + ", Collision tolerance: " + this.settings.collisionTolerance);
            
            // Initialize simulation data arrays
            for (var b = 0; b < this.bodies.length; b++) {
                this.simulationData[b] = [];
                this.contactData[b] = [];
                var body = this.bodies[b];
                Utils.log("Body " + b + " (" + body.layer.name + "): " + body.type + " at [" + 
                    Math.round(body.position[0]) + ", " + Math.round(body.position[1]) + "]");
            }
            
            // Main simulation loop
            try {
                for (var frame = 0; frame < totalFrames; frame++) {
                    // Update all bodies
                    for (var i = 0; i < this.bodies.length; i++) {
                        var body = this.bodies[i];
                        
                        // Clear previous contacts for this frame
                        body.contacts = [];
                        
                        // Apply physics forces
                        Physics.applyGravity(body, this.settings.gravityVector, deltaTime);
                        Physics.applyDamping(body, this.settings.damping);
                        
                        // Update positions
                        Physics.updatePosition(body, deltaTime);
                        
                        // Check floor collision
                        Physics.checkFloorCollision(body, this.settings.floorY, this.settings.bounce, this.settings);
                        
                        // Update sleep state
                        if (this.settings.enableSleeping) {
                            Physics.updateSleepState(body, deltaTime);
                        }
                    }
                    
                    // Check inter-body collisions
                    if (this.settings.enableInterBodyCollision) {
                        for (var i = 0; i < this.bodies.length; i++) {
                            for (var j = i + 1; j < this.bodies.length; j++) {
                                Physics.checkBodyCollision(this.bodies[i], this.bodies[j], this.settings);
                            }
                        }
                    }
                    
                    // Update joints
                    Joints.updateJoints(deltaTime);
                    
                    // Store frame data
                    for (var i = 0; i < this.bodies.length; i++) {
                        var body = this.bodies[i];
                        
                        this.simulationData[i][frame] = {
                            position: [body.position[0], body.position[1]],
                            rotation: body.rotation,
                            time: frame * deltaTime,
                            sleeping: body.isSleeping
                        };
                        
                        // Store contact data
                        this.contactData[i][frame] = {
                            contacts: body.contacts.slice(), // Copy array
                            contactCount: body.contactCount,
                            time: frame * deltaTime
                        };
                    }
                }
                
                this.isSimulating = false;
                
                // Log simulation results
                var totalKeyframes = 0;
                var totalContacts = 0;
                for (var i = 0; i < this.simulationData.length; i++) {
                    totalKeyframes += this.simulationData[i].length;
                    var body = this.bodies[i];
                    var finalData = this.simulationData[i][this.simulationData[i].length - 1];
                    
                    Utils.log("Body " + i + " (" + body.layer.name + "):");
                    Utils.log("  Final position: [" + Math.round(finalData.position[0]) + ", " + Math.round(finalData.position[1]) + "]");
                    Utils.log("  Position change: [" + Math.round(finalData.position[0] - body.originalPosition[0]) + 
                        ", " + Math.round(finalData.position[1] - body.originalPosition[1]) + "]");
                    Utils.log("  Total contacts: " + body.contactCount);
                    totalContacts += body.contactCount;
                }
                
                Utils.log("Simulation completed successfully:");
                Utils.log("- " + totalKeyframes + " keyframes generated");
                Utils.log("- " + totalContacts + " total contacts detected");
                
                return totalKeyframes > 0;
                
            } catch (error) {
                this.isSimulating = false;
                Utils.log("Simulation error: " + error.message);
                return false;
            }
        },
        
        bake: function() {
            if (this.simulationData.length === 0) {
                Utils.showError("No simulation data to bake");
                return false;
            }
            
            var comp = Utils.getActiveComp();
            if (!comp) {
                Utils.showError("No active composition found");
                return false;
            }
            
            app.beginUndoGroup("MiniNewton Enhanced - Bake Simulation");
            
            try {
                for (var i = 0; i < this.bodies.length; i++) {
                    var body = this.bodies[i];
                    var frameData = this.simulationData[i];
                    var contactFrameData = this.contactData[i];
                    var layer = body.layer;
                    
                    var position = layer.property("Transform").property("Position");
                    var rotation = layer.property("Transform").property("Rotation");
                    
                    // Clear existing keyframes
                    while (position.numKeys > 0) {
                        position.removeKey(1);
                    }
                    while (rotation.numKeys > 0) {
                        rotation.removeKey(1);
                    }
                    
                    // Set keyframes starting from current comp time
                    var startTime = comp.time;
                    
                    for (var frame = 0; frame < frameData.length; frame++) {
                        var data = frameData[frame];
                        var compTime = startTime + data.time;
                        
                        // Set position keyframe
                        position.setValueAtTime(compTime, data.position);
                        
                        // Set rotation keyframe if there's significant rotation change
                        if (Math.abs(data.rotation - body.originalRotation) > 0.1) {
                            rotation.setValueAtTime(compTime, data.rotation);
                        }
                    }
                    
                    // Add contact slider effect (Newton 4 feature)
                    if (body.contactCount > 0) {
                        try {
                            var contactsEffect = layer.Effects.addProperty("ADBE Slider Control");
                            contactsEffect.name = "Contacts";
                            var contactsSlider = contactsEffect.property("Slider");
                            
                            // Clear existing keyframes
                            while (contactsSlider.numKeys > 0) {
                                contactsSlider.removeKey(1);
                            }
                            
                            // Add contact keyframes
                            var contactValue = 0;
                            for (var frame = 0; frame < contactFrameData.length; frame++) {
                                var contactData = contactFrameData[frame];
                                var compTime = startTime + contactData.time;
                                
                                if (contactData.contacts.length > 0) {
                                    contactValue += contactData.contacts.length;
                                }
                                
                                contactsSlider.setValueAtTime(compTime, contactValue);
                            }
                            
                            Utils.log("Added contacts slider to " + layer.name + " with " + body.contactCount + " contact events");
                        } catch (contactError) {
                            Utils.log("Could not add contacts slider to " + layer.name + ": " + contactError.message);
                        }
                    }
                    
                    Utils.log("Baked " + frameData.length + " keyframes to layer: " + layer.name);
                }
                
                app.endUndoGroup();
                Utils.log("Enhanced simulation baked successfully");
                return true;
                
            } catch (error) {
                app.endUndoGroup();
                Utils.showError("Error baking simulation: " + error.message);
                return false;
            }
        },
        
        reset: function() {
            this.bodies = [];
            this.simulationData = [];
            this.contactData = [];
            this.isSimulating = false;
            Joints.clearAllJoints();
            Utils.log("Enhanced system reset complete");
        },
        
        // Advanced features
        setGravity: function(x, y) {
            this.settings.gravityVector = [x, y];
            this.settings.gravity = Math.sqrt(x * x + y * y);
        },
        
        addJoint: function(bodyIndexA, bodyIndexB, jointType, options) {
            if (bodyIndexA >= this.bodies.length || bodyIndexB >= this.bodies.length) {
                Utils.showError("Invalid body indices for joint");
                return null;
            }
            
            var bodyA = this.bodies[bodyIndexA];
            var bodyB = this.bodies[bodyIndexB];
            
            return Joints.createJoint(bodyA, bodyB, jointType, options);
        },
        
        getStatus: function() {
            return {
                bodies: this.bodies.length,
                joints: Joints.joints.length,
                isSimulating: this.isSimulating,
                hasData: this.simulationData.length > 0
            };
        }
    };

    // Newton 4 Inspired Enhanced UI - Fixed Layout
    function createMiniNewtonPanel(thisObj) {
        var panel = (thisObj instanceof Panel) ? thisObj : new Window("panel", "MiniNewton Enhanced", undefined, {resizeable: true});
        
        panel.orientation = "column";
        panel.alignChildren = "fill";
        panel.spacing = 4;
        panel.margins = 8;
        panel.preferredSize.width = 320;
        panel.preferredSize.height = 500; // Reduced height to fit properly
        
        // Create scrollable group for main content
        var scrollGroup = panel.add("group");
        scrollGroup.orientation = "column";
        scrollGroup.alignChildren = "fill";
        scrollGroup.spacing = 3;
        
        // Header - Compact version
        var headerGroup = scrollGroup.add("panel", undefined, "MiniNewton Enhanced v2.0");
        headerGroup.alignment = "fill";
        headerGroup.margins = 6;
        headerGroup.orientation = "row";
        headerGroup.alignChildren = "center";
        
        var titleText = headerGroup.add("statictext", undefined, "Newton 4 Inspired 2D Physics");
        titleText.graphics.font = ScriptUI.newFont("Arial", "BOLD", 11);
        
        // Status and Control Section (Essential controls at top)
        var controlsGroup = scrollGroup.add("panel", undefined, "Simulation Controls");
        controlsGroup.orientation = "column";
        controlsGroup.alignChildren = "fill";
        controlsGroup.margins = 6;
        controlsGroup.spacing = 3;
        
        var statusText = controlsGroup.add("statictext", undefined, "Status: Ready for simulation");
        statusText.alignment = "center";
        statusText.preferredSize.height = 16;
        statusText.graphics.font = ScriptUI.newFont("Arial", "BOLD", 9);
        
        var progressBar = controlsGroup.add("progressbar", undefined, 0, 100);
        progressBar.preferredSize.height = 6;
        progressBar.value = 0;
        
        // Body Type and Layer Controls
        var bodyTypeGroup = controlsGroup.add("group");
        bodyTypeGroup.add("statictext", undefined, "Type:");
        var dynamicBtn = bodyTypeGroup.add("radiobutton", undefined, "Dynamic");
        var staticBtn = bodyTypeGroup.add("radiobutton", undefined, "Static");
        var kinematicBtn = bodyTypeGroup.add("radiobutton", undefined, "Kinematic");
        dynamicBtn.value = true;
        
        var addBodiesBtn = controlsGroup.add("button", undefined, "🎯 Add Selected Layers");
        addBodiesBtn.preferredSize.height = 28;
        addBodiesBtn.graphics.font = ScriptUI.newFont("Arial", "BOLD", 10);
        
        var layerCountText = controlsGroup.add("statictext", undefined, "Bodies: 0 | Joints: 0");
        layerCountText.alignment = "center";
        layerCountText.graphics.font = ScriptUI.newFont("Arial", "REGULAR", 8);
        
        // Main Action Buttons (Critical controls)
        var actionButtonsGroup = controlsGroup.add("group");
        actionButtonsGroup.orientation = "column";
        actionButtonsGroup.alignChildren = "fill";
        actionButtonsGroup.spacing = 2;
        
        var simulateBtn = actionButtonsGroup.add("button", undefined, "🚀 Run Physics Simulation");
        simulateBtn.preferredSize.height = 30;
        simulateBtn.graphics.font = ScriptUI.newFont("Arial", "BOLD", 11);
        simulateBtn.enabled = false;
        
        var buttonRow = actionButtonsGroup.add("group");
        var bakeBtn = buttonRow.add("button", undefined, "📊 Bake Results");
        bakeBtn.preferredSize.height = 24;
        bakeBtn.enabled = false;
        
        var resetBtn = buttonRow.add("button", undefined, "🔄 Reset");
        resetBtn.preferredSize.height = 24;
        
        // Physics Settings - Compact
        var physicsGroup = scrollGroup.add("panel", undefined, "Physics Settings");
        physicsGroup.orientation = "column";
        physicsGroup.alignChildren = "fill";
        physicsGroup.margins = 6;
        physicsGroup.spacing = 2;
        
        // Material Selection (Newton 4 feature)
        var materialSelectGroup = physicsGroup.add("group");
        materialSelectGroup.add("statictext", undefined, "Material:");
        var materialDropdown = materialSelectGroup.add("dropdownlist", undefined, 
            ["Default", "Rubber", "Metal", "Wood", "Ice", "Concrete", "Glass"]);
        materialDropdown.selection = 0;
        materialDropdown.preferredSize.width = 100;
        
        // Essential Physics Properties in one row
        var physicsRow1 = physicsGroup.add("group");
        physicsRow1.add("statictext", undefined, "Gravity:");
        var gravityText = physicsRow1.add("edittext", undefined, MiniNewton.settings.gravity.toString());
        gravityText.preferredSize.width = 50;
        physicsRow1.add("statictext", undefined, "Bounce:");
        var bounceText = physicsRow1.add("edittext", undefined, MiniNewton.settings.bounce.toString());
        bounceText.preferredSize.width = 40;
        
        var physicsRow2 = physicsGroup.add("group");
        physicsRow2.add("statictext", undefined, "Floor Y:");
        var floorText = physicsRow2.add("edittext", undefined, MiniNewton.settings.floorY.toString());
        floorText.preferredSize.width = 50;
        physicsRow2.add("statictext", undefined, "Duration:");
        var durationText = physicsRow2.add("edittext", undefined, MiniNewton.settings.duration.toString());
        durationText.preferredSize.width = 30;
        physicsRow2.add("statictext", undefined, "s");
        
        // Newton 4 Advanced Controls - Compact & Accessible
        var advancedGroup = scrollGroup.add("panel", undefined, "Advanced Controls");
        advancedGroup.orientation = "column";
        advancedGroup.alignChildren = "fill";
        advancedGroup.margins = 6;
        advancedGroup.spacing = 2;
        
        // Newton 4 Advanced Options in compact rows
        var advRow1 = advancedGroup.add("group");
        var collisionCheck = advRow1.add("checkbox", undefined, "Inter-body Collisions");
        collisionCheck.value = MiniNewton.settings.enableInterBodyCollision;
        
        var advRow2 = advancedGroup.add("group");
        var sleepingCheck = advRow2.add("checkbox", undefined, "Body Sleeping");
        sleepingCheck.value = MiniNewton.settings.enableSleeping;
        var contactsCheck = advRow2.add("checkbox", undefined, "Export Contacts");
        contactsCheck.value = true;
        
        // Newton 4 Body Properties
        var bodyPropsGroup = advancedGroup.add("group");
        bodyPropsGroup.add("statictext", undefined, "Fixed Rotation:");
        var fixedRotationCheck = bodyPropsGroup.add("checkbox", undefined, "");
        fixedRotationCheck.value = false;
        bodyPropsGroup.add("statictext", undefined, "Gravity Scale:");
        var gravityScaleText = bodyPropsGroup.add("edittext", undefined, "1.0");
        gravityScaleText.preferredSize.width = 30;
        
        // Newton 4 Collision Groups
        var collisionGroupsRow = advancedGroup.add("group");
        collisionGroupsRow.add("statictext", undefined, "Collision Group:");
        var collisionGroupDropdown = collisionGroupsRow.add("dropdownlist", undefined, 
            ["Group A", "Group B", "Group C", "Group D", "Group E"]);
        collisionGroupDropdown.selection = 0;
        collisionGroupDropdown.preferredSize.width = 80;
        
        // Newton 4 Joint System - Compact
        var jointGroup = scrollGroup.add("panel", undefined, "Joint Constraints");
        jointGroup.orientation = "column";
        jointGroup.alignChildren = "fill";
        jointGroup.margins = 6;
        jointGroup.spacing = 2;
        
        var jointRow1 = jointGroup.add("group");
        jointRow1.add("statictext", undefined, "Type:");
        var jointTypeDropdown = jointRow1.add("dropdownlist", undefined, 
            ["Distance", "Spring", "Pivot", "Weld"]);
        jointTypeDropdown.selection = 0;
        jointTypeDropdown.preferredSize.width = 70;
        jointRow1.add("statictext", undefined, "Bodies:");
        var bodyAText = jointRow1.add("edittext", undefined, "0");
        bodyAText.preferredSize.width = 25;
        jointRow1.add("statictext", undefined, "to");
        var bodyBText = jointRow1.add("edittext", undefined, "1");
        bodyBText.preferredSize.width = 25;
        
        var jointRow2 = jointGroup.add("group");
        jointRow2.add("statictext", undefined, "Stiffness:");
        var stiffnessText = jointRow2.add("edittext", undefined, "1.0");
        stiffnessText.preferredSize.width = 35;
        jointRow2.add("statictext", undefined, "Damping:");
        var dampingText = jointRow2.add("edittext", undefined, "0.1");
        dampingText.preferredSize.width = 35;
        
        var addJointBtn = jointGroup.add("button", undefined, "🔗 Create Joint");
        addJointBtn.preferredSize.height = 22;
        
        // Special Effects Section
        var specialGroup = scrollGroup.add("panel", undefined, "Special Effects");
        specialGroup.orientation = "column";
        specialGroup.alignChildren = "fill";
        specialGroup.margins = 6;
        specialGroup.spacing = 2;
        
        // Magnetism (Newton 4 feature)
        var magnetRow = specialGroup.add("group");
        var magnetCheck = magnetRow.add("checkbox", undefined, "Magnetism");
        magnetCheck.value = false;
        var magnetTypeDropdown = magnetRow.add("dropdownlist", undefined, ["Attract", "Repulse"]);
        magnetTypeDropdown.selection = 0;
        magnetTypeDropdown.preferredSize.width = 60;
        magnetTypeDropdown.enabled = false;
        
        // Waterlike/Buoyancy (Newton 4 feature)
        var waterRow = specialGroup.add("group");
        var waterCheck = waterRow.add("checkbox", undefined, "Waterlike");
        waterCheck.value = false;
        waterRow.add("statictext", undefined, "Density:");
        var waterDensityText = waterRow.add("edittext", undefined, "1.0");
        waterDensityText.preferredSize.width = 35;
        waterDensityText.enabled = false;
        
        // Use Convex Hull (Newton 4 performance feature)
        var convexRow = specialGroup.add("group");
        var convexHullCheck = convexRow.add("checkbox", undefined, "Use Convex Hull");
        convexHullCheck.value = false;
        convexRow.add("statictext", undefined, "Mesh Precision:");
        var meshPrecisionText = convexRow.add("edittext", undefined, "2");
        meshPrecisionText.preferredSize.width = 25;
        
        // Helper function to update UI status
        function updateStatusDisplay() {
            var status = MiniNewton.getStatus();
            layerCountText.text = "Bodies: " + status.bodies + " | Joints: " + status.joints;
            
            // Enable/disable buttons based on state
            simulateBtn.enabled = status.bodies > 0;
            bakeBtn.enabled = status.hasData;
        }
        
        // Newton 4 Feature Interactions
        magnetCheck.onClick = function() {
            magnetTypeDropdown.enabled = this.value;
        };
        
        waterCheck.onClick = function() {
            waterDensityText.enabled = this.value;
        };
        
        // Compact Event Handlers for Newton 4 Enhanced Interface
        
        // Material system - simplified
        materialDropdown.onChange = function() {
            var materials = ['default', 'rubber', 'metal', 'wood', 'ice', 'concrete', 'glass'];
            MiniNewton.settings.material = materials[this.selection.index];
            
            var materialProps = Physics.materials[MiniNewton.settings.material];
            if (materialProps) {
                // Update bounce value based on material
                bounceText.text = materialProps.restitution.toFixed(2);
                MiniNewton.settings.bounce = materialProps.restitution;
                MiniNewton.settings.friction = materialProps.friction;
                
                statusText.text = "Material applied: " + materials[this.selection.index];
            }
        };
        
        // Essential physics controls
        gravityText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0 && value <= 2000) {
                MiniNewton.settings.gravity = value;
                MiniNewton.settings.gravityVector = [0, value];
            }
        };
        
        bounceText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0 && value <= 1) {
                MiniNewton.settings.bounce = value;
            }
        };
        
        floorText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value)) {
                MiniNewton.settings.floorY = value;
            }
        };
        
        durationText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value > 0) {
                MiniNewton.settings.duration = value;
            }
        };
        
        // Advanced options
        collisionCheck.onClick = function() {
            MiniNewton.settings.enableInterBodyCollision = this.value;
            statusText.text = "Inter-body collisions: " + (this.value ? "enabled" : "disabled");
        };
        
        sleepingCheck.onClick = function() {
            MiniNewton.settings.enableSleeping = this.value;
            statusText.text = "Body sleeping: " + (this.value ? "enabled" : "disabled");
        };
        
        contactsCheck.onClick = function() {
            MiniNewton.settings.exportContacts = this.value;
            statusText.text = "Contact export: " + (this.value ? "enabled" : "disabled");
        };
        
        // Newton 4 Advanced Features
        fixedRotationCheck.onClick = function() {
            MiniNewton.settings.fixedRotation = this.value;
        };
        
        gravityScaleText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value)) {
                MiniNewton.settings.gravityScale = value;
            }
        };
        
        collisionGroupDropdown.onChange = function() {
            var groups = [1, 2, 4, 8, 16]; // Group A, B, C, D, E
            MiniNewton.settings.collisionGroup = groups[this.selection.index];
        };
        
        // Main action button handlers
        addBodiesBtn.onClick = function() {
            statusText.text = "Adding selected layers as physics bodies...";
            progressBar.value = 25;
            
            // Determine body type from radio buttons
            var bodyType = BODY_TYPES.DYNAMIC;
            if (staticBtn.value) bodyType = BODY_TYPES.STATIC;
            else if (kinematicBtn.value) bodyType = BODY_TYPES.KINEMATIC;
            
            try {
                if (MiniNewton.addBodiesFromSelection(bodyType)) {
                    progressBar.value = 100;
                    statusText.text = "Bodies added successfully as " + bodyType + " type";
                    updateStatusDisplay();
                    
                    // Auto-update joint body indices
                    if (MiniNewton.bodies.length >= 2) {
                        bodyBText.text = (MiniNewton.bodies.length - 1).toString();
                    }
                } else {
                    progressBar.value = 0;
                    statusText.text = "Failed to add bodies - check layer selection";
                }
            } catch (error) {
                progressBar.value = 0;
                statusText.text = "Error adding bodies: " + error.message;
                Utils.log("Add bodies error: " + error.message);
            }
            
            // Reset progress bar after delay
            setTimeout(function() { progressBar.value = 0; }, 2000);
        };
        
        addJointBtn.onClick = function() {
            var bodyIndexA = parseInt(bodyAText.text);
            var bodyIndexB = parseInt(bodyBText.text);
            var jointTypes = ['distance', 'spring', 'pivot', 'weld'];
            var jointType = jointTypes[jointTypeDropdown.selection.index];
            
            // Better validation and error messages
            if (!MiniNewton.bodies || MiniNewton.bodies.length === 0) {
                statusText.text = "No bodies available. Add layers first using 'Add Selected Layers'";
                return;
            }
            
            if (isNaN(bodyIndexA) || isNaN(bodyIndexB)) {
                statusText.text = "Enter valid body numbers (0 to " + (MiniNewton.bodies.length - 1) + ")";
                return;
            }
            
            if (bodyIndexA < 0 || bodyIndexB < 0 || 
                bodyIndexA >= MiniNewton.bodies.length || 
                bodyIndexB >= MiniNewton.bodies.length) {
                statusText.text = "Body numbers must be 0 to " + (MiniNewton.bodies.length - 1) + ". You have " + MiniNewton.bodies.length + " bodies";
                return;
            }
            
            if (bodyIndexA === bodyIndexB) {
                statusText.text = "Cannot connect a body to itself";
                return;
            }
            
            try {
                var jointOptions = {
                    stiffness: parseFloat(stiffnessText.text) || 1.0,
                    damping: parseFloat(dampingText.text) || 0.1
                };
                
                // Use direct joint creation instead of MiniNewton.addJoint
                var bodyA = MiniNewton.bodies[bodyIndexA];
                var bodyB = MiniNewton.bodies[bodyIndexB];
                
                if (bodyA && bodyB) {
                    var joint = Joints.createJoint(bodyA, bodyB, jointType, jointOptions);
                    if (joint) {
                        statusText.text = "✓ " + jointType + " joint created (Bodies " + bodyIndexA + "-" + bodyIndexB + ")";
                        updateStatusDisplay();
                    } else {
                        statusText.text = "Joint creation failed - check body properties";
                    }
                } else {
                    statusText.text = "Invalid body references - try resetting and adding layers again";
                }
            } catch (error) {
                statusText.text = "Joint error: " + error.message;
                Utils.log("Joint creation error: " + error.message);
            }
        };
        
        simulateBtn.onClick = function() {
            statusText.text = "Starting physics simulation...";
            simulateBtn.enabled = false;
            progressBar.value = 10;
            
            try {
                // Validate composition first
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    statusText.text = "No active composition - open a comp first";
                    simulateBtn.enabled = true;
                    progressBar.value = 0;
                    return;
                }
                
                // Check bodies
                if (!MiniNewton.bodies || MiniNewton.bodies.length === 0) {
                    statusText.text = "No physics bodies - add layers first";
                    simulateBtn.enabled = true;
                    progressBar.value = 0;
                    return;
                }
                
                progressBar.value = 30;
                
                // Apply special effects before simulation
                var applySpecialEffects = function(body) {
                    // Magnetism effect
                    if (magnetCheck.value) {
                        body.magnetism = {
                            enabled: true,
                            type: magnetTypeDropdown.selection.text,
                            strength: 500
                        };
                    }
                    
                    // Waterlike effect  
                    if (waterCheck.value) {
                        body.waterlike = {
                            enabled: true,
                            density: parseFloat(waterDensityText.text) || 1.0,
                            buoyancy: 0.8
                        };
                    }
                    
                    // Fixed rotation
                    if (fixedRotationCheck.value) {
                        body.fixedRotation = true;
                    }
                    
                    // Gravity scale
                    body.gravityScale = parseFloat(gravityScaleText.text) || 1.0;
                };
                
                // Apply effects to all bodies
                for (var i = 0; i < MiniNewton.bodies.length; i++) {
                    applySpecialEffects(MiniNewton.bodies[i]);
                }
                
                progressBar.value = 50;
                
                // Run simulation
                if (MiniNewton.simulate()) {
                    progressBar.value = 100;
                    var status = MiniNewton.getStatus();
                    statusText.text = "✓ Simulation complete! " + status.bodies + " bodies simulated";
                    updateStatusDisplay();
                } else {
                    statusText.text = "Simulation failed - check layer setup";
                }
            } catch (error) {
                statusText.text = "Error: " + error.message;
                Utils.log("Simulation error: " + error.message);
            }
            
            simulateBtn.enabled = true;
            setTimeout(function() { progressBar.value = 0; }, 3000);
        };
        
        bakeBtn.onClick = function() {
            statusText.text = "Baking keyframes to layers...";
            progressBar.value = 20;
            
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    statusText.text = "No active composition";
                    progressBar.value = 0;
                    return;
                }
                
                if (!MiniNewton.simulationData || MiniNewton.simulationData.length === 0) {
                    statusText.text = "No simulation data - run simulation first";
                    progressBar.value = 0;
                    return;
                }
                
                app.beginUndoGroup("MiniNewton Bake Physics");
                
                var success = 0;
                var total = MiniNewton.bodies.length;
                
                progressBar.value = 40;
                
                // Bake keyframes for each body
                for (var i = 0; i < MiniNewton.bodies.length; i++) {
                    var body = MiniNewton.bodies[i];
                    var layer = body.layer;
                    
                    if (layer && body.simulationResults) {
                        // Clear existing keyframes
                        layer.position.removeKey(1);
                        layer.rotation.removeKey(1);
                        
                        // Add keyframes from simulation data
                        for (var t = 0; t < body.simulationResults.length; t++) {
                            var frame = body.simulationResults[t];
                            var time = t * comp.frameDuration;
                            
                            // Position keyframes
                            layer.position.setValueAtTime(time, [frame.x, frame.y]);
                            
                            // Rotation keyframes (if not fixed)
                            if (!body.fixedRotation) {
                                layer.rotation.setValueAtTime(time, frame.rotation || 0);
                            }
                        }
                        success++;
                    }
                }
                
                progressBar.value = 80;
                
                // Add contact point effects if enabled
                if (contactsCheck.value) {
                    // Create contact visualization layer
                    var contactLayer = comp.layers.addSolid([1, 0, 0], "MiniNewton_Contacts", comp.width, comp.height, 1);
                    contactLayer.blendingMode = BlendingMode.MULTIPLY;
                    contactLayer.opacity.setValue(50);
                }
                
                app.endUndoGroup();
                
                progressBar.value = 100;
                statusText.text = "✓ Baked " + success + "/" + total + " bodies successfully!";
                
                if (success === 0) {
                    statusText.text = "No keyframes created - check simulation data";
                }
                
            } catch (error) {
                app.endUndoGroup();
                progressBar.value = 0;
                statusText.text = "Baking error: " + error.message;
                Utils.log("Baking error: " + error.message);
            }
            
            setTimeout(function() { progressBar.value = 0; }, 3000);
        };
        
        resetBtn.onClick = function() {
            try {
                MiniNewton.reset();
                statusText.text = "System reset - ready for new simulation";
                layerCountText.text = "Bodies: 0 | Joints: 0";
                bodyAText.text = "0";
                bodyBText.text = "1";
                progressBar.value = 0;
                updateStatusDisplay();
            } catch (error) {
                statusText.text = "Reset error: " + error.message;
                Utils.showError("Reset error: " + error.message);
            }
        };
        
        panel.onResizing = panel.onResize = function() {
            this.layout.resize();
        };
        
        panel.layout.layout(true);
        return panel;
    }
    
    // Initialize Enhanced MiniNewton
    MiniNewton.init();
    var miniNewtonPanel = createMiniNewtonPanel(thisObj);
    
    if (miniNewtonPanel != null && miniNewtonPanel instanceof Window) {
        miniNewtonPanel.center();
        miniNewtonPanel.show();
    }
    
    return miniNewtonPanel;

})(this);