/* ============================================================
   HYROVISION3D
   INVISIBLE FORCES BEHIND THE SHIP'S PROPELLER

   MAIN APPLICATION CONTROLLER

   Project:
   Interactive Marine Propeller Hydrodynamics Simulator

   Author:
   Md Ziaul Haque FICS
   Lecturer in Marine Engineering

   File: script.js
   Version: 1.0

   Theme:
   Ocean Blue / Marine Navy / White

   Purpose:
   - Operating condition controls
   - Simulation lifecycle management
   - Navigation
   - Display settings
   - Module communication
   - Reset and error handling

   Engineering calculations and the 3D renderer are
   connected in subsequent development steps.
   ============================================================ */


"use strict";


/* ============================================================
   01. APPLICATION CONFIGURATION
   ============================================================ */

const HYROVISION_CONFIG = Object.freeze({

    name: "HYROVISION3D",

    version: "1.0",

    author: "Md Ziaul Haque FICS",

    designation: "Lecturer in Marine Engineering",

    units: "SI",

    defaultRPM: 120,

    defaultPitch: 25,

    defaultAdvanceSpeed: 5.0,

    minimumRPM: 0,

    maximumRPM: 300,

    minimumPitch: 5,

    maximumPitch: 45,

    minimumAdvanceSpeed: 0,

    maximumAdvanceSpeed: 15,

    updateInterval: 100

});


/* ============================================================
   02. APPLICATION STATE
   ============================================================ */

const simulationState = {

    rpm: HYROVISION_CONFIG.defaultRPM,

    pitch: HYROVISION_CONFIG.defaultPitch,

    advanceSpeed: HYROVISION_CONFIG.defaultAdvanceSpeed,

    running: false,

    paused: false,

    elapsedTime: 0,

    lastFrameTime: null,

    animationFrameId: null,

    lastUpdateTime: 0,

    waterFlowEnabled: true,

    vortexEnabled: true,

    pressureEnabled: false,

    cavitationEnabled: false,

    activeView: "simulation"

};


/* ============================================================
   03. DOM ELEMENT REFERENCES
   ============================================================ */

const elements = {

    rpmSlider: document.getElementById("rpmSlider"),

    rpmValue: document.getElementById("rpmValue"),

    pitchSlider: document.getElementById("pitchSlider"),

    pitchValue: document.getElementById("pitchValue"),

    speedSlider: document.getElementById("speedSlider"),

    speedValue: document.getElementById("speedValue"),

    waterToggle: document.getElementById("waterToggle"),

    vortexToggle: document.getElementById("vortexToggle"),

    pressureToggle: document.getElementById("pressureToggle"),

    cavitationToggle:
        document.getElementById("cavitationToggle"),

    startButton: document.getElementById("startButton"),

    pauseButton: document.getElementById("pauseButton"),

    resetButton: document.getElementById("resetButton"),

    systemStatus: document.getElementById("systemStatus"),

    loadingMessage:
        document.getElementById("loadingMessage"),

    propellerContainer:
        document.getElementById("propellerContainer"),

    thrustValue: document.getElementById("thrustValue"),

    torqueValue: document.getElementById("torqueValue"),

    powerValue: document.getElementById("powerValue"),

    efficiencyValue:
        document.getElementById("efficiencyValue"),

    cavitationStatus:
        document.getElementById("cavitationStatus"),

    navigationButtons:
        document.querySelectorAll(".nav-button")

};


/* ============================================================
   04. MODULE COMMUNICATION

   Future modules can subscribe to state changes.

   Current state is exposed through getState().

   ============================================================ */

const subscribers = new Set();


function getState() {

    return {

        rpm: simulationState.rpm,

        pitch: simulationState.pitch,

        advanceSpeed: simulationState.advanceSpeed,

        running: simulationState.running,

        paused: simulationState.paused,

        elapsedTime: simulationState.elapsedTime,

        waterFlowEnabled:
            simulationState.waterFlowEnabled,

        vortexEnabled:
            simulationState.vortexEnabled,

        pressureEnabled:
            simulationState.pressureEnabled,

        cavitationEnabled:
            simulationState.cavitationEnabled,

        activeView:
            simulationState.activeView

    };

}


function subscribe(callback) {

    if (typeof callback !== "function") {

        throw new TypeError(
            "Subscriber must be a function."
        );

    }

    subscribers.add(callback);

    return function unsubscribe() {

        subscribers.delete(callback);

    };

}


function notifySubscribers(eventType) {

    const state = getState();

    subscribers.forEach(function (callback) {

        try {

            callback(state, eventType);

        } catch (error) {

            console.error(
                "HYROVISION3D subscriber error:",
                error
            );

        }

    });

    document.dispatchEvent(

        new CustomEvent("hyrovision:change", {

            detail: {

                type: eventType,

                state: state

            }

        })

    );

}


/* ============================================================
   05. SAFE NUMERICAL INPUT HANDLING
   ============================================================ */

function clamp(value, minimum, maximum) {

    return Math.min(
        maximum,
        Math.max(minimum, value)
    );

}


function readNumber(

    input,

    fallback,

    minimum,

    maximum

) {

    if (!input) {

        return fallback;

    }

    const rawValue = input.value.trim();

    if (rawValue === "") {

        return fallback;

    }

    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue)) {

        return fallback;

    }

    return clamp(
        parsedValue,
        minimum,
        maximum
    );

}


/* ============================================================
   06. UPDATE OPERATING CONDITIONS
   ============================================================ */

function updateRPM() {

    simulationState.rpm = readNumber(

        elements.rpmSlider,

        HYROVISION_CONFIG.defaultRPM,

        HYROVISION_CONFIG.minimumRPM,

        HYROVISION_CONFIG.maximumRPM

    );

    elements.rpmSlider.value = simulationState.rpm;

    elements.rpmValue.textContent =
        simulationState.rpm.toFixed(0);

    notifySubscribers("rpm-change");

}


function updatePitch() {

    simulationState.pitch = readNumber(

        elements.pitchSlider,

        HYROVISION_CONFIG.defaultPitch,

        HYROVISION_CONFIG.minimumPitch,

        HYROVISION_CONFIG.maximumPitch

    );

    elements.pitchSlider.value = simulationState.pitch;

    elements.pitchValue.textContent =
        simulationState.pitch.toFixed(0);

    notifySubscribers("pitch-change");

}


function updateAdvanceSpeed() {

    simulationState.advanceSpeed = readNumber(

        elements.speedSlider,

        HYROVISION_CONFIG.defaultAdvanceSpeed,

        HYROVISION_CONFIG.minimumAdvanceSpeed,

        HYROVISION_CONFIG.maximumAdvanceSpeed

    );

    elements.speedSlider.value =
        simulationState.advanceSpeed;

    elements.speedValue.textContent =
        simulationState.advanceSpeed.toFixed(1);

    notifySubscribers("speed-change");

}


/* ============================================================
   07. UPDATE VISUALISATION SETTINGS
   ============================================================ */

function updateVisualisationSettings() {

    simulationState.waterFlowEnabled =
        elements.waterToggle.checked;

    simulationState.vortexEnabled =
        elements.vortexToggle.checked;

    simulationState.pressureEnabled =
        elements.pressureToggle.checked;

    simulationState.cavitationEnabled =
        elements.cavitationToggle.checked;

    notifySubscribers("visualisation-change");

}


/* ============================================================
   08. STATUS MANAGEMENT
   ============================================================ */

function setSystemStatus(status, message) {

    document.body.classList.remove(

        "is-running",

        "is-paused",

        "is-stopped"

    );

    if (status === "running") {

        document.body.classList.add("is-running");

    } else if (status === "paused") {

        document.body.classList.add("is-paused");

    } else {

        document.body.classList.add("is-stopped");

    }

    elements.systemStatus.textContent = message;

}


/* ============================================================
   09. APPLICATION FRAME CONTROLLER

   This maintains simulation elapsed time.

   The 3D rendering module will have its own animation
   updates and will use the shared simulation state.

   ============================================================ */

function simulationFrame(timestamp) {

    simulationState.animationFrameId = null;

    if (!simulationState.running) {

        return;

    }

    if (simulationState.lastFrameTime === null) {

        simulationState.lastFrameTime = timestamp;

    }

    const deltaTime = clamp(

        (timestamp - simulationState.lastFrameTime) / 1000,

        0,

        0.1

    );

    simulationState.lastFrameTime = timestamp;

    simulationState.elapsedTime += deltaTime;

    if (

        timestamp - simulationState.lastUpdateTime >=
        HYROVISION_CONFIG.updateInterval

    ) {

        simulationState.lastUpdateTime = timestamp;

        notifySubscribers("simulation-tick");

    }

    simulationState.animationFrameId =
        requestAnimationFrame(simulationFrame);

}


/* ============================================================
   10. START SIMULATION
   ============================================================ */

function startSimulation() {

    if (simulationState.running) {

        return;

    }

    simulationState.running = true;

    simulationState.paused = false;

    simulationState.lastFrameTime = null;

    simulationState.lastUpdateTime = 0;

    setSystemStatus(

        "running",

        "Controller Running — 3D Pending"

    );

    elements.startButton.textContent =
        "Simulation Running";

    elements.startButton.disabled = true;

    elements.pauseButton.disabled = false;

    notifySubscribers("simulation-start");

    simulationState.animationFrameId =
        requestAnimationFrame(simulationFrame);

}


/* ============================================================
   11. PAUSE SIMULATION
   ============================================================ */

function pauseSimulation() {

    if (!simulationState.running) {

        return;

    }

    simulationState.running = false;

    simulationState.paused = true;

    if (simulationState.animationFrameId !== null) {

        cancelAnimationFrame(
            simulationState.animationFrameId
        );

        simulationState.animationFrameId = null;

    }

    simulationState.lastFrameTime = null;

    setSystemStatus(

        "paused",

        "Controller Paused"

    );

    elements.startButton.textContent =
        "Resume Simulation";

    elements.startButton.disabled = false;

    elements.pauseButton.disabled = true;

    notifySubscribers("simulation-pause");

}


/* ============================================================
   12. STOP SIMULATION
   ============================================================ */

function stopSimulation() {

    simulationState.running = false;

    simulationState.paused = false;

    if (simulationState.animationFrameId !== null) {

        cancelAnimationFrame(
            simulationState.animationFrameId
        );

        simulationState.animationFrameId = null;

    }

    simulationState.lastFrameTime = null;

    simulationState.lastUpdateTime = 0;

    elements.startButton.textContent =
        "Start Simulation";

    elements.startButton.disabled = false;

    elements.pauseButton.disabled = true;

}


/* ============================================================
   13. ENGINEERING READOUT MANAGEMENT

   Numerical results are intentionally not invented.

   Future calculation modules will call
   updateEngineeringResults().

   ============================================================ */

function formatEngineeringValue(value, decimals) {

    if (

        typeof value !== "number" ||

        !Number.isFinite(value)

    ) {

        return "--";

    }

    return value.toFixed(decimals);

}


function updateEngineeringResults(results = {}) {

    elements.thrustValue.textContent =
        formatEngineeringValue(
            results.thrust,
            2
        );

    elements.torqueValue.textContent =
        formatEngineeringValue(
            results.torque,
            2
        );

    elements.powerValue.textContent =
        formatEngineeringValue(
            results.power,
            2
        );

    elements.efficiencyValue.textContent =
        formatEngineeringValue(
            results.efficiency,
            1
        );

    if (typeof results.cavitationStatus === "string") {

        elements.cavitationStatus.textContent =
            results.cavitationStatus;

    } else {

        elements.cavitationStatus.textContent =
            "Awaiting hydrodynamic model";

    }

    elements.cavitationStatus.classList.remove(

        "cavitation-safe",

        "cavitation-warning",

        "cavitation-danger"

    );

    const acceptedClasses = {

        safe: "cavitation-safe",

        warning: "cavitation-warning",

        danger: "cavitation-danger"

    };

    if (

        results.cavitationLevel &&

        Object.prototype.hasOwnProperty.call(
            acceptedClasses,
            results.cavitationLevel
        )

    ) {

        elements.cavitationStatus.classList.add(
            acceptedClasses[results.cavitationLevel]
        );

    }

}


/* ============================================================
   14. RESET OPERATING CONDITIONS
   ============================================================ */

function resetSimulation() {

    stopSimulation();

    simulationState.rpm =
        HYROVISION_CONFIG.defaultRPM;

    simulationState.pitch =
        HYROVISION_CONFIG.defaultPitch;

    simulationState.advanceSpeed =
        HYROVISION_CONFIG.defaultAdvanceSpeed;

    simulationState.elapsedTime = 0;

    simulationState.waterFlowEnabled = true;

    simulationState.vortexEnabled = true;

    simulationState.pressureEnabled = false;

    simulationState.cavitationEnabled = false;

    elements.rpmSlider.value =
        simulationState.rpm;

    elements.pitchSlider.value =
        simulationState.pitch;

    elements.speedSlider.value =
        simulationState.advanceSpeed;

    elements.waterToggle.checked = true;

    elements.vortexToggle.checked = true;

    elements.pressureToggle.checked = false;

    elements.cavitationToggle.checked = false;

    elements.rpmValue.textContent =
        simulationState.rpm.toFixed(0);

    elements.pitchValue.textContent =
        simulationState.pitch.toFixed(0);

    elements.speedValue.textContent =
        simulationState.advanceSpeed.toFixed(1);

    updateEngineeringResults();

    setSystemStatus(

        "stopped",

        "Controls Ready — 3D Pending"

    );

    notifySubscribers("simulation-reset");

}


/* ============================================================
   15. MAIN NAVIGATION
   ============================================================ */

const navigationTargets = {

    simulation: ".simulation-layout",

    performance: ".analysis-section",

    engineering: ".engineering-section"

};


function activateNavigation(view) {

    if (

        !Object.prototype.hasOwnProperty.call(
            navigationTargets,
            view
        )

    ) {

        return;

    }

    simulationState.activeView = view;

    elements.navigationButtons.forEach(function (button) {

        const active = button.dataset.view === view;

        button.classList.toggle("active", active);

        if (active) {

            button.setAttribute(
                "aria-current",
                "true"
            );

        } else {

            button.removeAttribute("aria-current");

        }

    });

    const target = document.querySelector(
        navigationTargets[view]
    );

    if (target) {

        const reducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        target.scrollIntoView({

            behavior: reducedMotion ? "auto" : "smooth",

            block: "start"

        });

    }

    notifySubscribers("navigation-change");

}


/* ============================================================
   16. LOADING MESSAGE

   The message remains visible until the 3D module
   is connected and confirms successful rendering.

   ============================================================ */

function setLoadingMessage(title, description) {

    if (!elements.loadingMessage) {

        return;

    }

    const heading =
        elements.loadingMessage.querySelector("h3");

    const paragraph =
        elements.loadingMessage.querySelector("p");

    const detail =
        elements.loadingMessage.querySelector("small");

    if (heading) {

        heading.textContent = title;

    }

    if (paragraph) {

        paragraph.textContent = description;

    }

    if (detail) {

        detail.textContent =
            "The 3D rendering engine will be connected in Step 4.";

    }

}


/* ============================================================
   17. EVENT LISTENERS
   ============================================================ */

function registerEventListeners() {

    elements.rpmSlider.addEventListener(

        "input",

        updateRPM

    );

    elements.pitchSlider.addEventListener(

        "input",

        updatePitch

    );

    elements.speedSlider.addEventListener(

        "input",

        updateAdvanceSpeed

    );


    const visualisationToggles = [

        elements.waterToggle,

        elements.vortexToggle,

        elements.pressureToggle,

        elements.cavitationToggle

    ];

    visualisationToggles.forEach(function (toggle) {

        toggle.addEventListener(

            "change",

            updateVisualisationSettings

        );

    });


    elements.startButton.addEventListener(

        "click",

        startSimulation

    );


    elements.pauseButton.addEventListener(

        "click",

        pauseSimulation

    );


    elements.resetButton.addEventListener(

        "click",

        resetSimulation

    );


    elements.navigationButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            activateNavigation(
                button.dataset.view
            );

        });

    });

}


/* ============================================================
   18. APPLICATION INITIALISATION
   ============================================================ */

let applicationInitialised = false;


function initialiseApplication() {

    if (applicationInitialised) {

        return;

    }

    const requiredElements = [

        "rpmSlider",

        "rpmValue",

        "pitchSlider",

        "pitchValue",

        "speedSlider",

        "speedValue",

        "waterToggle",

        "vortexToggle",

        "pressureToggle",

        "cavitationToggle",

        "startButton",

        "pauseButton",

        "resetButton",

        "systemStatus",

        "propellerContainer",

        "thrustValue",

        "torqueValue",

        "powerValue",

        "efficiencyValue",

        "cavitationStatus"

    ];

    const missingElements = requiredElements.filter(

        function (name) {

            return !elements[name];

        }

    );

    if (missingElements.length > 0) {

        console.error(

            "HYROVISION3D: Missing HTML elements:",

            missingElements

        );

        return;

    }

    applicationInitialised = true;

    registerEventListeners();

    simulationState.rpm =
        readNumber(
            elements.rpmSlider,
            HYROVISION_CONFIG.defaultRPM,
            HYROVISION_CONFIG.minimumRPM,
            HYROVISION_CONFIG.maximumRPM
        );

    simulationState.pitch =
        readNumber(
            elements.pitchSlider,
            HYROVISION_CONFIG.defaultPitch,
            HYROVISION_CONFIG.minimumPitch,
            HYROVISION_CONFIG.maximumPitch
        );

    simulationState.advanceSpeed =
        readNumber(
            elements.speedSlider,
            HYROVISION_CONFIG.defaultAdvanceSpeed,
            HYROVISION_CONFIG.minimumAdvanceSpeed,
            HYROVISION_CONFIG.maximumAdvanceSpeed
        );

    simulationState.waterFlowEnabled =
        elements.waterToggle.checked;

    simulationState.vortexEnabled =
        elements.vortexToggle.checked;

    simulationState.pressureEnabled =
        elements.pressureToggle.checked;

    simulationState.cavitationEnabled =
        elements.cavitationToggle.checked;

    elements.rpmValue.textContent =
        simulationState.rpm.toFixed(0);

    elements.pitchValue.textContent =
        simulationState.pitch.toFixed(0);

    elements.speedValue.textContent =
        simulationState.advanceSpeed.toFixed(1);

    elements.pauseButton.disabled = true;

    updateEngineeringResults();

    setSystemStatus(

        "stopped",

        "Controls Ready — 3D Pending"

    );

    setLoadingMessage(

        "HYROVISION3D",

        "3D Propeller Engine Pending"

    );

    console.info(

        "HYROVISION3D application controller initialised."

    );

    console.info(

        "Author:",

        HYROVISION_CONFIG.author

    );

    console.info(

        "Initial operating conditions:",

        getState()

    );

    notifySubscribers("application-ready");

}


/* ============================================================
   19. PUBLIC APPLICATION INTERFACE

   The following interface will be used by later
   simulation modules.

   ============================================================ */

window.HYROVISION3D = Object.freeze({

    config: HYROVISION_CONFIG,

    getState: getState,

    subscribe: subscribe,

    start: startSimulation,

    pause: pauseSimulation,

    stop: stopSimulation,

    reset: resetSimulation,

    updateEngineeringResults: updateEngineeringResults,

    setSystemStatus: setSystemStatus,

    activateNavigation: activateNavigation

});


/* ============================================================
   20. START APPLICATION
   ============================================================ */

if (document.readyState === "loading") {

    document.addEventListener(

        "DOMContentLoaded",

        initialiseApplication,

        { once: true }

    );

} else {

    initialiseApplication();

}


/* ============================================================
   END OF FILE

   HYROVISION3D
   Main Application Controller

   Md Ziaul Haque FICS
   Lecturer in Marine Engineering
   ============================================================ */