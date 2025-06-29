/*
 * MiniNewton - Lightweight 2D Physics Engine for After Effects
 * Phase 1: Core Physics with Gravity, Bounce, and Floor Collision
 * Compatible with After Effects 2021+
 */

// Note: In ExtendScript, modules would be included using #include or eval(File.read())
// For this demo, we'll assume all modules are loaded in order: utils.js, physics.js, joints.js, ui.js

// Main MiniNewton namespace
var MiniNewton = (function() {
    
    var self = {};
    
    // Global settings
    self.settings = {
        gravity: 980,           // pixels per second squared (default Earth gravity)
        gravityVector: [0, 980], // gravity as vector [x, y]
        bounce: 0.8,           // elasticity coefficient (0-1)
        floorY: 900,           // Y position of floor collision boundary
        duration: 3,           // simulation duration in seconds
        frameRate: 30,         // frames per second
        damping: 0.98,         // velocity damping factor
        friction: 0.3,         // global friction coefficient
        material: 'default',   // default material preset
        enableInterBodyCollision: false, // multi-body collision detection
        enableSleeping: true   // body sleeping optimization
    };
    
    // Active simulation data
    self.bodies = [];
    self.joints = [];
    self.simulationData = [];
    self.isSimulating = false;
    
    /**
     * Initialize MiniNewton with custom settings
     */
    self.init = function(customSettings) {
        if (customSettings) {
            for (var key in customSettings) {
                if (self.settings.hasOwnProperty(key)) {
                    self.settings[key] = customSettings[key];
                }
            }
        }
        
        Utils.log("MiniNewton initialized");
        return self;
    };
    
    /**
     * Add selected layers as physics bodies
     */
    self.addBodiesFromSelection = function() {
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
        
        self.bodies = [];
        
        for (var i = 0; i < selectedLayers.length; i++) {
            var layer = selectedLayers[i];
            var body = Physics.createBody(layer, self.settings);
            
            if (body) {
                self.bodies.push(body);
                Utils.log("Added body: " + layer.name);
            }
        }
        
        Utils.log("Added " + self.bodies.length + " physics bodies");
        return self.bodies.length > 0;
    };
    
    /**
     * Run the physics simulation
     */
    self.simulate = function() {
        if (self.bodies.length === 0) {
            Utils.showError("No physics bodies to simulate");
            return false;
        }
        
        self.isSimulating = true;
        self.simulationData = [];
        
        var totalFrames = Math.floor(self.settings.duration * self.settings.frameRate);
        var deltaTime = 1.0 / self.settings.frameRate;
        
        Utils.log("Starting simulation: " + totalFrames + " frames");
        
        // Initialize simulation data structure
        for (var b = 0; b < self.bodies.length; b++) {
            self.simulationData[b] = [];
        }
        
        // Run frame-by-frame simulation
        for (var frame = 0; frame < totalFrames; frame++) {
            
            // Update each body
            for (var i = 0; i < self.bodies.length; i++) {
                var body = self.bodies[i];
                
                // Skip sleeping bodies
                if (self.settings.enableSleeping && body.isSleeping) {
                    // Store frame data for sleeping bodies (no change)
                    self.simulationData[i][frame] = {
                        position: [body.position[0], body.position[1]],
                        rotation: body.rotation,
                        time: frame * deltaTime
                    };
                    continue;
                }
                
                // Apply gravity (vector or scalar)
                Physics.applyGravity(body, self.settings.gravityVector || self.settings.gravity, deltaTime);
                
                // Apply damping
                Physics.applyDamping(body, self.settings.damping);
                
                // Update position
                Physics.updatePosition(body, deltaTime);
                
                // Check floor collision
                Physics.checkFloorCollision(body, self.settings.floorY, self.settings.bounce);
                
                // Apply material-based friction
                Physics.applyMaterialFriction(body, [0, -1], deltaTime);
                
                // Update sleep state if enabled
                if (self.settings.enableSleeping) {
                    Physics.updateSleepState(body, deltaTime);
                }
                
                // Store frame data
                self.simulationData[i][frame] = {
                    position: [body.position[0], body.position[1]],
                    rotation: body.rotation,
                    time: frame * deltaTime
                };
            }
            
            // Handle inter-body collisions if enabled
            if (self.settings.enableInterBodyCollision) {
                Physics.resolveBodyCollisions(self.bodies);
            }
            
            // Update joint constraints
            if (self.joints.length > 0) {
                Joints.updateJoints(self.joints, deltaTime);
            }
        }
        
        self.isSimulating = false;
        Utils.log("Simulation completed");
        return true;
    };
    
    /**
     * Bake simulation data to layer keyframes
     */
    self.bake = function() {
        if (self.simulationData.length === 0) {
            Utils.showError("No simulation data to bake");
            return false;
        }
        
        var comp = Utils.getActiveComp();
        if (!comp) {
            Utils.showError("No active composition found");
            return false;
        }
        
        // Begin undo group
        app.beginUndoGroup("MiniNewton Bake Simulation");
        
        try {
            for (var i = 0; i < self.bodies.length; i++) {
                var body = self.bodies[i];
                var frameData = self.simulationData[i];
                var layer = body.layer;
                
                // Clear existing position keyframes
                layer.property("Transform").property("Position").setValueAtTime(0, layer.property("Transform").property("Position").value);
                
                // Add position keyframes
                for (var frame = 0; frame < frameData.length; frame++) {
                    var data = frameData[frame];
                    var time = data.time;
                    
                    layer.property("Transform").property("Position").setValueAtTime(time, data.position);
                    
                    // Add rotation keyframes if rotation changed
                    if (Math.abs(data.rotation) > 0.001) {
                        layer.property("Transform").property("Rotation").setValueAtTime(time, data.rotation);
                    }
                }
                
                Utils.log("Baked " + frameData.length + " keyframes to layer: " + layer.name);
            }
            
            app.endUndoGroup();
            Utils.log("Simulation baked successfully");
            return true;
            
        } catch (error) {
            app.endUndoGroup();
            Utils.showError("Error baking simulation: " + error.message);
            return false;
        }
    };
    
    /**
     * Create a joint between two selected bodies
     */
    self.createJoint = function(bodyIndexA, bodyIndexB, jointType, options) {
        if (bodyIndexA >= self.bodies.length || bodyIndexB >= self.bodies.length) {
            Utils.showError("Invalid body indices for joint creation");
            return false;
        }
        
        var bodyA = self.bodies[bodyIndexA];
        var bodyB = self.bodies[bodyIndexB];
        
        var joint = Joints.createJoint(bodyA, bodyB, jointType, options);
        if (joint) {
            self.joints.push(joint);
            Utils.log("Created " + jointType + " joint between " + bodyA.layer.name + " and " + bodyB.layer.name);
            return joint;
        }
        
        return false;
    };
    
    /**
     * Remove joint by ID
     */
    self.removeJoint = function(jointId) {
        return Joints.removeJoint(self.joints, jointId);
    };
    
    /**
     * Auto-create joints based on layer naming convention
     * Layers with names like "body1_distance_body2" will auto-create joints
     */
    self.autoCreateJoints = function() {
        var createdJoints = 0;
        
        for (var i = 0; i < self.bodies.length; i++) {
            var body = self.bodies[i];
            var layerName = body.layer.name.toLowerCase();
            
            // Check for naming convention: layerA_jointType_layerB
            var parts = layerName.split('_');
            if (parts.length >= 3) {
                var jointType = parts[1];
                var targetLayerName = parts[2];
                
                // Find target body
                for (var j = 0; j < self.bodies.length; j++) {
                    if (i !== j && self.bodies[j].layer.name.toLowerCase().indexOf(targetLayerName) >= 0) {
                        if (Joints.jointTypes[jointType]) {
                            self.createJoint(i, j, jointType);
                            createdJoints++;
                        }
                        break;
                    }
                }
            }
        }
        
        if (createdJoints > 0) {
            Utils.log("Auto-created " + createdJoints + " joints from layer names");
        }
        
        return createdJoints;
    };
    
    /**
     * Reset simulation data
     */
    self.reset = function() {
        self.bodies = [];
        self.joints = [];
        self.simulationData = [];
        self.isSimulating = false;
        Utils.log("Simulation reset");
    };
    
    /**
     * Get current simulation status
     */
    self.getStatus = function() {
        return {
            bodies: self.bodies.length,
            joints: self.joints.length,
            isSimulating: self.isSimulating,
            hasData: self.simulationData.length > 0
        };
    };
    
    return self;
})();

// Initialize UI when script loads
(function() {
    if (typeof app !== "undefined" && app.project) {
        UI.createPanel();
    }
})();
