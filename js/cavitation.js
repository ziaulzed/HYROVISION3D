/*
============================================================
 HYROVISION3D
 INVISIBLE FORCES BEHIND THE SHIP'S PROPELLER

 STEP 7: CAVITATION ASSESSMENT AND VISUALISATION

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 File: js/cavitation.js
 Version: 1.0

 Theme:
 Ocean Blue / Marine Navy / Marine White

 PURPOSE:
 - Illustrative cavitation assessment
 - Local pressure estimation
 - Cavitation number calculation
 - Animated vapour cavity particles
 - RPM and blade pitch response
 - Advance speed response
 - 3D propeller integration
 - Cavitation status reporting

 IMPORTANT:
 This is an educational pressure approximation.
 It is not a CFD cavitation solution.
============================================================
*/

"use strict";

(function () {

    // ======================================================
    // 01. ENGINEERING CONFIGURATION
    // ======================================================

    const CONFIG = Object.freeze({

        waterDensity: 1025,

        atmosphericPressure: 101325,

        shaftDepth: 5.0,

        gravitationalAcceleration: 9.81,

        waterTemperature: 20,

        vapourPressure: 2340,

        propellerRadius: 1.65,

        bladeCount: 5,

        referenceRadiusFraction: 0.70,

        referencePitch: 25,

        minimumPitch: 5,

        maximumPitch: 45,

        maximumRPM: 300,

        maximumAdvanceSpeed: 15,

        maximumBubbles: 75,

        bubbleRadius: 0.033,

        minimumVisiblePressureMargin: 20000,

        maximumDeltaTime: 0.05,

        waitInterval: 100,

        maximumWaitAttempts: 200

    });


    // ======================================================
    // 02. MODULE REFERENCES
    // ======================================================

    let THREE = null;

    let scene = null;

    let rotorGroup = null;

    let cavitationGroup = null;

    let bubbleGeometry = null;

    let bubbleMaterial = null;

    let bubbles = [];

    let application = null;

    let unsubscribe = null;

    let animationFrameId = null;

    let lastFrameTime = null;

    let currentAssessment = null;

    let initialised = false;

    let disposed = false;

    let waitingAttempts = 0;


    // ======================================================
    // 03. APPLICATION STATE
    // ======================================================

    const state = {

        rpm: 120,

        pitch: 25,

        advanceSpeed: 5,

        running: false,

        cavitationEnabled: false,

        elapsedTime: 0

    };


    // ======================================================
    // 04. NUMERICAL HELPERS
    // ======================================================

    function clamp(value, minimum, maximum) {

        return Math.min(

            maximum,

            Math.max(minimum, value)

        );

    }


    function finiteNumber(value) {

        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );

    }


    function formatNumber(value, decimals = 2) {

        if (!finiteNumber(value)) {

            return "--";

        }

        return value.toFixed(decimals);

    }


    // ======================================================
    // 05. AMBIENT ABSOLUTE PRESSURE
    //
    // p = atmospheric pressure + rho * g * h
    //
    // h is the assumed propeller shaft immersion.
    // ======================================================

    function calculateAmbientPressure() {

        const hydrostaticPressure =

            CONFIG.waterDensity *

            CONFIG.gravitationalAcceleration *

            CONFIG.shaftDepth;


        return (

            CONFIG.atmosphericPressure +

            hydrostaticPressure

        );

    }


    // ======================================================
    // 06. RELATIVE BLADE VELOCITY
    //
    // Vrel = sqrt(VA² + (omega*r)²)
    //
    // omega = 2 * PI * n
    //
    // This neglects induced velocities and
    // detailed local blade-flow interactions.
    // ======================================================

    function calculateRelativeVelocity(

        rpm,

        advanceSpeed

    ) {

        const n = rpm / 60;

        const omega =

            2 * Math.PI * n;


        const referenceRadius =

            CONFIG.propellerRadius *

            CONFIG.referenceRadiusFraction;


        const tangentialVelocity =

            omega *

            referenceRadius;


        return Math.sqrt(

            Math.pow(advanceSpeed, 2) +

            Math.pow(tangentialVelocity, 2)

        );

    }


    // ======================================================
    // 07. ILLUSTRATIVE PRESSURE COEFFICIENT
    //
    // This is not a measured blade pressure coefficient.
    //
    // A negative Cp represents an illustrative
    // low-pressure region on the blade.
    //
    // The pitch effect is deliberately simplified.
    // ======================================================

    function calculatePressureCoefficient(

        pitchDegrees

    ) {

        const pitch = clamp(

            pitchDegrees,

            CONFIG.minimumPitch,

            CONFIG.maximumPitch

        );


        const pitchRatio =

            Math.tan(
                pitch * Math.PI / 180
            ) /

            Math.tan(
                CONFIG.referencePitch *
                Math.PI / 180
            );


        const loadingFactor = clamp(

            Math.pow(pitchRatio, 0.65),

            0.30,

            1.75

        );


        return -1.0 * loadingFactor;

    }


    // ======================================================
    // 08. CREATE UNAVAILABLE ASSESSMENT
    // ======================================================

    function unavailableAssessment(

        status,

        message

    ) {

        return {

            valid: false,

            status: status,

            level: "unavailable",

            message: message,

            relativeVelocity: null,

            dynamicPressure: null,

            ambientPressure:
                calculateAmbientPressure(),

            localPressure: null,

            vapourPressure:
                CONFIG.vapourPressure,

            cavitationNumber: null,

            pressureCoefficient: null,

            pressureMargin: null,

            severity: 0,

            illustrative: true

        };

    }


    // ======================================================
    // 09. MAIN CAVITATION ASSESSMENT
    // ======================================================

    function calculateCavitation(inputs = {}) {

        const rpm = Number(inputs.rpm);

        const pitch = Number(inputs.pitch);

        const advanceSpeed =
            Number(inputs.advanceSpeed);


        // Validate the operating condition.

        if (

            !finiteNumber(rpm) ||

            !finiteNumber(pitch) ||

            !finiteNumber(advanceSpeed) ||

            rpm < 0 ||

            rpm > CONFIG.maximumRPM ||

            pitch < CONFIG.minimumPitch ||

            pitch > CONFIG.maximumPitch ||

            advanceSpeed < 0 ||

            advanceSpeed >
                CONFIG.maximumAdvanceSpeed

        ) {

            return unavailableAssessment(

                "invalid",

                "Invalid operating condition."

            );

        }


        // The blade-loading approximation applies
        // to a driven rotating propeller.

        if (rpm === 0) {

            return unavailableAssessment(

                "stationary",

                "Propeller stationary — rotating-blade " +
                "cavitation model not applicable."

            );

        }


        // ----------------------------------------------
        // Ambient pressure
        // ----------------------------------------------

        const ambientPressure =
            calculateAmbientPressure();


        // ----------------------------------------------
        // Relative blade velocity
        // ----------------------------------------------

        const relativeVelocity =
            calculateRelativeVelocity(

                rpm,

                advanceSpeed

            );


        // ----------------------------------------------
        // Dynamic pressure
        // ----------------------------------------------

        const dynamicPressure =

            0.5 *

            CONFIG.waterDensity *

            Math.pow(relativeVelocity, 2);


        if (dynamicPressure <= 0) {

            return unavailableAssessment(

                "zero-dynamic-pressure",

                "Dynamic pressure unavailable."

            );

        }


        // ----------------------------------------------
        // Pressure coefficient
        // ----------------------------------------------

        const pressureCoefficient =
            calculatePressureCoefficient(pitch);


        // ----------------------------------------------
        // Estimated local absolute pressure
        //
        // pLocal = pAmbient + Cp * q
        // ----------------------------------------------

        const localPressure =

            ambientPressure +

            pressureCoefficient *

            dynamicPressure;


        // ----------------------------------------------
        // Cavitation number
        // ----------------------------------------------

        const cavitationNumber =

            (
                ambientPressure -
                CONFIG.vapourPressure
            ) /

            dynamicPressure;


        // ----------------------------------------------
        // Pressure margin
        //
        // Positive:
        // Estimated pressure above vapour pressure.
        //
        // Zero or negative:
        // Illustrative cavitation threshold reached.
        // ----------------------------------------------

        const pressureMargin =

            localPressure -

            CONFIG.vapourPressure;


        // ----------------------------------------------
        // Qualitative risk classification
        // ----------------------------------------------

        let level = "low";

        let message =

            "LOW INDICATIVE RISK — estimated pressure " +
            "remains above vapour pressure.";


        if (pressureMargin <= 0) {

            level = "high";

            message =

                "HIGH INDICATIVE RISK — simplified " +
                "pressure estimate reaches the " +
                "vapour-pressure threshold.";

        } else if (

            pressureMargin <=
            CONFIG.minimumVisiblePressureMargin

        ) {

            level = "elevated";

            message =

                "ELEVATED INDICATIVE RISK — estimated " +
                "pressure approaches vapour pressure.";

        }


        // ----------------------------------------------
        // Visual severity
        //
        // Used only to adjust the bubble illustration.
        // ----------------------------------------------

        let severity = 0;


        if (level === "elevated") {

            severity = clamp(

                (
                    CONFIG.minimumVisiblePressureMargin -
                    pressureMargin
                ) /

                CONFIG.minimumVisiblePressureMargin,

                0.15,

                0.65

            );

        }


        if (level === "high") {

            severity = clamp(

                0.65 +

                Math.abs(pressureMargin) /
                200000,

                0.65,

                1

            );

        }


        return {

            valid: true,

            status: "calculated",

            level: level,

            message: message,

            rpm: rpm,

            pitch: pitch,

            advanceSpeed: advanceSpeed,

            ambientPressure: ambientPressure,

            localPressure: localPressure,

            vapourPressure:
                CONFIG.vapourPressure,

            relativeVelocity:
                relativeVelocity,

            dynamicPressure:
                dynamicPressure,

            pressureCoefficient:
                pressureCoefficient,

            pressureMargin:
                pressureMargin,

            cavitationNumber:
                cavitationNumber,

            severity:
                severity,

            illustrative: true,

            assumedDepth:
                CONFIG.shaftDepth,

            assumedTemperature:
                CONFIG.waterTemperature

        };

    }


    // ======================================================
    // 10. CREATE 3D CAVITATION GROUP
    //
    // The bubble group is attached to the rotor.
    // It follows the propeller as it rotates.
    // ======================================================

    function createCavitationGroup() {

        cavitationGroup =
            new THREE.Group();


        cavitationGroup.name =
            "HYROVISION3D_Cavitation";


        rotorGroup.add(cavitationGroup);

    }


    // ======================================================
    // 11. CREATE BUBBLE MATERIAL
    // ======================================================

    function createBubbleMaterial() {

        return new THREE.MeshPhysicalMaterial({

            color: 0xD8F7FC,

            metalness: 0,

            roughness: 0.16,

            transparent: true,

            opacity: 0.48,

            depthWrite: false,

            side: THREE.DoubleSide

        });

    }


    // ======================================================
    // 12. CREATE BUBBLE GEOMETRY
    // ======================================================

    function createBubbleGeometry() {

        return new THREE.SphereGeometry(

            CONFIG.bubbleRadius,

            8,

            6

        );

    }


    // ======================================================
    // 13. CREATE ANIMATED BUBBLES
    // ======================================================

    function createBubbles() {

        bubbleGeometry =
            createBubbleGeometry();


        bubbleMaterial =
            createBubbleMaterial();


        bubbles = [];


        for (

            let i = 0;

            i < CONFIG.maximumBubbles;

            i++

        ) {

            const bubble =
                new THREE.Mesh(

                    bubbleGeometry,

                    bubbleMaterial

                );


            bubble.name =

                "Cavitation_Bubble_" +
                (i + 1);


            bubble.visible = false;


            // Spread bubbles between five blades.

            const bladeIndex =

                i % CONFIG.bladeCount;


            const bladeAngle =

                bladeIndex *

                Math.PI * 2 /

                CONFIG.bladeCount;


            const radialFraction =

                0.42 +

                (
                    (i * 7) % 29
                ) / 50;


            const radius =

                CONFIG.propellerRadius *

                radialFraction;


            const angularOffset =

                (
                    (i * 11) % 17
                ) * 0.013;


            const angle =

                bladeAngle +

                angularOffset;


            const radialPosition =

                clamp(

                    radius,

                    0.5,

                    CONFIG.propellerRadius * 0.97

                );


            const x =

                radialPosition *

                Math.cos(angle);


            const y =

                radialPosition *

                Math.sin(angle);


            const z =

                0.08 +

                (i % 9) * 0.018;


            bubble.position.set(

                x,

                y,

                z

            );


            const sizeFactor =

                0.45 +

                (i % 7) * 0.16;


            bubble.scale.setScalar(
                sizeFactor
            );


            bubble.userData = {

                baseX: x,

                baseY: y,

                baseZ: z,

                sizeFactor: sizeFactor,

                phase:

                    i * 0.61,

                driftFactor:

                    0.5 +
                    (i % 8) * 0.11

            };


            cavitationGroup.add(bubble);

            bubbles.push(bubble);

        }

    }


    // ======================================================
    // 14. UPDATE BUBBLE VISIBILITY
    // ======================================================

    function updateBubbleVisibility() {

        if (!cavitationGroup) {

            return;

        }


        if (

            !state.cavitationEnabled ||

            !currentAssessment ||

            !currentAssessment.valid

        ) {

            cavitationGroup.visible = false;

            return;

        }


        cavitationGroup.visible = true;


        const severity =
            currentAssessment.severity;


        const visibleCount =

            Math.floor(

                CONFIG.maximumBubbles *

                severity

            );


        bubbles.forEach(

            function (bubble, index) {

                bubble.visible =

                    index < visibleCount;

            }

        );

    }


    // ======================================================
    // 15. ANIMATE BUBBLES
    // ======================================================

    function animateBubbles(deltaTime) {

        if (

            !state.running ||

            !state.cavitationEnabled ||

            !currentAssessment ||

            !currentAssessment.valid ||

            currentAssessment.severity <= 0

        ) {

            return;

        }


        state.elapsedTime += deltaTime;


        const time =
            state.elapsedTime;


        const severity =
            currentAssessment.severity;


        bubbles.forEach(

            function (bubble) {

                if (!bubble.visible) {

                    return;

                }


                const data =
                    bubble.userData;


                const movement =

                    time *

                    data.driftFactor;


                // Illustrative axial bubble motion.

                const axialDrift =

                    (
                        movement * 0.28
                    ) % 0.65;


                const lateralOscillation =

                    Math.sin(

                        time * 2.4 +

                        data.phase

                    ) * 0.018;


                bubble.position.x =

                    data.baseX +

                    lateralOscillation;


                bubble.position.y =

                    data.baseY +

                    Math.cos(

                        time * 2.1 +

                        data.phase

                    ) * 0.018;


                bubble.position.z =

                    data.baseZ -

                    axialDrift;


                const pulsation =

                    1 +

                    0.22 *

                    Math.sin(

                        time * 4.2 +

                        data.phase

                    );


                const bubbleScale =

                    data.sizeFactor *

                    pulsation *

                    (
                        0.7 +
                        severity * 0.5
                    );


                bubble.scale.setScalar(

                    bubbleScale

                );

            }

        );

    }


    // ======================================================
    // 16. RESET BUBBLE POSITIONS
    // ======================================================

    function resetBubbles() {

        state.elapsedTime = 0;


        bubbles.forEach(

            function (bubble) {

                const data =
                    bubble.userData;


                bubble.position.set(

                    data.baseX,

                    data.baseY,

                    data.baseZ

                );


                bubble.scale.setScalar(

                    data.sizeFactor

                );

            }

        );


        updateBubbleVisibility();

    }


    // ======================================================
    // 17. DASHBOARD CAVITATION STATUS
    // ======================================================

    function updateCavitationStatus() {

        const statusElement =
            document.getElementById(

                "cavitationStatus"

            );


        if (!statusElement) {

            return;

        }


        statusElement.classList.remove(

            "cavitation-safe",

            "cavitation-warning",

            "cavitation-danger"

        );


        if (!currentAssessment) {

            statusElement.textContent =

                "Cavitation assessment unavailable.";

            return;

        }


        statusElement.textContent =

            currentAssessment.message;


        if (

            currentAssessment.level === "low"

        ) {

            statusElement.classList.add(

                "cavitation-safe"

            );

        }


        if (

            currentAssessment.level === "elevated"

        ) {

            statusElement.classList.add(

                "cavitation-warning"

            );

        }


        if (

            currentAssessment.level === "high"

        ) {

            statusElement.classList.add(

                "cavitation-danger"

            );

        }

    }


    // ======================================================
    // 18. UPDATE CAVITATION ENGINEERING DATA
    // ======================================================

    function updateCavitationReadings() {

        const pressureElement =
            document.getElementById(

                "localPressureValue"

            );


        const sigmaElement =
            document.getElementById(

                "cavitationNumberValue"

            );


        const marginElement =
            document.getElementById(

                "pressureMarginValue"

            );


        const modelElement =
            document.getElementById(

                "cavitationModelStatus"

            );


        if (!currentAssessment) {

            return;

        }


        if (pressureElement) {

            pressureElement.textContent =

                finiteNumber(
                    currentAssessment.localPressure
                )

                    ? formatNumber(

                        currentAssessment.localPressure /
                        1000,

                        1

                    )

                    : "--";

        }


        if (sigmaElement) {

            sigmaElement.textContent =

                formatNumber(

                    currentAssessment.cavitationNumber,

                    3

                );

        }


        if (marginElement) {

            marginElement.textContent =

                finiteNumber(
                    currentAssessment.pressureMargin
                )

                    ? formatNumber(

                        currentAssessment.pressureMargin /
                        1000,

                        1

                    )

                    : "--";

        }


        if (modelElement) {

            modelElement.textContent =

                currentAssessment.valid

                    ? "Illustrative pressure model"

                    : "Assessment unavailable";

        }

    }


    // ======================================================
    // 19. CALCULATE AND UPDATE
    // ======================================================

    function recalculateCavitation() {

        currentAssessment =
            calculateCavitation({

                rpm: state.rpm,

                pitch: state.pitch,

                advanceSpeed:
                    state.advanceSpeed

            });


        updateCavitationStatus();

        updateCavitationReadings();

        updateBubbleVisibility();


        document.dispatchEvent(

            new CustomEvent(

                "hyrovision:cavitation",

                {

                    detail: {

                        assessment:
                            { ...currentAssessment }

                    }

                }

            )

        );

    }


    // ======================================================
    // 20. RECEIVE APPLICATION STATE
    // ======================================================

    function updateFromApplication(

        applicationState,

        eventType

    ) {

        if (!applicationState) {

            return;

        }


        const oldRPM =
            state.rpm;


        const oldPitch =
            state.pitch;


        const oldSpeed =
            state.advanceSpeed;


        state.rpm = clamp(

            Number(applicationState.rpm) || 0,

            0,

            CONFIG.maximumRPM

        );


        state.pitch = clamp(

            Number(applicationState.pitch) || 25,

            CONFIG.minimumPitch,

            CONFIG.maximumPitch

        );


        state.advanceSpeed = clamp(

            Number(applicationState.advanceSpeed) || 0,

            0,

            CONFIG.maximumAdvanceSpeed

        );


        state.running =
            Boolean(applicationState.running);


        state.cavitationEnabled =
            Boolean(
                applicationState.cavitationEnabled
            );


        if (

            oldRPM !== state.rpm ||

            oldPitch !== state.pitch ||

            oldSpeed !== state.advanceSpeed ||

            !currentAssessment

        ) {

            recalculateCavitation();

        }


        if (

            eventType === "simulation-reset"

        ) {

            resetBubbles();

            recalculateCavitation();

        }


        updateBubbleVisibility();

    }


    // ======================================================
    // 21. CONNECT MAIN APPLICATION
    // ======================================================

    function connectApplication() {

        application =
            window.HYROVISION3D;


        if (

            !application ||

            typeof application.subscribe !== "function"

        ) {

            console.error(

                "HYROVISION3D cavitation: " +
                "Main application unavailable."

            );

            return false;

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


    // ======================================================
    // 22. ANIMATION LOOP
    // ======================================================

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


        if (document.hidden) {

            return;

        }


        if (

            state.running &&

            state.cavitationEnabled

        ) {

            animateBubbles(deltaTime);

        }

    }


    // ======================================================
    // 23. WAIT FOR PROPELLER RENDERER
    // ======================================================

    function getReadyRenderer() {

        const propellerRenderer =
            window.HYROVISION3D_RENDERER;


        if (!propellerRenderer) {

            return null;

        }


        if (

            typeof propellerRenderer.isReady !==
            "function"

        ) {

            return null;

        }


        if (!propellerRenderer.isReady()) {

            return null;

        }


        return propellerRenderer;

    }


    // ======================================================
    // 24. INITIALISE CAVITATION MODULE
    // ======================================================

    function initialiseCavitation() {

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

                    initialiseCavitation,

                    CONFIG.waitInterval

                );

            } else {

                console.error(

                    "HYROVISION3D cavitation: " +
                    "3D renderer unavailable."

                );

            }


            return;

        }


        THREE =
            propellerRenderer.getTHREE();


        scene =
            propellerRenderer.getScene();


        rotorGroup =
            propellerRenderer.getRotorGroup();


        if (

            !THREE ||

            !scene ||

            !rotorGroup

        ) {

            console.error(

                "HYROVISION3D cavitation: " +
                "Required 3D objects unavailable."

            );

            return;

        }


        createCavitationGroup();

        createBubbles();


        initialised = true;


        connectApplication();

        recalculateCavitation();

        updateBubbleVisibility();


        document.addEventListener(

            "visibilitychange",

            function () {

                lastFrameTime = null;

            }

        );


        animationFrameId =
            requestAnimationFrame(

                animationFrame

            );


        console.info(

            "HYROVISION3D: Cavitation module ready."

        );


        console.info(

            "Cavitation model: Illustrative"

        );


        console.info(

            "Assumed immersion:",

            CONFIG.shaftDepth,

            "m"

        );

    }


    // ======================================================
    // 25. PUBLIC INTERFACE
    // ======================================================

    window.HYROVISION3D_CAVITATION =
        Object.freeze({

            config: CONFIG,

            initialise:
                initialiseCavitation,

            calculate:
                calculateCavitation,

            recalculate:
                recalculateCavitation,

            reset:
                resetBubbles,

            getAssessment: function () {

                return currentAssessment

                    ? { ...currentAssessment }

                    : null;

            },

            getGroup: function () {

                return cavitationGroup;

            },

            getBubbleCount: function () {

                return bubbles.filter(

                    bubble => bubble.visible

                ).length;

            },

            isReady: function () {

                return initialised;

            }

        });


    // ======================================================
    // 26. START MODULE
    // ======================================================

    if (

        document.readyState === "loading"

    ) {

        document.addEventListener(

            "DOMContentLoaded",

            initialiseCavitation,

            { once: true }

        );

    } else {

        initialiseCavitation();

    }


    // ======================================================
    // END OF FILE
    //
    // HYROVISION3D
    // Cavitation Assessment and Visualisation
    //
    // Md Ziaul Haque FICS
    // Lecturer in Marine Engineering
    // ======================================================

})();