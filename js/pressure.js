/*
 HYROVISION3D — STEP 9
 Blade Pressure Visualisation — Final Version

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 Educational colour visualisation.
 NOT a CFD pressure solution.
*/

"use strict";

(function () {

    const SETTINGS = {
        rows: 36,
        columns: 14,
        maxAttempts: 200
    };

    let THREE;
    let renderer;
    let application;
    let blades;
    let overlays;
    let ready = false;
    let attempts = 0;

    const state = {
        rpm: 120,
        pitch: 25,
        enabled: false
    };

    const stops = [
        [-2.0, "#17468B"],
        [-1.2, "#087CB5"],
        [-0.6, "#36B7D1"],
        [-0.2, "#B1DBD3"],
        [ 0.2, "#E5B45B"],
        [ 0.6, "#C65C4D"]
    ];

    function clamp(x, a, b) {
        return Math.max(a, Math.min(b, x));
    }

    function cpValue(r, c) {
        const speed = 0.35 + 0.65 * state.rpm / 120;
        const pitch = Math.pow(state.pitch / 25, 0.65);
        const radial = Math.pow(
            Math.max(0, Math.sin(Math.PI * r)),
            0.75
        );
        const chord = Math.exp(
            -Math.pow((c - 0.28) / 0.33, 2)
        );

        return clamp(
            -0.15 - 1.15 * speed * pitch * radial * chord,
            -2,
            0.6
        );
    }

    function colourFor(value) {
        const cp = clamp(value, -2, 0.6);

        for (let i = 0; i < stops.length - 1; i++) {
            const a = stops[i];
            const b = stops[i + 1];

            if (cp >= a[0] && cp <= b[0]) {
                const fraction =
                    (cp - a[0]) / (b[0] - a[0]);

                return new THREE.Color(a[1]).lerp(
                    new THREE.Color(b[1]),
                    fraction
                );
            }
        }

        return new THREE.Color(stops[0][1]);
    }

    function findBlades() {
        if (!renderer || !renderer.isReady()) {
            return null;
        }

        const rotor = renderer.getRotorGroup();

        return rotor
            ? rotor.getObjectByName("Propeller_Blades")
            : null;
    }

    function clearOverlayMeshes() {
        if (!overlays) return;

        for (const object of [...overlays.children]) {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                object.material.dispose();
            }
            overlays.remove(object);
        }
    }

    function makeGeometry(source) {
        const geometry = source.clone();
        const count = geometry.getAttribute("position").count;
        const colours = new Float32Array(count * 3);
        const stride = SETTINGS.columns + 1;

        for (let i = 0; i < count; i++) {
            const r = Math.floor(i / stride) / SETTINGS.rows;
            const c = (i % stride) / SETTINGS.columns;
            const colour = colourFor(cpValue(r, c));

            colours[i * 3] = colour.r;
            colours[i * 3 + 1] = colour.g;
            colours[i * 3 + 2] = colour.b;
        }

        geometry.setAttribute(
            "color",
            new THREE.BufferAttribute(colours, 3)
        );

        geometry.translate(0, 0, 0.012);

        return geometry;
    }

    function refresh() {
        if (!ready) return;

        const latestBlades = findBlades();
        if (!latestBlades) return;

        blades = latestBlades;

        /*
         Step 4 removes all children of the blade group
         when pitch changes. Reattach the pressure group
         when this occurs.
        */

        if (overlays.parent !== blades) {
            blades.add(overlays);
        }

        clearOverlayMeshes();

        const sourceBlades = blades.children.filter(
            object =>
                object.isMesh &&
                object.name.startsWith("Propeller_Blade_")
        );

        for (const blade of sourceBlades) {
            const mesh = new THREE.Mesh(
                makeGeometry(blade.geometry),
                new THREE.MeshBasicMaterial({
                    vertexColors: true,
                    side: THREE.DoubleSide,
                    transparent: true,
                    opacity: 0.94,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -1,
                    polygonOffsetUnits: -1
                })
            );

            mesh.name = "Pressure_" + blade.name;
            mesh.renderOrder = 5;
            overlays.add(mesh);
        }

        showOrHide();
    }

    function showOrHide() {
        if (overlays) {
            overlays.visible = state.enabled;
        }

        const legend = document.getElementById(
            "pressureLegend"
        );

        if (legend) {
            legend.hidden = !state.enabled;
        }

        const status = document.getElementById(
            "pressureModelStatus"
        );

        if (status) {
            status.textContent = state.enabled
                ? "Illustrative pressure colours active"
                : "Pressure colours switched off";
        }
    }

    function receiveState(next, event) {
        if (!next) return;

        const oldRPM = state.rpm;
        const oldPitch = state.pitch;

        state.rpm = clamp(Number(next.rpm) || 0, 0, 300);
        state.pitch = clamp(Number(next.pitch) || 25, 5, 45);
        state.enabled = Boolean(next.pressureEnabled);

        if (
            event === "pitch-change" ||
            event === "simulation-reset" ||
            oldRPM !== state.rpm ||
            oldPitch !== state.pitch
        ) {
            refresh();
        }

        showOrHide();
    }

    function initialise() {
        if (ready) return;

        renderer = window.HYROVISION3D_RENDERER;
        application = window.HYROVISION3D;

        if (
            !renderer ||
            !application ||
            !renderer.isReady()
        ) {
            attempts++;

            if (attempts < SETTINGS.maxAttempts) {
                setTimeout(initialise, 100);
            } else {
                console.error(
                    "HYROVISION3D: Pressure module unavailable."
                );
            }
            return;
        }

        THREE = renderer.getTHREE();
        blades = findBlades();

        if (!THREE || !blades) {
            console.error(
                "HYROVISION3D: Pressure blade geometry missing."
            );
            return;
        }

        overlays = new THREE.Group();
        overlays.name = "Pressure_Overlay";

        ready = true;

        application.subscribe(receiveState);

        const initial = application.getState();
        state.rpm = initial.rpm;
        state.pitch = initial.pitch;
        state.enabled = initial.pressureEnabled;

        refresh();

        console.info(
            "HYROVISION3D: Pressure visualisation ready."
        );
    }

    window.HYROVISION3D_PRESSURE = Object.freeze({
        initialise,
        refresh,
        isReady: () => ready,
        getState: () => ({
            ...state,
            ready,
            overlayCount: overlays ? overlays.children.length : 0
        })
    });

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialise,
            { once: true }
        );
    } else {
        initialise();
    }

})();