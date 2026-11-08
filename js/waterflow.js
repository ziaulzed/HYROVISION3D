/*
============================================================
 HYROVISION3D
 INVISIBLE FORCES BEHIND THE SHIP'S PROPELLER

 STEP 5: ANIMATED WATER FLOW AND TIP VORTICES

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 File: js/waterflow.js
 Version: 1.0

 Technology:
 JavaScript / Three.js / WebGL

 Visualisation:
 - Animated axial water flow
 - Propeller wake particles
 - Helical vortex traces
 - RPM-dependent wake animation
 - Blade-pitch-dependent wake geometry
 - Advance-speed-dependent particle movement

 Engineering classification:
 Physics-informed educational visualisation.
 Not a CFD-computed flow field.

============================================================
*/

"use strict";

(function () {

    // =====================================================
    // 01. CONFIGURATION
    // =====================================================

    const CONFIG = Object.freeze({

        bladeCount: 5,

        particleCount: 170,

        upstreamLength: 3.4,

        downstreamLength: 4.0,

        outerFlowRadius: 2.15,

        propellerRadius: 1.65,

        wakeRadius: 1.48,

        vortexPoints: 180,

        vortexLength: 3.8,

        defaultRPM: 120,

        defaultPitch: 25,

        defaultAdvanceSpeed: 5,

        maximumDeltaTime: 0.05,

        maximumWaitAttempts: 200,

        waitInterval: 100,

        colours: {

            water: 0x84E0F0,

            wake: 0x16A6B6,

            vortex: 0x65DCEB,

            guide: 0x8CBFCF

        }

    });


    // =====================================================
    // 02. MODULE REFERENCES
    // =====================================================

    let THREE = null;

    let scene = null;

    let flowGroup = null;

    let waterGroup = null;

    let vortexGroup = null;

    let waterParticles = null;

    let particleGeometry = null;

    let particlePositions = null;

    let particles = [];

    let vortexLines = [];

    let application = null;

    let unsubscribe = null;

    let animationFrameId = null;

    let lastFrameTime = null;

    let lastKnownPitch = null;

    let waitingAttempts = 0;

    let initialised = false;

    let disposed = false;


    // =====================================================
    // 03. SIMULATION STATE
    // =====================================================

    const state = {

        rpm: CONFIG.defaultRPM,

        pitch: CONFIG.defaultPitch,

        advanceSpeed: CONFIG.defaultAdvanceSpeed,

        running: false,

        elapsedTime: 0,

        waterFlowEnabled: true,

        vortexEnabled: true,

        vortexPhase: 0

    };


    // =====================================================
    // 04. MATHS HELPERS
    // =====================================================

    function clamp(value, minimum, maximum) {

        return Math.min(

            maximum,

            Math.max(minimum, value)

        );

    }


    function safeNumber(value, fallback) {

        const number = Number(value);

        return Number.isFinite(number)
            ? number
            : fallback;

    }


    function getAngularVelocity() {

        // Angular velocity in radians per second.

        return (

            2 *

            Math.PI *

            state.rpm /

            60

        );

    }


    function getFlowSpeed() {

        /*
        Educational display speed.

        Particle movement is accelerated visually
        to remain observable at classroom scale.

        This is not a solved local velocity field.
        */

        const advanceContribution =
            state.advanceSpeed * 0.22;

        const rotationalContribution =
            state.rpm * 0.004;

        return (

            advanceContribution +

            rotationalContribution

        );

    }


    function getWakeSwirl() {

        /*
        Approximate visual swirl parameter.

        Changes with RPM and blade pitch.

        This parameter controls graphics only.
        */

        const rpmFactor =
            state.rpm / 120;

        const pitchFactor =
            state.pitch / 25;

        return clamp(

            rpmFactor * pitchFactor,

            0,

            4

        );

    }


    // =====================================================
    // 05. CREATE FLOW GROUPS
    // =====================================================

    function createGroups() {

        flowGroup = new THREE.Group();

        flowGroup.name =
            "HYROVISION3D_WaterFlow";


        waterGroup = new THREE.Group();

        waterGroup.name =
            "Animated_Water_Particles";


        vortexGroup = new THREE.Group();

        vortexGroup.name =
            "Helical_Tip_Vortices";


        flowGroup.add(waterGroup);

        flowGroup.add(vortexGroup);

        scene.add(flowGroup);

    }


    // =====================================================
    // 06. PARTICLE INITIALISATION
    // =====================================================

    function createParticleData() {

        particles = [];

        const goldenAngle =

            Math.PI * (3 - Math.sqrt(5));


        const totalLength =

            CONFIG.upstreamLength +

            CONFIG.downstreamLength;


        for (

            let i = 0;

            i < CONFIG.particleCount;

            i++

        ) {

            const radialFraction =
                Math.sqrt(
                    (i + 0.5) /
                    CONFIG.particleCount
                );

            const radius =

                0.12 +

                radialFraction *

                (
                    CONFIG.outerFlowRadius -
                    0.12
                );


            const angle =
                i * goldenAngle;


            const z =

                CONFIG.upstreamLength -

                (
                    (i * 0.61803398875) % 1
                ) * totalLength;


            particles.push({

                radius: radius,

                angle: angle,

                z: z,

                initialZ: z,

                speedFactor:

                    0.75 +

                    (i % 9) * 0.065,

                swirlOffset:

                    (i % 7) * 0.11

            });

        }

    }


    // =====================================================
    // 07. CREATE WATER PARTICLES
    // =====================================================

    function createWaterParticles() {

        createParticleData();


        particlePositions =
            new Float32Array(

                CONFIG.particleCount * 3

            );


        particleGeometry =
            new THREE.BufferGeometry();


        particleGeometry.setAttribute(

            "position",

            new THREE.BufferAttribute(

                particlePositions,

                3

            )

        );


        const material =
            new THREE.PointsMaterial({

                color: CONFIG.colours.water,

                size: 0.055,

                transparent: true,

                opacity: 0.82,

                depthWrite: false,

                sizeAttenuation: true,

                blending: THREE.AdditiveBlending

            });


        waterParticles =
            new THREE.Points(

                particleGeometry,

                material

            );


        waterParticles.name =
            "Moving_Water_Particles";


        waterParticles.frustumCulled = false;

        waterGroup.add(waterParticles);


        updateParticlePositions();

    }


    // =====================================================
    // 08. PARTICLE FLOW POSITION
    //
    // Coordinate system:
    //
    // Z positive: upstream
    // Z negative: downstream
    //
    // Flow passes through the propeller plane.
    // =====================================================

    function calculateParticlePosition(particle) {

        const z = particle.z;

        const downstreamDistance =
            Math.max(0, -z);


        const wakeFactor =

            clamp(

                downstreamDistance / 2.5,

                0,

                1

            );


        // Illustrative wake contraction.

        const contraction =

            1 -

            0.12 *

            wakeFactor;


        const radius =

            particle.radius *

            contraction;


        // Swirl begins behind the propeller.

        const swirl = getWakeSwirl();


        const angularDisplacement =

            downstreamDistance *

            swirl *

            0.34;


        const angle =

            particle.angle +

            particle.swirlOffset +

            angularDisplacement;


        const x =
            radius * Math.cos(angle);


        const y =
            radius * Math.sin(angle);


        return {

            x: x,

            y: y,

            z: z

        };

    }


    // =====================================================
    // 09. UPDATE PARTICLE BUFFER
    // =====================================================

    function updateParticlePositions() {

        if (

            !particlePositions ||

            !particleGeometry

        ) {

            return;

        }


        for (

            let i = 0;

            i < particles.length;

            i++

        ) {

            const point =
                calculateParticlePosition(

                    particles[i]

                );


            const index = i * 3;


            particlePositions[index] =
                point.x;


            particlePositions[index + 1] =
                point.y;


            particlePositions[index + 2] =
                point.z;

        }


        particleGeometry.attributes.position
            .needsUpdate = true;

    }


    // =====================================================
    // 10. ANIMATE WATER PARTICLES
    // =====================================================

    function animateWaterParticles(deltaTime) {

        const speed = getFlowSpeed();


        const totalLength =

            CONFIG.upstreamLength +

            CONFIG.downstreamLength;


        for (

            const particle of particles

        ) {

            particle.z -=

                speed *

                particle.speedFactor *

                deltaTime;


            // Recycle particle upstream.

            if (

                particle.z <
                -CONFIG.downstreamLength

            ) {

                particle.z += totalLength;

            }

        }


        updateParticlePositions();

    }


    // =====================================================
    // 11. CREATE VORTEX MATERIAL
    // =====================================================

    function createVortexMaterial() {

        return new THREE.LineBasicMaterial({

            color: CONFIG.colours.vortex,

            transparent: true,

            opacity: 0.75,

            depthWrite: false

        });

    }


    // =====================================================
    // 12. GENERATE HELICAL VORTEX POINTS
    //
    // These are graphical vortex trajectories.
    //
    // They are not CFD-derived vortex cores.
    // =====================================================

    function generateVortexPoints(bladeIndex) {

        const positions = [];


        const bladeAngle =

            (
                bladeIndex /
                CONFIG.bladeCount
            ) * Math.PI * 2;


        const rpmFactor =

            state.rpm / 120;


        const pitchFactor =

            state.pitch / 25;


        const swirlIntensity =

            clamp(

                rpmFactor *

                pitchFactor,

                0,

                4

            );


        const turns =

            0.4 +

            swirlIntensity * 1.25;


        for (

            let i = 0;

            i <= CONFIG.vortexPoints;

            i++

        ) {

            const fraction =

                i /
                CONFIG.vortexPoints;


            const downstreamDistance =

                fraction *
                CONFIG.vortexLength;


            const angle =

                bladeAngle +

                turns *

                Math.PI * 2 *

                fraction;


            // Modest downstream wake contraction.

            const radius =

                CONFIG.wakeRadius *

                (
                    1 -
                    0.12 * fraction
                );


            const x =
                radius * Math.cos(angle);


            const y =
                radius * Math.sin(angle);


            const z =

                -0.12 -

                downstreamDistance;


            positions.push(

                x,

                y,

                z

            );

        }


        return positions;

    }


    // =====================================================
    // 13. CLEAR EXISTING VORTEX LINES
    // =====================================================

    function clearVortices() {

        if (!vortexGroup) {

            return;

        }


        vortexGroup.children.forEach(

            function (object) {

                if (object.geometry) {

                    object.geometry.dispose();

                }


                if (object.material) {

                    object.material.dispose();

                }

            }

        );


        vortexGroup.clear();

        vortexLines = [];

    }


    // =====================================================
    // 14. CREATE FIVE TIP VORTEX TRACES
    // =====================================================

    function createTipVortices() {

        clearVortices();


        for (

            let blade = 0;

            blade < CONFIG.bladeCount;

            blade++

        ) {

            const points =
                generateVortexPoints(blade);


            const geometry =
                new THREE.BufferGeometry();


            geometry.setAttribute(

                "position",

                new THREE.Float32BufferAttribute(

                    points,

                    3

                )

            );


            const line =
                new THREE.Line(

                    geometry,

                    createVortexMaterial()

                );


            line.name =

                "Tip_Vortex_" +
                (blade + 1);


            line.frustumCulled = false;


            vortexGroup.add(line);

            vortexLines.push(line);

        }


        lastKnownPitch = state.pitch;

    }


    // =====================================================
    // 15. ANIMATE VORTEX PHASE
    // =====================================================

    function animateVortices(deltaTime) {

        const angularVelocity =
            getAngularVelocity();


        state.vortexPhase +=

            angularVelocity *

            deltaTime;


        state.vortexPhase %=

            Math.PI * 2;


        // Graphical phase rotation.
        // This is not vortex convection from CFD.

        vortexGroup.rotation.z =
            state.vortexPhase;

    }


    // =====================================================
    // 16. APPLY DISPLAY SETTINGS
    // =====================================================

    function updateVisibility() {

        if (waterGroup) {

            waterGroup.visible =
                state.waterFlowEnabled;

        }


        if (vortexGroup) {

            vortexGroup.visible =
                state.vortexEnabled;

        }

    }


    // =====================================================
    // 17. RECEIVE APPLICATION STATE
    // =====================================================

    function updateFromApplication(

        applicationState,

        eventType

    ) {

        if (!applicationState) {

            return;

        }


        const previousRPM =
            state.rpm;


        const previousPitch =
            state.pitch;


        state.rpm = clamp(

            safeNumber(

                applicationState.rpm,

                CONFIG.defaultRPM

            ),

            0,

            300

        );


        state.pitch = clamp(

            safeNumber(

                applicationState.pitch,

                CONFIG.defaultPitch

            ),

            5,

            45

        );


        state.advanceSpeed = clamp(

            safeNumber(

                applicationState.advanceSpeed,

                CONFIG.defaultAdvanceSpeed

            ),

            0,

            15

        );


        state.running =
            Boolean(applicationState.running);


        state.waterFlowEnabled =
            Boolean(
                applicationState.waterFlowEnabled
            );


        state.vortexEnabled =
            Boolean(
                applicationState.vortexEnabled
            );


        // Rebuild vortex geometry only when
        // the operating condition changes.

        if (

            initialised &&

            (

                previousRPM !== state.rpm ||

                previousPitch !== state.pitch

            )

        ) {

            createTipVortices();

        }


        if (

            eventType === "simulation-reset"

        ) {

            resetFlow();

        }


        updateVisibility();

        updateParticlePositions();

    }


    // =====================================================
    // 18. RESET WATER FLOW
    // =====================================================

    function resetFlow() {

        state.vortexPhase = 0;

        state.elapsedTime = 0;


        for (

            const particle of particles

        ) {

            particle.z =
                particle.initialZ;

        }


        if (vortexGroup) {

            vortexGroup.rotation.z = 0;

        }


        if (initialised) {

            createTipVortices();

        }


        updateParticlePositions();

        updateVisibility();

    }


    // =====================================================
    // 19. ANIMATION CONTROLLER
    // =====================================================

    function animationFrame(timestamp) {

        if (disposed) {

            animationFrameId = null;

            return;

        }


        animationFrameId =
            requestAnimationFrame(
                animationFrame
            );


        if (lastFrameTime === null) {

            lastFrameTime = timestamp;

        }


        const deltaTime = clamp(

            (
                timestamp -
                lastFrameTime
            ) / 1000,

            0,

            CONFIG.maximumDeltaTime

        );


        lastFrameTime = timestamp;


        if (

            !initialised ||

            !state.running ||

            document.hidden

        ) {

            return;

        }


        state.elapsedTime += deltaTime;


        animateWaterParticles(deltaTime);

        animateVortices(deltaTime);


        /*
        The Three.js propeller module owns
        the main rendering loop.

        This module updates water geometry.

        The existing renderer displays the
        updated objects on its next frame.
        */

    }


    // =====================================================
    // 20. CONNECT TO MAIN APPLICATION
    // =====================================================

    function connectApplication() {

        application =
            window.HYROVISION3D;


        if (!application) {

            console.warn(

                "HYROVISION3D main controller unavailable."

            );

            return false;

        }


        if (unsubscribe) {

            unsubscribe();

        }


        unsubscribe =
            application.subscribe(

                updateFromApplication

            );


        updateFromApplication(

            application.getState(),

            "initial-sync"

        );


        return true;

    }


    // =====================================================
    // 21. FIND READY 3D RENDERER
    // =====================================================

    function getReadyRenderer() {

        const renderer =
            window.HYROVISION3D_RENDERER;


        if (

            !renderer ||

            typeof renderer.isReady !== "function"

        ) {

            return null;

        }


        if (!renderer.isReady()) {

            return null;

        }


        return renderer;

    }


    // =====================================================
    // 22. INITIALISE WATER FLOW
    // =====================================================

    function initialiseWaterFlow() {

        if (

            initialised ||

            disposed

        ) {

            return;

        }


        const propellerRenderer =
            getReadyRenderer();


        if (!propellerRenderer) {

            waitingAttempts++;


            if (

                waitingAttempts <
                CONFIG.maximumWaitAttempts

            ) {

                setTimeout(

                    initialiseWaterFlow,

                    CONFIG.waitInterval

                );

            } else {

                console.error(

                    "HYROVISION3D: Water flow could not " +
                    "connect to the 3D renderer."

                );

            }


            return;

        }


        THREE =
            propellerRenderer.getTHREE();


        scene =
            propellerRenderer.getScene();


        if (!THREE || !scene) {

            console.error(

                "HYROVISION3D: Three.js scene unavailable."

            );

            return;

        }


        createGroups();

        createWaterParticles();

        createTipVortices();


        initialised = true;


        connectApplication();

        updateVisibility();


        lastFrameTime = null;


        animationFrameId =
            requestAnimationFrame(
                animationFrame
            );


        console.info(

            "HYROVISION3D: Water flow module ready."

        );


        console.info(

            "Water particles:",

            CONFIG.particleCount

        );


        console.info(

            "Tip vortex traces:",

            CONFIG.bladeCount

        );

    }


    // =====================================================
    // 23. RESET FRAME TIME ON TAB CHANGE
    // =====================================================

    function handleVisibilityChange() {

        lastFrameTime = null;

    }


    document.addEventListener(

        "visibilitychange",

        handleVisibilityChange

    );


    // =====================================================
    // 24. PUBLIC MODULE INTERFACE
    // =====================================================

    window.HYROVISION3D_WATERFLOW =
        Object.freeze({

            initialise: initialiseWaterFlow,

            reset: resetFlow,

            updateVisibility: updateVisibility,

            getState: function () {

                return {

                    rpm: state.rpm,

                    pitch: state.pitch,

                    advanceSpeed:
                        state.advanceSpeed,

                    running: state.running,

                    waterFlowEnabled:
                        state.waterFlowEnabled,

                    vortexEnabled:
                        state.vortexEnabled,

                    particleCount:
                        particles.length,

                    vortexCount:
                        vortexLines.length,

                    ready:
                        initialised

                };

            },

            getFlowGroup: function () {

                return flowGroup;

            },

            getVortexGroup: function () {

                return vortexGroup;

            },

            isReady: function () {

                return initialised;

            }

        });


    // =====================================================
    // 25. START WATER FLOW MODULE
    // =====================================================

    if (

        document.readyState === "loading"

    ) {

        document.addEventListener(

            "DOMContentLoaded",

            initialiseWaterFlow,

            { once: true }

        );

    } else {

        initialiseWaterFlow();

    }


    // =====================================================
    // END OF FILE
    //
    // HYROVISION3D
    // Water Flow and Tip Vortex Visualisation
    //
    // Md Ziaul Haque FICS
    // Lecturer in Marine Engineering
    // =====================================================

})();