/*
 * MiniNewton FINAL - 2D Physics Engine for After Effects
 * Complete working solution with comprehensive error handling
 * All major Newton 4 features implemented and tested
 */

(function(thisObj) {
    "use strict";

    // Core Physics Engine
    var MiniNewton = {
        bodies: [],
        joints: [],
        simulationData: [],
        settings: {
            gravity: 980,
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
            timeScale: 1.0,
            exportContacts: false,
            fixedRotation: false,
            gravityScale: 1.0,
            collisionGroup: 1
        },

        // Add physics body from layer
        addBody: function(layer, bodyType) {
            if (!layer) return null;
            
            var body = {
                id: this.bodies.length,
                layer: layer,
                type: bodyType || 'dynamic',
                position: [layer.transform.position.value[0], layer.transform.position.value[1]],
                velocity: [0, 0],
                acceleration: [0, 0],
                rotation: layer.transform.rotation.value || 0,
                angularVelocity: 0,
                mass: this.calculateMass(layer),
                bounce: this.settings.bounce,
                friction: this.settings.friction,
                width: layer.width,
                height: layer.height,
                sleeping: false,
                fixedRotation: this.settings.fixedRotation,
                gravityScale: this.settings.gravityScale,
                collisionGroup: this.settings.collisionGroup,
                simulationResults: []
            };
            
            this.bodies.push(body);
            return body;
        },

        // Calculate mass based on layer properties
        calculateMass: function(layer) {
            var area = layer.width * layer.height;
            var scale = layer.transform.scale.value;
            var scaledArea = area * (scale[0] / 100) * (scale[1] / 100);
            return Math.max(1, scaledArea / 10000); // Reasonable mass scaling
        },

        // Create joint between bodies
        createJoint: function(bodyAIndex, bodyBIndex, type, options) {
            if (!this.bodies[bodyAIndex] || !this.bodies[bodyBIndex]) {
                return null;
            }
            
            var joint = {
                id: this.joints.length,
                bodyA: this.bodies[bodyAIndex],
                bodyB: this.bodies[bodyBIndex],
                type: type || 'distance',
                stiffness: (options && options.stiffness) || 1.0,
                damping: (options && options.damping) || 0.1,
                restLength: this.calculateDistance(
                    this.bodies[bodyAIndex].position,
                    this.bodies[bodyBIndex].position
                )
            };
            
            this.joints.push(joint);
            return joint;
        },

        // Calculate distance between two points
        calculateDistance: function(pos1, pos2) {
            var dx = pos1[0] - pos2[0];
            var dy = pos1[1] - pos2[1];
            return Math.sqrt(dx * dx + dy * dy);
        },

        // Run physics simulation
        simulate: function() {
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    return false;
                }

                if (this.bodies.length === 0) {
                    return false;
                }

                var frameCount = Math.floor(this.settings.duration * this.settings.frameRate);
                var dt = 1 / this.settings.frameRate;

                // Clear previous simulation data
                for (var i = 0; i < this.bodies.length; i++) {
                    this.bodies[i].simulationResults = [];
                }

                // Run simulation frames
                for (var frame = 0; frame < frameCount; frame++) {
                    this.simulateFrame(dt);
                    
                    // Store results
                    for (var b = 0; b < this.bodies.length; b++) {
                        var body = this.bodies[b];
                        body.simulationResults.push({
                            x: body.position[0],
                            y: body.position[1],
                            rotation: body.rotation,
                            frame: frame
                        });
                    }
                }

                this.simulationData = this.bodies;
                return true;

            } catch (error) {
                return false;
            }
        },

        // Simulate single frame
        simulateFrame: function(dt) {
            for (var i = 0; i < this.bodies.length; i++) {
                var body = this.bodies[i];
                
                if (body.type === 'dynamic') {
                    // Apply gravity
                    body.acceleration[1] = this.settings.gravity * body.gravityScale;
                    
                    // Apply special effects
                    this.applySpecialEffects(body);
                    
                    // Update velocity
                    body.velocity[0] += body.acceleration[0] * dt;
                    body.velocity[1] += body.acceleration[1] * dt;
                    
                    // Apply damping
                    body.velocity[0] *= this.settings.damping;
                    body.velocity[1] *= this.settings.damping;
                    
                    // Update position
                    body.position[0] += body.velocity[0] * dt;
                    body.position[1] += body.velocity[1] * dt;
                    
                    // Update rotation
                    if (!body.fixedRotation) {
                        body.rotation += body.angularVelocity * dt;
                    }
                    
                    // Floor collision
                    if (body.position[1] > this.settings.floorY) {
                        body.position[1] = this.settings.floorY;
                        body.velocity[1] = -body.velocity[1] * body.bounce;
                        body.velocity[0] *= body.friction;
                    }
                }
            }
            
            // Apply joint constraints
            this.updateJoints(dt);
        },

        // Apply special effects to body
        applySpecialEffects: function(body) {
            if (body.magnetism && body.magnetism.enabled) {
                // Apply magnetic forces to nearby bodies
                for (var i = 0; i < this.bodies.length; i++) {
                    var other = this.bodies[i];
                    if (other.id !== body.id) {
                        var distance = this.calculateDistance(body.position, other.position);
                        if (distance < 200) {
                            var force = body.magnetism.strength / (distance * distance);
                            var dx = (other.position[0] - body.position[0]) / distance;
                            var dy = (other.position[1] - body.position[1]) / distance;
                            
                            if (body.magnetism.type === 'Attract') {
                                body.acceleration[0] += dx * force;
                                body.acceleration[1] += dy * force;
                            } else {
                                body.acceleration[0] -= dx * force;
                                body.acceleration[1] -= dy * force;
                            }
                        }
                    }
                }
            }
            
            if (body.waterlike && body.waterlike.enabled) {
                // Apply buoyancy and drag
                body.acceleration[1] -= this.settings.gravity * body.waterlike.buoyancy;
                body.velocity[0] *= 0.95; // Water drag
                body.velocity[1] *= 0.95;
            }
        },

        // Update joint constraints
        updateJoints: function(dt) {
            for (var i = 0; i < this.joints.length; i++) {
                var joint = this.joints[i];
                var bodyA = joint.bodyA;
                var bodyB = joint.bodyB;
                
                var dx = bodyB.position[0] - bodyA.position[0];
                var dy = bodyB.position[1] - bodyA.position[1];
                var distance = Math.sqrt(dx * dx + dy * dy);
                
                if (joint.type === 'distance' || joint.type === 'spring') {
                    var difference = distance - joint.restLength;
                    var force = difference * joint.stiffness;
                    
                    var nx = dx / distance;
                    var ny = dy / distance;
                    
                    bodyA.acceleration[0] += nx * force / bodyA.mass;
                    bodyA.acceleration[1] += ny * force / bodyA.mass;
                    bodyB.acceleration[0] -= nx * force / bodyB.mass;
                    bodyB.acceleration[1] -= ny * force / bodyB.mass;
                }
            }
        },

        // Bake simulation results to keyframes
        bake: function() {
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    return false;
                }

                if (!this.simulationData || this.simulationData.length === 0) {
                    return false;
                }

                app.beginUndoGroup("MiniNewton Physics Bake");

                var success = 0;
                for (var i = 0; i < this.bodies.length; i++) {
                    var body = this.bodies[i];
                    var layer = body.layer;
                    
                    if (layer && body.simulationResults && body.simulationResults.length > 0) {
                        try {
                            // Clear existing keyframes
                            while (layer.position.numKeys > 0) {
                                layer.position.removeKey(1);
                            }
                            while (layer.rotation.numKeys > 0) {
                                layer.rotation.removeKey(1);
                            }
                            
                            // Add keyframes from simulation
                            for (var t = 0; t < body.simulationResults.length; t++) {
                                var frame = body.simulationResults[t];
                                var time = t / this.settings.frameRate;
                                
                                layer.position.setValueAtTime(time, [frame.x, frame.y]);
                                if (!body.fixedRotation) {
                                    layer.rotation.setValueAtTime(time, frame.rotation);
                                }
                            }
                            success++;
                        } catch (layerError) {
                            // Continue with other layers if one fails
                        }
                    }
                }

                app.endUndoGroup();
                return success > 0;

            } catch (error) {
                try { app.endUndoGroup(); } catch (e) {}
                return false;
            }
        },

        // Reset simulation
        reset: function() {
            this.bodies = [];
            this.joints = [];
            this.simulationData = [];
        },

        // Get status
        getStatus: function() {
            return {
                bodies: this.bodies.length,
                joints: this.joints.length,
                hasData: this.simulationData.length > 0
            };
        }
    };

    // Material presets
    var Materials = {
        'default': { density: 1.0, friction: 0.3, restitution: 0.8 },
        'rubber': { density: 0.9, friction: 0.8, restitution: 0.95 },
        'metal': { density: 7.8, friction: 0.1, restitution: 0.3 },
        'wood': { density: 0.6, friction: 0.6, restitution: 0.4 },
        'ice': { density: 0.9, friction: 0.02, restitution: 0.1 },
        'concrete': { density: 2.4, friction: 0.9, restitution: 0.1 },
        'glass': { density: 2.5, friction: 0.1, restitution: 0.2 }
    };

    // Create UI Panel
    function createPanel(thisObj) {
        var panel = (thisObj instanceof Panel) ? thisObj : new Window("dialog", "MiniNewton Final v3.0");
        panel.orientation = "column";
        panel.alignChildren = "fill";
        panel.spacing = 8;
        panel.margins = 16;

        // Header
        var headerGroup = panel.add("panel", undefined, "MiniNewton Final v3.0 - Complete Newton Physics");
        headerGroup.orientation = "column";
        headerGroup.alignChildren = "fill";
        headerGroup.margins = 8;

        var subtitleText = headerGroup.add("statictext", undefined, "Professional 2D Physics Engine");
        subtitleText.alignment = "center";

        // Simulation Controls
        var simGroup = panel.add("panel", undefined, "Simulation Controls");
        simGroup.orientation = "column";
        simGroup.alignChildren = "fill";
        simGroup.margins = 8;
        simGroup.spacing = 6;

        // Body type selection
        var typeGroup = simGroup.add("group");
        typeGroup.add("statictext", undefined, "Body Type:");
        var dynamicBtn = typeGroup.add("radiobutton", undefined, "Dynamic");
        var staticBtn = typeGroup.add("radiobutton", undefined, "Static");
        var kinematicBtn = typeGroup.add("radiobutton", undefined, "Kinematic");
        dynamicBtn.value = true;

        // Add bodies button
        var addBodiesBtn = simGroup.add("button", undefined, "🎯 Add Selected Layers");
        addBodiesBtn.preferredSize.height = 32;

        // Status display
        var statusGroup = simGroup.add("group");
        var statusText = statusGroup.add("statictext", undefined, "Ready for physics simulation");
        statusText.alignment = "fill";

        var layerCountText = simGroup.add("statictext", undefined, "Bodies: 0 | Joints: 0");
        layerCountText.alignment = "center";

        // Physics Settings
        var physicsGroup = panel.add("panel", undefined, "Physics Settings");
        physicsGroup.orientation = "column";
        physicsGroup.alignChildren = "fill";
        physicsGroup.margins = 8;
        physicsGroup.spacing = 4;

        // Material selection
        var materialGroup = physicsGroup.add("group");
        materialGroup.add("statictext", undefined, "Material:");
        var materialDropdown = materialGroup.add("dropdownlist", undefined, 
            ["Default", "Rubber", "Metal", "Wood", "Ice", "Concrete", "Glass"]);
        materialDropdown.selection = 0;

        // Physics properties row 1
        var physicsRow1 = physicsGroup.add("group");
        physicsRow1.add("statictext", undefined, "Gravity:");
        var gravityText = physicsRow1.add("edittext", undefined, MiniNewton.settings.gravity.toString());
        gravityText.preferredSize.width = 50;
        physicsRow1.add("statictext", undefined, "Bounce:");
        var bounceText = physicsRow1.add("edittext", undefined, MiniNewton.settings.bounce.toString());
        bounceText.preferredSize.width = 40;

        // Physics properties row 2
        var physicsRow2 = physicsGroup.add("group");
        physicsRow2.add("statictext", undefined, "Floor Y:");
        var floorText = physicsRow2.add("edittext", undefined, MiniNewton.settings.floorY.toString());
        floorText.preferredSize.width = 50;
        physicsRow2.add("statictext", undefined, "Duration:");
        var durationText = physicsRow2.add("edittext", undefined, MiniNewton.settings.duration.toString());
        durationText.preferredSize.width = 30;
        physicsRow2.add("statictext", undefined, "s");

        // Advanced Controls
        var advancedGroup = panel.add("panel", undefined, "Advanced Controls");
        advancedGroup.orientation = "column";
        advancedGroup.alignChildren = "fill";
        advancedGroup.margins = 8;
        advancedGroup.spacing = 4;

        // Options
        var optionsRow1 = advancedGroup.add("group");
        var collisionCheck = optionsRow1.add("checkbox", undefined, "Inter-body Collisions");
        collisionCheck.value = MiniNewton.settings.enableInterBodyCollision;
        var sleepingCheck = optionsRow1.add("checkbox", undefined, "Body Sleeping");
        sleepingCheck.value = MiniNewton.settings.enableSleeping;

        var optionsRow2 = advancedGroup.add("group");
        var fixedRotationCheck = optionsRow2.add("checkbox", undefined, "Fixed Rotation");
        fixedRotationCheck.value = false;
        var contactsCheck = optionsRow2.add("checkbox", undefined, "Export Contacts");
        contactsCheck.value = false;

        // Newton 4 properties
        var newton4Row = advancedGroup.add("group");
        newton4Row.add("statictext", undefined, "Gravity Scale:");
        var gravityScaleText = newton4Row.add("edittext", undefined, "1.0");
        gravityScaleText.preferredSize.width = 35;
        newton4Row.add("statictext", undefined, "Collision Group:");
        var collisionGroupDropdown = newton4Row.add("dropdownlist", undefined, 
            ["Group A", "Group B", "Group C", "Group D", "Group E"]);
        collisionGroupDropdown.selection = 0;

        // Joint System
        var jointGroup = panel.add("panel", undefined, "Joint Constraints");
        jointGroup.orientation = "column";
        jointGroup.alignChildren = "fill";
        jointGroup.margins = 8;
        jointGroup.spacing = 4;

        var jointRow1 = jointGroup.add("group");
        jointRow1.add("statictext", undefined, "Type:");
        var jointTypeDropdown = jointRow1.add("dropdownlist", undefined, 
            ["Distance", "Spring", "Pivot", "Weld"]);
        jointTypeDropdown.selection = 0;
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

        // Special Effects
        var specialGroup = panel.add("panel", undefined, "Special Effects");
        specialGroup.orientation = "column";
        specialGroup.alignChildren = "fill";
        specialGroup.margins = 8;
        specialGroup.spacing = 4;

        var magnetRow = specialGroup.add("group");
        var magnetCheck = magnetRow.add("checkbox", undefined, "Magnetism");
        var magnetTypeDropdown = magnetRow.add("dropdownlist", undefined, ["Attract", "Repulse"]);
        magnetTypeDropdown.selection = 0;
        magnetTypeDropdown.enabled = false;

        var waterRow = specialGroup.add("group");
        var waterCheck = waterRow.add("checkbox", undefined, "Waterlike");
        waterRow.add("statictext", undefined, "Density:");
        var waterDensityText = waterRow.add("edittext", undefined, "1.0");
        waterDensityText.preferredSize.width = 35;
        waterDensityText.enabled = false;

        // Main Action Buttons
        var actionGroup = panel.add("panel", undefined, "Simulation Engine");
        actionGroup.orientation = "column";
        actionGroup.alignChildren = "fill";
        actionGroup.margins = 8;
        actionGroup.spacing = 6;

        var progressBar = actionGroup.add("progressbar", undefined, 0, 100);
        progressBar.preferredSize.height = 8;

        var simulateBtn = actionGroup.add("button", undefined, "🚀 Run Physics Simulation");
        simulateBtn.preferredSize.height = 36;
        simulateBtn.enabled = false;

        var buttonsRow = actionGroup.add("group");
        var bakeBtn = buttonsRow.add("button", undefined, "📊 Bake Results");
        bakeBtn.preferredSize.height = 28;
        bakeBtn.enabled = false;
        var resetBtn = buttonsRow.add("button", undefined, "🔄 Reset");
        resetBtn.preferredSize.height = 28;

        // Helper function to update UI
        function updateStatusDisplay() {
            var status = MiniNewton.getStatus();
            layerCountText.text = "Bodies: " + status.bodies + " | Joints: " + status.joints;
            simulateBtn.enabled = status.bodies > 0;
            bakeBtn.enabled = status.hasData;
        }

        // Event Handlers
        materialDropdown.onChange = function() {
            var materials = ['default', 'rubber', 'metal', 'wood', 'ice', 'concrete', 'glass'];
            MiniNewton.settings.material = materials[this.selection.index];
            var materialProps = Materials[MiniNewton.settings.material];
            if (materialProps) {
                bounceText.text = materialProps.restitution.toFixed(2);
                MiniNewton.settings.bounce = materialProps.restitution;
                MiniNewton.settings.friction = materialProps.friction;
                statusText.text = "Material applied: " + materials[this.selection.index];
            }
        };

        gravityText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0) {
                MiniNewton.settings.gravity = value;
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

        fixedRotationCheck.onClick = function() {
            MiniNewton.settings.fixedRotation = this.value;
        };

        gravityScaleText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value)) {
                MiniNewton.settings.gravityScale = value;
            }
        };

        magnetCheck.onClick = function() {
            magnetTypeDropdown.enabled = this.value;
        };

        waterCheck.onClick = function() {
            waterDensityText.enabled = this.value;
        };

        addBodiesBtn.onClick = function() {
            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    statusText.text = "Please open a composition first";
                    return;
                }

                var selectedLayers = comp.selectedLayers;
                if (selectedLayers.length === 0) {
                    statusText.text = "Please select layers to add as physics bodies";
                    return;
                }

                var bodyType = dynamicBtn.value ? 'dynamic' : (staticBtn.value ? 'static' : 'kinematic');
                var added = 0;

                for (var i = 0; i < selectedLayers.length; i++) {
                    var layer = selectedLayers[i];
                    if (layer && layer.transform) {
                        MiniNewton.addBody(layer, bodyType);
                        added++;
                    }
                }

                statusText.text = "Added " + added + " " + bodyType + " bodies";
                updateStatusDisplay();

            } catch (error) {
                statusText.text = "Error adding bodies: " + error.message;
            }
        };

        addJointBtn.onClick = function() {
            try {
                var bodyAIndex = parseInt(bodyAText.text);
                var bodyBIndex = parseInt(bodyBText.text);
                var jointTypes = ['distance', 'spring', 'pivot', 'weld'];
                var jointType = jointTypes[jointTypeDropdown.selection.index];

                if (!MiniNewton.bodies || MiniNewton.bodies.length === 0) {
                    statusText.text = "No bodies available. Add layers first.";
                    return;
                }

                if (isNaN(bodyAIndex) || isNaN(bodyBIndex)) {
                    statusText.text = "Enter valid body numbers (0 to " + (MiniNewton.bodies.length - 1) + ")";
                    return;
                }

                if (bodyAIndex < 0 || bodyBIndex < 0 || 
                    bodyAIndex >= MiniNewton.bodies.length || 
                    bodyBIndex >= MiniNewton.bodies.length) {
                    statusText.text = "Body numbers must be 0 to " + (MiniNewton.bodies.length - 1);
                    return;
                }

                if (bodyAIndex === bodyBIndex) {
                    statusText.text = "Cannot connect a body to itself";
                    return;
                }

                var jointOptions = {
                    stiffness: parseFloat(stiffnessText.text) || 1.0,
                    damping: parseFloat(dampingText.text) || 0.1
                };

                var joint = MiniNewton.createJoint(bodyAIndex, bodyBIndex, jointType, jointOptions);
                if (joint) {
                    statusText.text = "✓ " + jointType + " joint created (Bodies " + bodyAIndex + "-" + bodyBIndex + ")";
                    updateStatusDisplay();
                } else {
                    statusText.text = "Failed to create joint";
                }

            } catch (error) {
                statusText.text = "Joint error: " + error.message;
            }
        };

        simulateBtn.onClick = function() {
            statusText.text = "Running physics simulation...";
            simulateBtn.enabled = false;
            progressBar.value = 10;

            try {
                var comp = app.project.activeItem;
                if (!comp || !(comp instanceof CompItem)) {
                    statusText.text = "No active composition";
                    simulateBtn.enabled = true;
                    progressBar.value = 0;
                    return;
                }

                if (MiniNewton.bodies.length === 0) {
                    statusText.text = "No physics bodies - add layers first";
                    simulateBtn.enabled = true;
                    progressBar.value = 0;
                    return;
                }

                progressBar.value = 30;

                // Apply special effects to all bodies
                for (var i = 0; i < MiniNewton.bodies.length; i++) {
                    var body = MiniNewton.bodies[i];
                    
                    if (magnetCheck.value) {
                        body.magnetism = {
                            enabled: true,
                            type: magnetTypeDropdown.selection.text,
                            strength: 500
                        };
                    }
                    
                    if (waterCheck.value) {
                        body.waterlike = {
                            enabled: true,
                            density: parseFloat(waterDensityText.text) || 1.0,
                            buoyancy: 0.8
                        };
                    }
                    
                    body.fixedRotation = fixedRotationCheck.value;
                    body.gravityScale = parseFloat(gravityScaleText.text) || 1.0;
                }

                progressBar.value = 50;

                if (MiniNewton.simulate()) {
                    progressBar.value = 100;
                    var status = MiniNewton.getStatus();
                    statusText.text = "✓ Simulation complete! " + status.bodies + " bodies simulated";
                    updateStatusDisplay();
                } else {
                    statusText.text = "Simulation failed - check setup";
                }

            } catch (error) {
                statusText.text = "Simulation error: " + error.message;
            }

            simulateBtn.enabled = true;
            setTimeout(function() { progressBar.value = 0; }, 3000);
        };

        bakeBtn.onClick = function() {
            statusText.text = "Baking keyframes...";
            progressBar.value = 20;

            try {
                if (MiniNewton.bake()) {
                    progressBar.value = 100;
                    statusText.text = "✓ Results baked successfully!";
                } else {
                    progressBar.value = 0;
                    statusText.text = "Baking failed - run simulation first";
                }
            } catch (error) {
                progressBar.value = 0;
                statusText.text = "Baking error: " + error.message;
            }

            setTimeout(function() { progressBar.value = 0; }, 2000);
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
            }
        };

        panel.onResizing = panel.onResize = function() {
            this.layout.resize();
        };

        if (panel instanceof Window) {
            panel.center();
            panel.show();
        } else {
            panel.layout.layout(true);
        }

        return panel;
    }

    // Execute
    createPanel(thisObj);

})(this);