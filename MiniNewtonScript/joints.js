/*
 * Joints and Constraints Module for MiniNewton
 * Handles different types of connections between physics bodies
 */

var Joints = (function() {
    
    var self = {};
    
    // Joint types and their default properties
    self.jointTypes = {
        'distance': { 
            description: 'Maintains constant distance between bodies',
            damping: 0.1,
            strength: 1.0
        },
        'pivot': { 
            description: 'Pin joint allowing rotation around anchor point',
            damping: 0.05,
            strength: 1.0
        },
        'spring': { 
            description: 'Spring connection with elasticity',
            springConstant: 100,
            damping: 0.2,
            restLength: 100
        },
        'weld': { 
            description: 'Rigid connection (no relative movement)',
            strength: 1.0,
            damping: 0.0
        }
    };
    
    /**
     * Create a joint between two bodies
     */
    self.createJoint = function(bodyA, bodyB, type, options) {
        if (!bodyA || !bodyB || !self.jointTypes[type]) {
            Utils.log("Invalid joint parameters");
            return null;
        }
        
        options = options || {};
        var jointType = self.jointTypes[type];
        
        var joint = {
            id: 'joint_' + Math.random().toString(36).substr(2, 9),
            type: type,
            bodyA: bodyA,
            bodyB: bodyB,
            anchorA: options.anchorA || [0, 0], // Local anchor points
            anchorB: options.anchorB || [0, 0],
            enabled: true,
            
            // Joint-specific properties
            damping: options.damping !== undefined ? options.damping : jointType.damping,
            strength: options.strength !== undefined ? options.strength : jointType.strength,
            
            // For distance and spring joints
            targetDistance: options.targetDistance || self.calculateDistance(bodyA, bodyB),
            
            // For spring joints
            springConstant: options.springConstant || jointType.springConstant,
            restLength: options.restLength || jointType.restLength,
            
            // For pivot joints
            pivotPoint: options.pivotPoint || [(bodyA.position[0] + bodyB.position[0]) / 2, 
                                              (bodyA.position[1] + bodyB.position[1]) / 2],
            
            // Runtime data
            lastDistance: 0,
            impulseAccumulator: [0, 0]
        };
        
        Utils.log("Created " + type + " joint between bodies");
        return joint;
    };
    
    /**
     * Calculate distance between two bodies
     */
    self.calculateDistance = function(bodyA, bodyB) {
        var dx = bodyB.position[0] - bodyA.position[0];
        var dy = bodyB.position[1] - bodyA.position[1];
        return Math.sqrt(dx * dx + dy * dy);
    };
    
    /**
     * Apply distance joint constraint
     */
    self.applyDistanceJoint = function(joint, deltaTime) {
        var bodyA = joint.bodyA;
        var bodyB = joint.bodyB;
        
        // Calculate current distance
        var dx = bodyB.position[0] - bodyA.position[0];
        var dy = bodyB.position[1] - bodyA.position[1];
        var currentDistance = Math.sqrt(dx * dx + dy * dy);
        
        if (currentDistance < 0.001) return; // Avoid division by zero
        
        // Calculate constraint violation
        var error = currentDistance - joint.targetDistance;
        var correctionFactor = error / currentDistance * joint.strength;
        
        // Apply damping
        var relativeVelocity = [
            bodyB.velocity[0] - bodyA.velocity[0],
            bodyB.velocity[1] - bodyA.velocity[1]
        ];
        
        var dampingForce = [
            relativeVelocity[0] * joint.damping,
            relativeVelocity[1] * joint.damping
        ];
        
        // Calculate correction impulse
        var correctionX = (dx / currentDistance) * correctionFactor * 0.5;
        var correctionY = (dy / currentDistance) * correctionFactor * 0.5;
        
        // Apply position corrections
        bodyA.position[0] += correctionX - dampingForce[0] * deltaTime;
        bodyA.position[1] += correctionY - dampingForce[1] * deltaTime;
        bodyB.position[0] -= correctionX + dampingForce[0] * deltaTime;
        bodyB.position[1] -= correctionY + dampingForce[1] * deltaTime;
        
        joint.lastDistance = currentDistance;
    };
    
    /**
     * Apply spring joint constraint
     */
    self.applySpringJoint = function(joint, deltaTime) {
        var bodyA = joint.bodyA;
        var bodyB = joint.bodyB;
        
        // Calculate spring force using Hooke's law: F = -k * x
        var dx = bodyB.position[0] - bodyA.position[0];
        var dy = bodyB.position[1] - bodyA.position[1];
        var currentLength = Math.sqrt(dx * dx + dy * dy);
        
        if (currentLength < 0.001) return;
        
        var extension = currentLength - joint.restLength;
        var springForce = joint.springConstant * extension;
        
        // Unit vector from A to B
        var unitX = dx / currentLength;
        var unitY = dy / currentLength;
        
        // Apply spring force
        var forceX = -springForce * unitX;
        var forceY = -springForce * unitY;
        
        // Apply damping
        var relativeVelocity = [
            bodyB.velocity[0] - bodyA.velocity[0],
            bodyB.velocity[1] - bodyA.velocity[1]
        ];
        
        var dampingForceX = relativeVelocity[0] * joint.damping;
        var dampingForceY = relativeVelocity[1] * joint.damping;
        
        // Apply forces to bodies
        bodyA.velocity[0] -= (forceX + dampingForceX) * deltaTime / bodyA.mass;
        bodyA.velocity[1] -= (forceY + dampingForceY) * deltaTime / bodyA.mass;
        bodyB.velocity[0] += (forceX - dampingForceX) * deltaTime / bodyB.mass;
        bodyB.velocity[1] += (forceY - dampingForceY) * deltaTime / bodyB.mass;
    };
    
    /**
     * Apply pivot joint constraint
     */
    self.applyPivotJoint = function(joint, deltaTime) {
        var bodyA = joint.bodyA;
        var bodyB = joint.bodyB;
        var pivot = joint.pivotPoint;
        
        // Calculate distances from pivot
        var distA = [bodyA.position[0] - pivot[0], bodyA.position[1] - pivot[1]];
        var distB = [bodyB.position[0] - pivot[0], bodyB.position[1] - pivot[1]];
        
        var radiusA = Math.sqrt(distA[0] * distA[0] + distA[1] * distA[1]);
        var radiusB = Math.sqrt(distB[0] * distB[0] + distB[1] * distB[1]);
        
        if (radiusA < 0.001 || radiusB < 0.001) return;
        
        // Constrain bodies to move in circles around pivot
        var correctionStrength = joint.strength * 0.1;
        
        // Apply angular velocity constraints
        var angularA = Math.atan2(distA[1], distA[0]);
        var angularB = Math.atan2(distB[1], distB[0]);
        
        // Simple pendulum-like behavior
        bodyA.angularVelocity += Math.sin(angularA) * correctionStrength;
        bodyB.angularVelocity += Math.sin(angularB) * correctionStrength;
        
        // Apply damping to angular motion
        bodyA.angularVelocity *= (1 - joint.damping);
        bodyB.angularVelocity *= (1 - joint.damping);
    };
    
    /**
     * Apply weld joint constraint (rigid connection)
     */
    self.applyWeldJoint = function(joint, deltaTime) {
        var bodyA = joint.bodyA;
        var bodyB = joint.bodyB;
        
        // Calculate relative position that should be maintained
        var targetDx = joint.targetDistance * Math.cos(joint.targetAngle || 0);
        var targetDy = joint.targetDistance * Math.sin(joint.targetAngle || 0);
        
        var currentDx = bodyB.position[0] - bodyA.position[0];
        var currentDy = bodyB.position[1] - bodyA.position[1];
        
        // Calculate position error
        var errorX = currentDx - targetDx;
        var errorY = currentDy - targetDy;
        
        // Apply strong correction to maintain rigid connection
        var correctionStrength = joint.strength;
        
        bodyA.position[0] += errorX * 0.5 * correctionStrength;
        bodyA.position[1] += errorY * 0.5 * correctionStrength;
        bodyB.position[0] -= errorX * 0.5 * correctionStrength;
        bodyB.position[1] -= errorY * 0.5 * correctionStrength;
        
        // Synchronize velocities for rigid connection
        var avgVelX = (bodyA.velocity[0] + bodyB.velocity[0]) * 0.5;
        var avgVelY = (bodyA.velocity[1] + bodyB.velocity[1]) * 0.5;
        
        bodyA.velocity[0] = avgVelX;
        bodyA.velocity[1] = avgVelY;
        bodyB.velocity[0] = avgVelX;
        bodyB.velocity[1] = avgVelY;
    };
    
    /**
     * Update all joints in the system
     */
    self.updateJoints = function(joints, deltaTime) {
        for (var i = 0; i < joints.length; i++) {
            var joint = joints[i];
            
            if (!joint.enabled) continue;
            
            switch (joint.type) {
                case 'distance':
                    self.applyDistanceJoint(joint, deltaTime);
                    break;
                case 'spring':
                    self.applySpringJoint(joint, deltaTime);
                    break;
                case 'pivot':
                    self.applyPivotJoint(joint, deltaTime);
                    break;
                case 'weld':
                    self.applyWeldJoint(joint, deltaTime);
                    break;
            }
        }
    };
    
    /**
     * Remove joint by ID
     */
    self.removeJoint = function(joints, jointId) {
        for (var i = joints.length - 1; i >= 0; i--) {
            if (joints[i].id === jointId) {
                joints.splice(i, 1);
                Utils.log("Removed joint: " + jointId);
                return true;
            }
        }
        return false;
    };
    
    /**
     * Get joints connected to a specific body
     */
    self.getJointsForBody = function(joints, body) {
        var connectedJoints = [];
        for (var i = 0; i < joints.length; i++) {
            var joint = joints[i];
            if (joint.bodyA === body || joint.bodyB === body) {
                connectedJoints.push(joint);
            }
        }
        return connectedJoints;
    };
    
    return self;
})();