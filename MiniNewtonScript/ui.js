/*
 * ScriptUI Panel Module for MiniNewton
 * Creates dockable After Effects panel interface
 */

var UI = (function() {
    
    var self = {};
    var panel = null;
    var controls = {};
    
    /**
     * Create the main ScriptUI panel
     */
    self.createPanel = function() {
        
        // Create panel
        panel = new Window("dialog", "MiniNewton Physics", undefined, {resizeable: true});
        panel.orientation = "column";
        panel.alignChildren = "fill";
        panel.spacing = 10;
        panel.margins = 16;
        
        // Header
        var header = panel.add("panel", undefined, "MiniNewton - 2D Physics Engine");
        header.alignment = "fill";
        header.margins = 10;
        
        var headerText = header.add("statictext", undefined, "Phase 1: Gravity, Bounce & Floor Collision");
        headerText.alignment = "center";
        
        // Physics Settings Group
        var physicsGroup = panel.add("panel", undefined, "Physics Settings");
        physicsGroup.orientation = "column";
        physicsGroup.alignChildren = "fill";
        physicsGroup.margins = 10;
        physicsGroup.spacing = 8;
        
        // Gravity Control
        var gravityGroup = physicsGroup.add("group");
        gravityGroup.orientation = "row";
        gravityGroup.add("statictext", undefined, "Gravity:");
        controls.gravitySlider = gravityGroup.add("slider", undefined, MiniNewton.settings.gravity, 0, 2000);
        controls.gravitySlider.preferredSize.width = 150;
        controls.gravityText = gravityGroup.add("edittext", undefined, MiniNewton.settings.gravity.toString());
        controls.gravityText.preferredSize.width = 60;
        
        // Bounce Control
        var bounceGroup = physicsGroup.add("group");
        bounceGroup.orientation = "row";
        bounceGroup.add("statictext", undefined, "Bounce:");
        controls.bounceSlider = bounceGroup.add("slider", undefined, MiniNewton.settings.bounce, 0, 1);
        controls.bounceSlider.preferredSize.width = 150;
        controls.bounceText = bounceGroup.add("edittext", undefined, MiniNewton.settings.bounce.toString());
        controls.bounceText.preferredSize.width = 60;
        
        // Floor Position Control
        var floorGroup = physicsGroup.add("group");
        floorGroup.orientation = "row";
        floorGroup.add("statictext", undefined, "Floor Y:");
        controls.floorText = floorGroup.add("edittext", undefined, MiniNewton.settings.floorY.toString());
        controls.floorText.preferredSize.width = 80;
        floorGroup.add("statictext", undefined, "pixels");
        
        // Duration Control
        var durationGroup = physicsGroup.add("group");
        durationGroup.orientation = "row";
        durationGroup.add("statictext", undefined, "Duration:");
        controls.durationText = durationGroup.add("edittext", undefined, MiniNewton.settings.duration.toString());
        controls.durationText.preferredSize.width = 60;
        durationGroup.add("statictext", undefined, "seconds");
        
        // Material Presets Group
        var materialGroup = panel.add("panel", undefined, "Material Presets");
        materialGroup.orientation = "column";
        materialGroup.alignChildren = "fill";
        materialGroup.margins = 10;
        materialGroup.spacing = 8;
        
        // Material Selection
        var materialSelectGroup = materialGroup.add("group");
        materialSelectGroup.orientation = "row";
        materialSelectGroup.add("statictext", undefined, "Material:");
        controls.materialDropdown = materialSelectGroup.add("dropdownlist", undefined, ["Default", "Rubber", "Metal", "Wood", "Ice", "Concrete"]);
        controls.materialDropdown.selection = 0;
        controls.materialDropdown.preferredSize.width = 120;
        
        // Advanced Settings Group  
        var advancedGroup = panel.add("panel", undefined, "Advanced Settings");
        advancedGroup.orientation = "column";
        advancedGroup.alignChildren = "fill";
        advancedGroup.margins = 10;
        advancedGroup.spacing = 8;
        
        // Inter-body collision checkbox
        var collisionGroup = advancedGroup.add("group");
        collisionGroup.orientation = "row";
        controls.interBodyCollisionCheck = collisionGroup.add("checkbox", undefined, "Enable object-to-object collisions");
        controls.interBodyCollisionCheck.value = MiniNewton.settings.enableInterBodyCollision;
        
        // Sleeping optimization checkbox
        var sleepGroup = advancedGroup.add("group");
        sleepGroup.orientation = "row";
        controls.sleepingCheck = sleepGroup.add("checkbox", undefined, "Enable sleeping optimization");
        controls.sleepingCheck.value = MiniNewton.settings.enableSleeping;
        
        // Joint Builder Group
        var jointGroup = panel.add("panel", undefined, "Joint Builder");
        jointGroup.orientation = "column";
        jointGroup.alignChildren = "fill";
        jointGroup.margins = 10;
        jointGroup.spacing = 8;
        
        // Joint type selection
        var jointTypeGroup = jointGroup.add("group");
        jointTypeGroup.orientation = "row";
        jointTypeGroup.add("statictext", undefined, "Joint Type:");
        controls.jointTypeDropdown = jointTypeGroup.add("dropdownlist", undefined, ["Distance", "Spring", "Pivot", "Weld"]);
        controls.jointTypeDropdown.selection = 0;
        controls.jointTypeDropdown.preferredSize.width = 100;
        
        // Body selection for joints
        var bodySelectGroup = jointGroup.add("group");
        bodySelectGroup.orientation = "row";
        bodySelectGroup.add("statictext", undefined, "Bodies:");
        controls.bodyAText = bodySelectGroup.add("edittext", undefined, "0");
        controls.bodyAText.preferredSize.width = 30;
        bodySelectGroup.add("statictext", undefined, "to");
        controls.bodyBText = bodySelectGroup.add("edittext", undefined, "1");
        controls.bodyBText.preferredSize.width = 30;
        
        // Joint controls
        var jointControlsGroup = jointGroup.add("group");
        jointControlsGroup.orientation = "row";
        controls.createJointBtn = jointControlsGroup.add("button", undefined, "Create Joint");
        controls.createJointBtn.preferredSize.width = 100;
        controls.autoJointsBtn = jointControlsGroup.add("button", undefined, "Auto Joints");
        controls.autoJointsBtn.preferredSize.width = 100;
        
        // Joint status
        controls.jointStatusText = jointGroup.add("statictext", undefined, "Joints: 0 active");
        controls.jointStatusText.alignment = "center";
        
        // Simulation Controls Group
        var simGroup = panel.add("panel", undefined, "Simulation Controls");
        simGroup.orientation = "column";
        simGroup.alignChildren = "fill";
        simGroup.margins = 10;
        simGroup.spacing = 8;
        
        // Add Bodies Button
        controls.addBodiesBtn = simGroup.add("button", undefined, "Add Selected Layers as Physics Bodies");
        controls.addBodiesBtn.preferredSize.height = 30;
        
        // Status Display
        controls.statusText = simGroup.add("statictext", undefined, "Status: Ready");
        controls.statusText.alignment = "center";
        
        // Run Simulation Button
        controls.simulateBtn = simGroup.add("button", undefined, "Run Simulation");
        controls.simulateBtn.preferredSize.height = 35;
        controls.simulateBtn.enabled = false;
        
        // Bake Keyframes Button
        controls.bakeBtn = simGroup.add("button", undefined, "Bake Keyframes to Layers");
        controls.bakeBtn.preferredSize.height = 30;
        controls.bakeBtn.enabled = false;
        
        // Reset Button
        controls.resetBtn = simGroup.add("button", undefined, "Reset");
        controls.resetBtn.preferredSize.height = 25;
        
        // Event Handlers
        self.setupEventHandlers();
        
        // Show panel
        panel.show();
        
        return panel;
    };
    
    /**
     * Setup event handlers for UI controls
     */
    self.setupEventHandlers = function() {
        
        // Gravity slider/text sync
        controls.gravitySlider.onChanging = function() {
            controls.gravityText.text = Math.round(this.value).toString();
            MiniNewton.settings.gravity = this.value;
        };
        
        controls.gravityText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0 && value <= 2000) {
                controls.gravitySlider.value = value;
                MiniNewton.settings.gravity = value;
            }
        };
        
        // Bounce slider/text sync  
        controls.bounceSlider.onChanging = function() {
            controls.bounceText.text = this.value.toFixed(2);
            MiniNewton.settings.bounce = this.value;
        };
        
        controls.bounceText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value >= 0 && value <= 1) {
                controls.bounceSlider.value = value;
                MiniNewton.settings.bounce = value;
            }
        };
        
        // Floor position
        controls.floorText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value)) {
                MiniNewton.settings.floorY = value;
            }
        };
        
        // Duration
        controls.durationText.onChanging = function() {
            var value = parseFloat(this.text);
            if (!isNaN(value) && value > 0) {
                MiniNewton.settings.duration = value;
            }
        };
        
        // Material Selection
        controls.materialDropdown.onChange = function() {
            var materials = ['default', 'rubber', 'metal', 'wood', 'ice', 'concrete'];
            MiniNewton.settings.material = materials[this.selection.index];
            
            // Update bounce and friction based on material
            var materialProps = Physics.materials[MiniNewton.settings.material];
            if (materialProps) {
                controls.bounceSlider.value = materialProps.restitution;
                controls.bounceText.text = materialProps.restitution.toFixed(2);
                MiniNewton.settings.bounce = materialProps.restitution;
                MiniNewton.settings.friction = materialProps.friction;
            }
        };
        
        // Inter-body collision toggle
        controls.interBodyCollisionCheck.onClick = function() {
            MiniNewton.settings.enableInterBodyCollision = this.value;
        };
        
        // Sleeping optimization toggle
        controls.sleepingCheck.onClick = function() {
            MiniNewton.settings.enableSleeping = this.value;
        };
        
        // Create Joint Button
        controls.createJointBtn.onClick = function() {
            var bodyIndexA = parseInt(controls.bodyAText.text);
            var bodyIndexB = parseInt(controls.bodyBText.text);
            var jointTypes = ['distance', 'spring', 'pivot', 'weld'];
            var jointType = jointTypes[controls.jointTypeDropdown.selection.index];
            
            if (isNaN(bodyIndexA) || isNaN(bodyIndexB)) {
                Utils.showError("Please enter valid body indices");
                return;
            }
            
            if (MiniNewton.createJoint(bodyIndexA, bodyIndexB, jointType)) {
                var status = MiniNewton.getStatus();
                controls.jointStatusText.text = "Joints: " + status.joints + " active";
                self.updateStatus("Created " + jointType + " joint");
            } else {
                self.updateStatus("Failed to create joint");
            }
        };
        
        // Auto Joints Button
        controls.autoJointsBtn.onClick = function() {
            var createdCount = MiniNewton.autoCreateJoints();
            var status = MiniNewton.getStatus();
            controls.jointStatusText.text = "Joints: " + status.joints + " active";
            
            if (createdCount > 0) {
                self.updateStatus("Auto-created " + createdCount + " joints from layer names");
            } else {
                self.updateStatus("No joints created from layer names");
            }
        };
        
        // Add Bodies Button
        controls.addBodiesBtn.onClick = function() {
            self.updateStatus("Adding physics bodies...");
            
            if (MiniNewton.addBodiesFromSelection()) {
                var status = MiniNewton.getStatus();
                self.updateStatus("Added " + status.bodies + " physics bodies");
                controls.simulateBtn.enabled = true;
                
                // Update joint status display
                if (controls.jointStatusText) {
                    controls.jointStatusText.text = "Joints: " + status.joints + " active";
                }
            } else {
                self.updateStatus("Failed to add physics bodies");
                controls.simulateBtn.enabled = false;
            }
            
            controls.bakeBtn.enabled = false;
        };
        
        // Run Simulation Button
        controls.simulateBtn.onClick = function() {
            self.updateStatus("Running physics simulation...");
            controls.simulateBtn.enabled = false;
            
            // Use a short delay to allow UI update
            app.scheduleTask("MiniNewton.simulate(); UI.onSimulationComplete();", 100, false);
        };
        
        // Bake Button
        controls.bakeBtn.onClick = function() {
            self.updateStatus("Baking keyframes...");
            
            if (MiniNewton.bake()) {
                self.updateStatus("Keyframes baked successfully!");
            } else {
                self.updateStatus("Failed to bake keyframes");
            }
        };
        
        // Reset Button
        controls.resetBtn.onClick = function() {
            MiniNewton.reset();
            self.updateStatus("Reset complete");
            controls.simulateBtn.enabled = false;
            controls.bakeBtn.enabled = false;
        };
    };
    
    /**
     * Called when simulation completes
     */
    self.onSimulationComplete = function() {
        var status = MiniNewton.getStatus();
        
        if (status.hasData) {
            self.updateStatus("Simulation complete - Ready to bake");
            controls.bakeBtn.enabled = true;
        } else {
            self.updateStatus("Simulation failed");
        }
        
        controls.simulateBtn.enabled = true;
    };
    
    /**
     * Update status display
     */
    self.updateStatus = function(message) {
        if (controls.statusText) {
            controls.statusText.text = "Status: " + message;
        }
        Utils.log(message);
    };
    
    /**
     * Close panel
     */
    self.closePanel = function() {
        if (panel) {
            panel.close();
            panel = null;
        }
    };
    
    /**
     * Get panel reference
     */
    self.getPanel = function() {
        return panel;
    };
    
    return self;
})();
