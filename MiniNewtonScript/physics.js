/*
 * Physics Engine Module for MiniNewton
 * Handles core physics calculations, body creation, and collision detection
 */

var Physics = (function() {
    
    var self = {};
    
    // Material presets for different physics behaviors
    self.materials = {
        'rubber': { restitution: 0.9, friction: 0.7, density: 0.9 },
        'metal': { restitution: 0.3, friction: 0.1, density: 7.8 },
        'wood': { restitution: 0.5, friction: 0.8, density: 0.6 },
        'ice': { restitution: 0.1, friction: 0.02, density: 0.92 },
        'concrete': { restitution: 0.2, friction: 0.9, density: 2.4 },
        'default': { restitution: 0.8, friction: 0.3, density: 1.0 }
    };
    
    /**
     * Create a physics body from an After Effects layer
     */
    self.createBody = function(layer, settings) {
        if (!layer) return null;
        
        try {
            var transform = layer.property("Transform");
            var position = transform.property("Position").value;
            var rotation = transform.property("Rotation").value;
            var scale = transform.property("Scale").value;
            
            // Calculate mass based on layer dimensions and scale
            var width = layer.width * scale[0] / 100;
            var height = layer.height * scale[1] / 100;
            var area = width * height;
            var mass = Math.max(area / 10000, 0.1); // Minimum mass of 0.1
            
            // Apply material properties if specified
            var materialProps = self.materials[settings.material] || self.materials['default'];
            
            var body = {
                layer: layer,
                position: [position[0], position[1]],
                velocity: [0, 0],
                acceleration: [0, 0],
                rotation: rotation,
                angularVelocity: 0,
                mass: mass * (materialProps.density || 1.0),
                width: width,
                height: height,
                restitution: settings.bounce !== undefined ? settings.bounce : materialProps.restitution,
                friction: settings.friction !== undefined ? settings.friction : materialProps.friction,
                density: materialProps.density,
                isGrounded: false,
                isSleeping: false,
                sleepTimer: 0,
                material: settings.material || 'default'
            };
            
            return body;
            
        } catch (error) {
            Utils.log("Error creating body for layer " + layer.name + ": " + error.message);
            return null;
        }
    };
    
    /**
     * Apply gravitational force to a body
     */
    self.applyGravity = function(body, gravityVector, deltaTime) {
        if (!body.isGrounded) {
            // Support for gravity vector (not just downward)
            if (typeof gravityVector === 'number') {
                body.acceleration[1] += gravityVector * deltaTime;
            } else {
                body.acceleration[0] += gravityVector[0] * deltaTime;
                body.acceleration[1] += gravityVector[1] * deltaTime;
            }
        }
    };
    
    /**
     * Apply damping/air resistance to velocity
     */
    self.applyDamping = function(body, damping) {
        body.velocity[0] *= damping;
        body.velocity[1] *= damping;
        body.angularVelocity *= damping;
    };
    
    /**
     * Update body position based on velocity and acceleration
     */
    self.updatePosition = function(body, deltaTime) {
        // Update velocity with acceleration
        body.velocity[0] += body.acceleration[0] * deltaTime;
        body.velocity[1] += body.acceleration[1] * deltaTime;
        
        // Update position with velocity
        body.position[0] += body.velocity[0] * deltaTime;
        body.position[1] += body.velocity[1] * deltaTime;
        
        // Update rotation with angular velocity
        body.rotation += body.angularVelocity * deltaTime;
        
        // Reset acceleration for next frame
        body.acceleration[0] = 0;
        body.acceleration[1] = 0;
    };
    
    /**
     * Check collision with floor boundary
     */
    self.checkFloorCollision = function(body, floorY, bounce) {
        var bodyBottom = body.position[1] + (body.height / 2);
        
        if (bodyBottom >= floorY) {
            // Position correction - place body exactly on floor
            body.position[1] = floorY - (body.height / 2);
            
            // Velocity reflection with bounce factor
            if (body.velocity[1] > 0) {
                body.velocity[1] = -body.velocity[1] * bounce;
                
                // Add slight angular velocity on bounce for more realistic motion
                var impactStrength = Math.abs(body.velocity[1]);
                body.angularVelocity += (Math.random() - 0.5) * impactStrength * 0.1;
                
                // Check if velocity is too small to continue bouncing
                if (Math.abs(body.velocity[1]) < 10) {
                    body.velocity[1] = 0;
                    body.isGrounded = true;
                } else {
                    body.isGrounded = false;
                }
            }
            
            // Apply friction to horizontal movement when on ground
            if (body.isGrounded) {
                body.velocity[0] *= 0.9; // Friction coefficient
                body.angularVelocity *= 0.95;
            }
        } else {
            body.isGrounded = false;
        }
    };
    
    /**
     * Check collision between two bodies (for future multi-body collision)
     */
    self.checkBodyCollision = function(bodyA, bodyB) {
        // Simple AABB collision detection
        var aLeft = bodyA.position[0] - bodyA.width / 2;
        var aRight = bodyA.position[0] + bodyA.width / 2;
        var aTop = bodyA.position[1] - bodyA.height / 2;
        var aBottom = bodyA.position[1] + bodyA.height / 2;
        
        var bLeft = bodyB.position[0] - bodyB.width / 2;
        var bRight = bodyB.position[0] + bodyB.width / 2;
        var bTop = bodyB.position[1] - bodyB.height / 2;
        var bBottom = bodyB.position[1] + bodyB.height / 2;
        
        return !(aLeft > bRight || aRight < bLeft || aTop > bBottom || aBottom < bTop);
    };
    
    /**
     * Resolve collision between two bodies
     */
    self.resolveCollision = function(bodyA, bodyB) {
        // Calculate relative velocity
        var relVelocity = [
            bodyB.velocity[0] - bodyA.velocity[0],
            bodyB.velocity[1] - bodyA.velocity[1]
        ];
        
        // Calculate collision normal (simplified)
        var normal = [
            bodyB.position[0] - bodyA.position[0],
            bodyB.position[1] - bodyA.position[1]
        ];
        
        // Normalize
        var length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1]);
        if (length > 0) {
            normal[0] /= length;
            normal[1] /= length;
        }
        
        // Calculate relative velocity in collision normal direction
        var velAlongNormal = relVelocity[0] * normal[0] + relVelocity[1] * normal[1];
        
        // Do not resolve if velocities are separating
        if (velAlongNormal > 0) return;
        
        // Calculate restitution
        var restitution = Math.min(bodyA.restitution, bodyB.restitution);
        
        // Calculate impulse scalar
        var impulse = -(1 + restitution) * velAlongNormal;
        impulse /= (1/bodyA.mass + 1/bodyB.mass);
        
        // Apply impulse
        var impulseVector = [impulse * normal[0], impulse * normal[1]];
        
        bodyA.velocity[0] -= impulseVector[0] / bodyA.mass;
        bodyA.velocity[1] -= impulseVector[1] / bodyA.mass;
        bodyB.velocity[0] += impulseVector[0] / bodyB.mass;
        bodyB.velocity[1] += impulseVector[1] / bodyB.mass;
    };
    
    /**
     * Calculate kinetic energy of a body
     */
    self.getKineticEnergy = function(body) {
        var linearKE = 0.5 * body.mass * (body.velocity[0] * body.velocity[0] + body.velocity[1] * body.velocity[1]);
        var rotationalKE = 0.5 * body.mass * body.angularVelocity * body.angularVelocity;
        return linearKE + rotationalKE;
    };
    
    /**
     * Check if body should enter sleep state (optimization)
     */
    self.updateSleepState = function(body, deltaTime) {
        var velocityThreshold = 5; // pixels per second
        var angularThreshold = 0.1; // radians per second
        var sleepTimeout = 1.0; // seconds
        
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
    };
    
    /**
     * Wake up sleeping body
     */
    self.wakeBody = function(body) {
        body.isSleeping = false;
        body.sleepTimer = 0;
    };
    
    /**
     * Check and resolve collisions between all bodies
     */
    self.resolveBodyCollisions = function(bodies) {
        for (var i = 0; i < bodies.length; i++) {
            for (var j = i + 1; j < bodies.length; j++) {
                var bodyA = bodies[i];
                var bodyB = bodies[j];
                
                // Skip sleeping bodies
                if (bodyA.isSleeping && bodyB.isSleeping) continue;
                
                if (self.checkBodyCollision(bodyA, bodyB)) {
                    // Wake up bodies on collision
                    self.wakeBody(bodyA);
                    self.wakeBody(bodyB);
                    
                    // Resolve collision
                    self.resolveCollision(bodyA, bodyB);
                }
            }
        }
    };
    
    /**
     * Apply material-based friction during collision
     */
    self.applyMaterialFriction = function(body, contactNormal, deltaTime) {
        if (body.isGrounded || body.isSleeping) {
            // Calculate friction force perpendicular to contact normal
            var frictionCoeff = body.friction;
            var normalForce = body.mass * 980; // Assume standard gravity for normal force
            var frictionForce = frictionCoeff * normalForce;
            
            // Apply friction opposite to velocity direction
            if (Math.abs(body.velocity[0]) > 0.1) {
                var frictionDirection = body.velocity[0] > 0 ? -1 : 1;
                body.velocity[0] += frictionDirection * frictionForce * deltaTime / body.mass;
                
                // Prevent oscillation by stopping very slow movement
                if (Math.abs(body.velocity[0]) < 1) {
                    body.velocity[0] = 0;
                }
            }
        }
    };
    
    return self;
})();
