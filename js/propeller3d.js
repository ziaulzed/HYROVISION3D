/*
============================================================
 HYROVISION3D
 INVISIBLE FORCES BEHIND THE SHIP'S PROPELLER

 STEP 4: INTERACTIVE 3D MARINE PROPELLER

 File:
 js/propeller3d.js

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 Technology:
 Three.js / JavaScript / WebGL

 Theme:
 Ocean Blue, Marine Navy, Brushed Steel

 Description:
 Procedural marine propeller geometry with
 five curved blades, adjustable geometric pitch,
 RPM-controlled rotation and interactive camera.

 The model is intended for engineering education.
 It is not a validated CFD or manufacturing model.

 Version: 1.0
============================================================
*/

"use strict";

(function () {

    // ======================================================
    // 01. APPLICATION SETTINGS
    // ======================================================

    const SETTINGS = Object.freeze({

        threeVersion: "0.180.0",

        bladeCount: 5,

        propellerRadius: 1.65,

        hubRadius: 0.37,

        hubLength: 0.88,

        shaftRadius: 0.15,

        defaultRPM: 120,

        defaultPitch: 25,

        minimumZoom: 3.1,

        maximumZoom: 11,

        cameraDistance: 5.8,

        bladeRadialSegments: 36,

        bladeChordSegments: 14,

        backgroundColour: 0x003B5C,

        oceanColour: 0x006994,

        steelColour: 0xA6B8C2,

        darkSteelColour: 0x536977,

        accentColour: 0x16A6B6

    });


    // ======================================================
    // 02. THREE.JS OBJECT REFERENCES
    // ======================================================

    let THREE = null;

    let scene = null;

    let camera = null;

    let renderer = null;

    let propellerAssembly = null;

    let rotorGroup = null;

    let hubGroup = null;

    let bladeGroup = null;

    let environmentGroup = null;

    let container = null;

    let resizeObserver = null;

    let animationFrameId = null;

    let lastFrameTime = null;

    let currentPitch = SETTINGS.defaultPitch;

    let initialised = false;

    let loading = false;

    let disposed = false;


    // ======================================================
    // 03. CAMERA CONTROL STATE
    // ======================================================

    const cameraControl = {

        distance: SETTINGS.cameraDistance,

        azimuth: 0.45,

        elevation: 0.32,

        dragging: false,

        pointerId: null,

        previousX: 0,

        previousY: 0

    };


    // ======================================================
    // 04. SIMULATION STATE
    // ======================================================

    let simulation = {

        rpm: SETTINGS.defaultRPM,

        pitch: SETTINGS.defaultPitch,

        advanceSpeed: 5,

        running: false,

        waterFlowEnabled: true,

        vortexEnabled: true,

        pressureEnabled: false,

        cavitationEnabled: false

    };


    // ======================================================
    // 05. DOM REFERENCES
    // ======================================================

    function findContainer() {

        container = document.getElementById(
            "propellerContainer"
        );

        return Boolean(container);

    }


    function updateLoadingMessage(
        headingText,
        descriptionText,
        detailText
    ) {

        const message = document.getElementById(
            "loadingMessage"
        );

        if (!message) {

            return;

        }

        const heading = message.querySelector("h3");

        const paragraph = message.querySelector("p");

        const detail = message.querySelector("small");

        if (heading) {

            heading.textContent = headingText;

        }

        if (paragraph) {

            paragraph.textContent = descriptionText;

        }

        if (detail) {

            detail.textContent = detailText;

        }

        message.style.display = "flex";

    }


    function hideLoadingMessage() {

        const message = document.getElementById(
            "loadingMessage"
        );

        if (message) {

            message.style.display = "none";

        }

    }


    // ======================================================
    // 06. LOAD THREE.JS
    // ======================================================

    async function loadThreeJS() {

        const url =
            "https://cdn.jsdelivr.net/npm/" +
            "three@" +
            SETTINGS.threeVersion +
            "/build/three.module.js";

        try {

            THREE = await import(url);

            console.info(
                "HYROVISION3D: Three.js loaded."
            );

            return true;

        } catch (error) {

            console.error(
                "HYROVISION3D: Three.js loading failed.",
                error
            );

            updateLoadingMessage(

                "3D ENGINE UNAVAILABLE",

                "Three.js could not be loaded.",

                "Check your internet connection and " +
                "open the project through a local web server."

            );

            const status = document.getElementById(
                "systemStatus"
            );

            if (status) {

                status.textContent = "3D Engine Unavailable";

            }

            return false;

        }

    }


    // ======================================================
    // 07. INITIALISE SCENE
    // ======================================================

    function createScene() {

        scene = new THREE.Scene();

        scene.background = new THREE.Color(
            SETTINGS.backgroundColour
        );

        scene.fog = new THREE.FogExp2(
            SETTINGS.backgroundColour,
            0.025
        );

    }


    // ======================================================
    // 08. INITIALISE CAMERA
    // ======================================================

    function createCamera() {

        const width = Math.max(
            1,
            container.clientWidth
        );

        const height = Math.max(
            1,
            container.clientHeight
        );

        const aspect = width / height;

        camera = new THREE.PerspectiveCamera(

            42,

            aspect,

            0.1,

            100

        );

        updateCameraPosition();

    }


    function updateCameraPosition() {

        if (!camera) {

            return;

        }

        const distance = cameraControl.distance;

        const azimuth = cameraControl.azimuth;

        const elevation = cameraControl.elevation;

        const horizontalDistance =
            distance * Math.cos(elevation);

        const x =
            horizontalDistance * Math.sin(azimuth);

        const y =
            distance * Math.sin(elevation);

        const z =
            horizontalDistance * Math.cos(azimuth);

        camera.position.set(x, y, z);

        camera.lookAt(0, 0, 0);

    }


    // ======================================================
    // 09. CREATE WEBGL RENDERER
    // ======================================================

    function createRenderer() {

        renderer = new THREE.WebGLRenderer({

            antialias: true,

            alpha: false,

            powerPreference: "high-performance"

        });

        renderer.setPixelRatio(

            Math.min(
                window.devicePixelRatio || 1,
                2
            )

        );

        renderer.setSize(

            Math.max(1, container.clientWidth),

            Math.max(1, container.clientHeight),

            false

        );

        renderer.shadowMap.enabled = true;

        renderer.shadowMap.type =
            THREE.PCFSoftShadowMap;

        renderer.outputColorSpace =
            THREE.SRGBColorSpace;

        renderer.toneMapping =
            THREE.ACESFilmicToneMapping;

        renderer.toneMappingExposure = 1.35;

        renderer.domElement.style.display = "block";

        renderer.domElement.style.width = "100%";

        renderer.domElement.style.height = "100%";

        renderer.domElement.style.touchAction = "none";

        renderer.domElement.style.cursor = "grab";

        renderer.domElement.setAttribute(

            "aria-label",

            "Rotatable three-dimensional marine propeller"

        );

        renderer.domElement.setAttribute(

            "role",

            "img"

        );

        renderer.domElement.tabIndex = 0;

        container.appendChild(
            renderer.domElement
        );

    }


    // ======================================================
    // 10. LIGHTING
    // ======================================================

    function createLighting() {

        const ambientLight =
            new THREE.AmbientLight(

                0xCDEAF5,

                1.1

            );

        scene.add(ambientLight);


        const mainLight =
            new THREE.DirectionalLight(

                0xFFFFFF,

                3.0

            );

        mainLight.position.set(
            3,
            5,
            7
        );

        mainLight.castShadow = true;

        scene.add(mainLight);


        const fillLight =
            new THREE.DirectionalLight(

                0x7CC8E5,

                2.0

            );

        fillLight.position.set(
            -5,
            -2,
            3
        );

        scene.add(fillLight);


        const rearLight =
            new THREE.DirectionalLight(

                0xB6E5F2,

                1.8

            );

        rearLight.position.set(
            2,
            3,
            -6
        );

        scene.add(rearLight);

    }


    // ======================================================
    // 11. ENGINEERING MATERIALS
    // ======================================================

    function createSteelMaterial() {

        return new THREE.MeshStandardMaterial({

            color: SETTINGS.steelColour,

            metalness: 0.82,

            roughness: 0.31,

            side: THREE.DoubleSide

        });

    }


    function createDarkSteelMaterial() {

        return new THREE.MeshStandardMaterial({

            color: SETTINGS.darkSteelColour,

            metalness: 0.75,

            roughness: 0.38

        });

    }


    function createHubMaterial() {

        return new THREE.MeshStandardMaterial({

            color: 0x92A8B5,

            metalness: 0.85,

            roughness: 0.28

        });

    }


    // ======================================================
    // 12. CREATE PROPELLER GROUPS
    // ======================================================

    function createPropellerGroups() {

        propellerAssembly = new THREE.Group();

        propellerAssembly.name =
            "HYROVISION3D_Propeller_Assembly";

        rotorGroup = new THREE.Group();

        rotorGroup.name =
            "Rotating_Propeller";

        hubGroup = new THREE.Group();

        hubGroup.name =
            "Propeller_Hub";

        bladeGroup = new THREE.Group();

        bladeGroup.name =
            "Propeller_Blades";

        rotorGroup.add(hubGroup);

        rotorGroup.add(bladeGroup);

        propellerAssembly.add(rotorGroup);

        scene.add(propellerAssembly);

    }


    // ======================================================
    // 13. CREATE CENTRAL HUB
    // ======================================================

    function createPropellerHub() {

        const hubGeometry =
            new THREE.CylinderGeometry(

                SETTINGS.hubRadius * 0.78,

                SETTINGS.hubRadius,

                SETTINGS.hubLength,

                48,

                1

            );

        const hubMaterial =
            createHubMaterial();

        const hub = new THREE.Mesh(

            hubGeometry,

            hubMaterial

        );

        hub.rotation.x = Math.PI / 2;

        hub.castShadow = true;

        hub.receiveShadow = true;

        hub.name = "Main_Propeller_Hub";

        hubGroup.add(hub);


        // Forward hub cap

        const capGeometry =
            new THREE.SphereGeometry(

                SETTINGS.hubRadius * 0.78,

                32,

                20

            );

        const cap = new THREE.Mesh(

            capGeometry,

            createHubMaterial()

        );

        cap.scale.set(
            1,
            1,
            0.72
        );

        cap.position.z =
            SETTINGS.hubLength * 0.48;

        cap.castShadow = true;

        hubGroup.add(cap);


        // Rear hub collar

        const collarGeometry =
            new THREE.CylinderGeometry(

                SETTINGS.hubRadius * 0.92,

                SETTINGS.hubRadius * 0.92,

                0.17,

                48

            );

        const collar = new THREE.Mesh(

            collarGeometry,

            createDarkSteelMaterial()

        );

        collar.rotation.x = Math.PI / 2;

        collar.position.z = -0.32;

        hubGroup.add(collar);

    }


    // ======================================================
    // 14. CREATE CENTRAL SHAFT
    //
    // The shaft is aligned with the Z axis.
    // It rotates together with the propeller.
    // ======================================================

    function createShaft() {

        const shaftGeometry =
            new THREE.CylinderGeometry(

                SETTINGS.shaftRadius,

                SETTINGS.shaftRadius,

                1.9,

                40

            );

        const shaft = new THREE.Mesh(

            shaftGeometry,

            createDarkSteelMaterial()

        );

        shaft.rotation.x = Math.PI / 2;

        shaft.position.z = -0.85;

        shaft.castShadow = true;

        shaft.name = "Propeller_Shaft";

        rotorGroup.add(shaft);


        // Shaft coupling

        const couplingGeometry =
            new THREE.CylinderGeometry(

                0.23,

                0.23,

                0.25,

                40

            );

        const coupling = new THREE.Mesh(

            couplingGeometry,

            createHubMaterial()

        );

        coupling.rotation.x = Math.PI / 2;

        coupling.position.z = -1.55;

        rotorGroup.add(coupling);

    }


    // ======================================================
    // 15. BLADE GEOMETRY PARAMETERS
    //
    // Parametric educational blade:
    //
    // r     = radial position
    // s     = chord parameter
    // theta = angular position
    // z     = axial displacement
    //
    // Blade pitch affects axial displacement
    // across the local chord.
    //
    // This geometry is illustrative, not validated.
    // ======================================================

    function bladeChordLength(radiusFraction) {

        const r = Math.max(

            0,

            Math.min(1, radiusFraction)

        );

        const rootWidth = 0.36;

        const broadSection =
            0.72 * Math.pow(

                Math.sin(Math.PI * r),

                0.72

            );

        const tipTaper =
            0.12 * (1 - r);

        return rootWidth +
            broadSection +
            tipTaper;

    }


    function bladeSweep(radiusFraction) {

        const r = radiusFraction;

        return (
            0.06 +
            0.38 * r +
            0.20 * r * r
        );

    }


    function bladeRake(radiusFraction) {

        return (
            0.05 +
            0.15 *
            radiusFraction *
            radiusFraction
        );

    }


    // ======================================================
    // 16. CALCULATE BLADE SURFACE POINT
    // ======================================================

    function calculateBladePoint(

        radiusFraction,

        chordFraction,

        bladeAngle,

        pitchDegrees

    ) {

        const rFraction = Math.max(

            0,

            Math.min(1, radiusFraction)

        );

        const rootRadius =
            SETTINGS.hubRadius * 0.84;

        const outerRadius =
            SETTINGS.propellerRadius;

        const radius =

            rootRadius +

            (
                outerRadius - rootRadius
            ) * rFraction;


        const chord =
            bladeChordLength(rFraction);

        const chordPosition =
            chordFraction * chord;


        // Planform angular displacement

        const angularChord =
            chordPosition / Math.max(radius, 0.1);


        const theta =

            bladeAngle +

            bladeSweep(rFraction) +

            angularChord * 0.78;


        // Local geometric pitch illustration

        const pitchRadians =
            THREE.MathUtils.degToRad(
                pitchDegrees
            );


        // A modest radial twist keeps the blade shape
        // visually representative of marine propellers.

        const localTwist =

            1.18 -

            0.35 * rFraction;


        const axialPitch =

            chordPosition *

            Math.tan(pitchRadians) *

            localTwist;


        // Slight camber

        const camber =

            0.055 *

            chord *

            (
                1 -
                Math.pow(
                    2 * chordFraction,
                    2
                )
            );


        const x =
            radius * Math.cos(theta);

        const y =
            radius * Math.sin(theta);

        const z =

            bladeRake(rFraction) +

            axialPitch +

            camber;


        return new THREE.Vector3(
            x,
            y,
            z
        );

    }


    // ======================================================
    // 17. GENERATE BLADE MESH
    // ======================================================

    function createBladeGeometry(

        bladeAngle,

        pitchDegrees

    ) {

        const radialSegments =
            SETTINGS.bladeRadialSegments;

        const chordSegments =
            SETTINGS.bladeChordSegments;


        const positions = [];

        const indices = [];


        // Generate blade surface vertices

        for (

            let radialIndex = 0;

            radialIndex <= radialSegments;

            radialIndex++

        ) {

            const radialFraction =
                radialIndex / radialSegments;


            for (

                let chordIndex = 0;

                chordIndex <= chordSegments;

                chordIndex++

            ) {

                const chordFraction =

                    chordIndex /
                    chordSegments - 0.5;


                const point =
                    calculateBladePoint(

                        radialFraction,

                        chordFraction,

                        bladeAngle,

                        pitchDegrees

                    );


                positions.push(

                    point.x,

                    point.y,

                    point.z

                );

            }

        }


        // Create triangular mesh faces

        for (

            let radialIndex = 0;

            radialIndex < radialSegments;

            radialIndex++

        ) {

            for (

                let chordIndex = 0;

                chordIndex < chordSegments;

                chordIndex++

            ) {

                const rowWidth =
                    chordSegments + 1;


                const a =

                    radialIndex *
                    rowWidth +
                    chordIndex;


                const b =
                    a + rowWidth;


                const c =
                    a + 1;


                const d =
                    b + 1;


                indices.push(

                    a,
                    b,
                    c

                );


                indices.push(

                    c,
                    b,
                    d

                );

            }

        }


        const geometry =
            new THREE.BufferGeometry();


        geometry.setAttribute(

            "position",

            new THREE.Float32BufferAttribute(

                positions,

                3

            )

        );


        geometry.setIndex(indices);

        geometry.computeVertexNormals();

        geometry.computeBoundingSphere();

        return geometry;

    }


    // ======================================================
    // 18. CREATE FIVE PROPELLER BLADES
    // ======================================================

    function createPropellerBlades(

        pitchDegrees

    ) {

        clearBladeGroup();


        const bladeMaterial =
            createSteelMaterial();


        for (

            let bladeIndex = 0;

            bladeIndex < SETTINGS.bladeCount;

            bladeIndex++

        ) {

            const bladeAngle =

                (
                    bladeIndex /
                    SETTINGS.bladeCount
                ) * Math.PI * 2;


            const bladeGeometry =
                createBladeGeometry(

                    bladeAngle,

                    pitchDegrees

                );


            const blade = new THREE.Mesh(

                bladeGeometry,

                bladeMaterial

            );


            blade.name =

                "Propeller_Blade_" +
                (bladeIndex + 1);


            blade.castShadow = true;

            blade.receiveShadow = true;

            blade.userData.bladeNumber =
                bladeIndex + 1;

            bladeGroup.add(blade);


            createBladeEdge(

                bladeAngle,

                pitchDegrees

            );

        }


        currentPitch = pitchDegrees;

    }


    // ======================================================
    // 19. ADD SUBTLE BLADE EDGE DETAIL
    // ======================================================

    function createBladeEdge(

        bladeAngle,

        pitchDegrees

    ) {

        const edgePoints = [];

        const segments = 32;


        for (

            let i = 0;

            i <= segments;

            i++

        ) {

            const r = i / segments;

            edgePoints.push(

                calculateBladePoint(

                    r,

                    0.5,

                    bladeAngle,

                    pitchDegrees

                )

            );

        }


        const curve =
            new THREE.CatmullRomCurve3(
                edgePoints
            );


        const edgeGeometry =
            new THREE.TubeGeometry(

                curve,

                50,

                0.008,

                5,

                false

            );


        const edgeMaterial =
            new THREE.MeshStandardMaterial({

                color: 0xD6E4EB,

                metalness: 0.75,

                roughness: 0.28

            });


        const edge = new THREE.Mesh(

            edgeGeometry,

            edgeMaterial

        );


        bladeGroup.add(edge);

    }


    // ======================================================
    // 20. CLEAR PREVIOUS BLADE GEOMETRY
    // ======================================================

    function clearBladeGroup() {

        if (!bladeGroup) {

            return;

        }

        bladeGroup.traverse(function (object) {

            if (object.geometry) {

                object.geometry.dispose();

            }

            if (object.material) {

                const materials =
                    Array.isArray(object.material)
                        ? object.material
                        : [object.material];

                materials.forEach(function (material) {

                    material.dispose();

                });

            }

        });

        bladeGroup.clear();

    }


    // ======================================================
    // 21. ADD ENGINEERING REFERENCE RINGS
    //
    // These are reference guides, not CFD flow lines.
    // ======================================================

    function createReferenceEnvironment() {

        environmentGroup = new THREE.Group();

        environmentGroup.name =
            "Engineering_Reference_Guides";

        scene.add(environmentGroup);


        const ringMaterial =
            new THREE.LineBasicMaterial({

                color: 0x69BACF,

                transparent: true,

                opacity: 0.26

            });


        const ringRadii = [
            1.85,
            2.15
        ];


        ringRadii.forEach(function (radius) {

            const points = [];

            const segments = 120;


            for (let i = 0; i <= segments; i++) {

                const angle =
                    (i / segments) * Math.PI * 2;

                points.push(

                    new THREE.Vector3(

                        radius * Math.cos(angle),

                        radius * Math.sin(angle),

                        -0.12

                    )

                );

            }


            const geometry =
                new THREE.BufferGeometry()
                    .setFromPoints(points);


            const ring =
                new THREE.LineLoop(

                    geometry,

                    ringMaterial

                );


            environmentGroup.add(ring);

        });


        // Stationary centreline reference

        const axisPoints = [

            new THREE.Vector3(0, 0, -2.25),

            new THREE.Vector3(0, 0, 2.1)

        ];


        const axisGeometry =
            new THREE.BufferGeometry()
                .setFromPoints(axisPoints);


        const axisMaterial =
            new THREE.LineDashedMaterial({

                color: 0x8ACADB,

                dashSize: 0.12,

                gapSize: 0.09,

                transparent: true,

                opacity: 0.30

            });


        const axis =
            new THREE.Line(

                axisGeometry,

                axisMaterial

            );


        axis.computeLineDistances();

        environmentGroup.add(axis);

    }


    // ======================================================
    // 22. CREATE 3D PROPELLER
    // ======================================================

    function createPropeller() {

        createPropellerGroups();

        createPropellerHub();

        createShaft();

        createPropellerBlades(
            simulation.pitch
        );

        createReferenceEnvironment();

        console.info(

            "HYROVISION3D: Five-blade propeller created."

        );

    }


    // ======================================================
    // 23. UPDATE BLADE PITCH
    // ======================================================

    function updateBladePitch(

        pitchDegrees

    ) {

        if (!initialised) {

            return;

        }

        const pitch =
            Number(pitchDegrees);


        if (!Number.isFinite(pitch)) {

            return;

        }


        const safePitch =
            THREE.MathUtils.clamp(

                pitch,

                5,

                45

            );


        if (

            Math.abs(
                safePitch - currentPitch
            ) < 0.001

        ) {

            return;

        }


        createPropellerBlades(safePitch);

        renderScene();

    }


    // ======================================================
    // 24. UPDATE RPM
    // ======================================================

    function updateRPM(rpm) {

        const number = Number(rpm);

        if (!Number.isFinite(number)) {

            return;

        }

        simulation.rpm = Math.max(

            0,

            Math.min(300, number)

        );

    }


    // ======================================================
    // 25. CAMERA MOUSE CONTROLS
    // ======================================================

    function handlePointerDown(event) {

        if (!renderer) {

            return;

        }

        if (

            event.pointerType === "mouse" &&

            event.button !== 0

        ) {

            return;

        }

        cameraControl.dragging = true;

        cameraControl.pointerId =
            event.pointerId;

        cameraControl.previousX =
            event.clientX;

        cameraControl.previousY =
            event.clientY;

        renderer.domElement.style.cursor =
            "grabbing";

        renderer.domElement.setPointerCapture(
            event.pointerId
        );

    }


    function handlePointerMove(event) {

        if (!cameraControl.dragging) {

            return;

        }

        if (

            event.pointerId !==
            cameraControl.pointerId

        ) {

            return;

        }

        const deltaX =

            event.clientX -
            cameraControl.previousX;


        const deltaY =

            event.clientY -
            cameraControl.previousY;


        cameraControl.previousX =
            event.clientX;

        cameraControl.previousY =
            event.clientY;


        cameraControl.azimuth -=
            deltaX * 0.006;


        cameraControl.elevation +=
            deltaY * 0.006;


        cameraControl.elevation =
            THREE.MathUtils.clamp(

                cameraControl.elevation,

                -1.35,

                1.35

            );


        updateCameraPosition();

        renderScene();

    }


    function handlePointerUp(event) {

        if (

            event.pointerId !==
            cameraControl.pointerId

        ) {

            return;

        }

        cameraControl.dragging = false;

        cameraControl.pointerId = null;

        if (renderer) {

            renderer.domElement.style.cursor =
                "grab";

        }

    }


    // ======================================================
    // 26. CAMERA ZOOM
    // ======================================================

    function handleWheel(event) {

        event.preventDefault();

        const zoomFactor =

            event.deltaY > 0
                ? 1.10
                : 0.90;


        cameraControl.distance =
            THREE.MathUtils.clamp(

                cameraControl.distance *
                zoomFactor,

                SETTINGS.minimumZoom,

                SETTINGS.maximumZoom

            );


        updateCameraPosition();

        renderScene();

    }


    // ======================================================
    // 27. KEYBOARD CAMERA CONTROLS
    //
    // Arrow keys: Orbit
    // + / -: Zoom
    // ======================================================

    function handleCameraKeyboard(event) {

        let handled = true;

        switch (event.key) {

            case "ArrowLeft":

                cameraControl.azimuth += 0.12;

                break;


            case "ArrowRight":

                cameraControl.azimuth -= 0.12;

                break;


            case "ArrowUp":

                cameraControl.elevation += 0.10;

                break;


            case "ArrowDown":

                cameraControl.elevation -= 0.10;

                break;


            case "+":

            case "=":

                cameraControl.distance *= 0.9;

                break;


            case "-":

            case "_":

                cameraControl.distance *= 1.1;

                break;


            default:

                handled = false;

        }


        if (!handled) {

            return;

        }

        event.preventDefault();


        cameraControl.elevation =
            THREE.MathUtils.clamp(

                cameraControl.elevation,

                -1.35,

                1.35

            );


        cameraControl.distance =
            THREE.MathUtils.clamp(

                cameraControl.distance,

                SETTINGS.minimumZoom,

                SETTINGS.maximumZoom

            );


        updateCameraPosition();

        renderScene();

    }


    // ======================================================
    // 28. REGISTER CAMERA CONTROLS
    // ======================================================

    function registerCameraControls() {

        const canvas = renderer.domElement;


        canvas.addEventListener(

            "pointerdown",

            handlePointerDown

        );


        canvas.addEventListener(

            "pointermove",

            handlePointerMove

        );


        canvas.addEventListener(

            "pointerup",

            handlePointerUp

        );


        canvas.addEventListener(

            "pointercancel",

            handlePointerUp

        );


        canvas.addEventListener(

            "lostpointercapture",

            function () {

                cameraControl.dragging = false;

                cameraControl.pointerId = null;

                canvas.style.cursor = "grab";

            }

        );


        canvas.addEventListener(

            "wheel",

            handleWheel,

            { passive: false }

        );


        canvas.addEventListener(

            "keydown",

            handleCameraKeyboard

        );

    }


    // ======================================================
    // 29. RESPONSIVE RESIZING
    // ======================================================

    function resizeRenderer() {

        if (

            !renderer ||

            !camera ||

            !container

        ) {

            return;

        }


        const width =
            Math.max(
                1,
                container.clientWidth
            );


        const height =
            Math.max(
                1,
                container.clientHeight
            );


        camera.aspect = width / height;

        camera.updateProjectionMatrix();


        renderer.setSize(

            width,

            height,

            false

        );


        renderScene();

    }


    function registerResizeHandling() {

        if (typeof ResizeObserver !== "undefined") {

            resizeObserver =
                new ResizeObserver(
                    resizeRenderer
                );

            resizeObserver.observe(container);

        } else {

            window.addEventListener(

                "resize",

                resizeRenderer

            );

        }

    }


    // ======================================================
    // 30. RENDER SCENE
    // ======================================================

    function renderScene() {

        if (

            !renderer ||

            !scene ||

            !camera

        ) {

            return;

        }

        renderer.render(

            scene,

            camera

        );

    }


    // ======================================================
    // 31. ANIMATION FRAME
    //
    // RPM to angular velocity:
    //
    // omega = 2 * PI * RPM / 60
    //
    // angular displacement = omega * deltaTime
    //
    // Browser animation is visual and does not
    // represent a CFD time-step solution.
    // ======================================================

    function animate(timestamp) {

        if (disposed) {

            animationFrameId = null;

            return;

        }

        animationFrameId =
            requestAnimationFrame(animate);


        if (lastFrameTime === null) {

            lastFrameTime = timestamp;

        }


        const deltaTime = Math.max(

            0,

            Math.min(

                (timestamp - lastFrameTime) / 1000,

                0.05

            )

        );


        lastFrameTime = timestamp;


        if (

            simulation.running &&

            rotorGroup

        ) {

            const angularVelocity =

                2 *

                Math.PI *

                simulation.rpm /

                60;


            rotorGroup.rotation.z +=

                angularVelocity *
                deltaTime;


            // Keep angle numerically bounded.

            rotorGroup.rotation.z %=

                2 * Math.PI;

        }


        renderScene();

    }


    // ======================================================
    // 32. SYNCHRONISE APPLICATION STATE
    // ======================================================

    function synchroniseState(state, eventType) {

        if (!state) {

            return;

        }


        simulation.rpm = state.rpm;

        simulation.pitch = state.pitch;

        simulation.advanceSpeed =
            state.advanceSpeed;

        simulation.running =
            Boolean(state.running);

        simulation.waterFlowEnabled =
            Boolean(state.waterFlowEnabled);

        simulation.vortexEnabled =
            Boolean(state.vortexEnabled);

        simulation.pressureEnabled =
            Boolean(state.pressureEnabled);

        simulation.cavitationEnabled =
            Boolean(state.cavitationEnabled);


        updateRPM(simulation.rpm);

        updateBladePitch(
            simulation.pitch
        );


        if (eventType === "simulation-reset") {

            if (rotorGroup) {

                rotorGroup.rotation.z = 0;

            }

            cameraControl.distance =
                SETTINGS.cameraDistance;

            cameraControl.azimuth = 0.45;

            cameraControl.elevation = 0.32;

            updateCameraPosition();

        }


        updateSystemStatus();

        renderScene();

    }


    // ======================================================
    // 33. SYSTEM STATUS
    // ======================================================

    function updateSystemStatus() {

        if (!initialised) {

            return;

        }

        const status =
            document.getElementById(
                "systemStatus"
            );


        if (!status) {

            return;

        }


        if (simulation.running) {

            status.textContent =
                "3D Propeller Running";

        } else {

            const application =
                window.HYROVISION3D;


            const state = application
                ? application.getState()
                : null;


            if (state && state.paused) {

                status.textContent =
                    "3D Propeller Paused";

            } else {

                status.textContent =
                    "3D Propeller Ready";

            }

        }

    }


    // ======================================================
    // 34. APPLICATION CONNECTION
    // ======================================================

    function connectApplication() {

        const application =
            window.HYROVISION3D;


        if (!application) {

            console.warn(

                "HYROVISION3D controller not found."

            );

            return;

        }


        // Obtain operating conditions.

        synchroniseState(

            application.getState(),

            "initial-sync"

        );


        // Connect future state changes.

        application.subscribe(

            synchroniseState

        );


        console.info(

            "HYROVISION3D: 3D renderer connected."

        );

    }


    // ======================================================
    // 35. CREATE CAMERA HELP LABEL
    // ======================================================

    function createCameraHelp() {

        if (

            container.querySelector(
                ".hyro-camera-help"
            )

        ) {

            return;

        }


        const label =
            document.createElement("div");


        label.className =
            "hyro-camera-help";


        label.textContent =

            "DRAG TO ROTATE  |  SCROLL TO ZOOM";


        label.style.position = "absolute";

        label.style.left = "14px";

        label.style.bottom = "14px";

        label.style.padding = "7px 11px";

        label.style.borderRadius = "4px";

        label.style.background =
            "rgba(0, 42, 67, 0.78)";

        label.style.border =
            "1px solid rgba(180, 220, 235, 0.25)";

        label.style.color = "#E8F3F8";

        label.style.fontSize = "10px";

        label.style.fontFamily =
            "Segoe UI, Arial, sans-serif";

        label.style.letterSpacing = "0.4px";

        label.style.pointerEvents = "none";

        label.style.zIndex = "2";


        container.appendChild(label);

    }


    // ======================================================
    // 36. CREATE PROPELLER INFORMATION LABEL
    // ======================================================

    function createInformationLabel() {

        if (

            container.querySelector(
                ".hyro-model-label"
            )

        ) {

            return;

        }


        const label =
            document.createElement("div");


        label.className =
            "hyro-model-label";


        label.textContent =
            "FIVE-BLADE MARINE PROPELLER";


        label.style.position = "absolute";

        label.style.top = "14px";

        label.style.left = "14px";

        label.style.padding = "7px 11px";

        label.style.background =
            "rgba(0, 42, 67, 0.78)";

        label.style.border =
            "1px solid rgba(180, 220, 235, 0.25)";

        label.style.borderRadius = "4px";

        label.style.color = "#FFFFFF";

        label.style.fontSize = "11px";

        label.style.fontWeight = "600";

        label.style.letterSpacing = "0.6px";

        label.style.fontFamily =
            "Segoe UI, Arial, sans-serif";

        label.style.pointerEvents = "none";

        label.style.zIndex = "2";


        container.appendChild(label);

    }


    // ======================================================
    // 37. HANDLE BROWSER VISIBILITY
    // ======================================================

    function handleVisibilityChange() {

        // Prevent an unrealistic angular jump
        // after returning to an inactive tab.

        lastFrameTime = null;

    }


    // ======================================================
    // 38. INITIALISE 3D PROPELLER
    // ======================================================

    async function initialisePropeller3D() {

        if (

            loading ||

            initialised ||

            disposed

        ) {

            return;

        }


        if (!findContainer()) {

            console.error(

                "HYROVISION3D: 3D container missing."

            );

            return;

        }


        loading = true;


        updateLoadingMessage(

            "HYROVISION3D",

            "Initialising Marine Propeller",

            "Loading the Three.js rendering engine."

        );


        const loaded =
            await loadThreeJS();


        if (!loaded) {

            loading = false;

            return;

        }


        try {

            createScene();

            createCamera();

            createRenderer();

            createLighting();

            createPropeller();

            registerCameraControls();

            registerResizeHandling();

            createCameraHelp();

            createInformationLabel();


            document.addEventListener(

                "visibilitychange",

                handleVisibilityChange

            );


            initialised = true;

            loading = false;


            connectApplication();

            resizeRenderer();

            hideLoadingMessage();

            updateSystemStatus();


            lastFrameTime = null;

            animationFrameId =
                requestAnimationFrame(animate);


            console.info(

                "HYROVISION3D: 3D model ready."

            );


        } catch (error) {

            console.error(

                "HYROVISION3D: Renderer error.",

                error

            );


            updateLoadingMessage(

                "3D RENDERING ERROR",

                "The propeller could not be displayed.",

                "Check WebGL support and the browser console."

            );


            loading = false;

        }

    }


    // ======================================================
    // 39. PUBLIC 3D INTERFACE
    // ======================================================

    window.HYROVISION3D_RENDERER = Object.freeze({

        initialise: initialisePropeller3D,

        updateRPM: updateRPM,

        updateBladePitch: updateBladePitch,

        render: renderScene,

        getRenderer: function () {

            return renderer;

        },

        getScene: function () {

            return scene;

        },

        getCamera: function () {

            return camera;

        },

        getRotorGroup: function () {

            return rotorGroup;

        },

        getPropellerAssembly: function () {

            return propellerAssembly;

        },

        getTHREE: function () {

            return THREE;

        },

        isReady: function () {

            return initialised;

        }

    });


    // ======================================================
    // 40. APPLICATION START
    // ======================================================

    if (document.readyState === "loading") {

        document.addEventListener(

            "DOMContentLoaded",

            initialisePropeller3D,

            { once: true }

        );

    } else {

        initialisePropeller3D();

    }


    // ======================================================
    // END OF PROPELLER 3D MODULE
    //
    // HYROVISION3D
    // Md Ziaul Haque FICS
    // Lecturer in Marine Engineering
    // ======================================================

})();