/*
 HYROVISION3D — STEP 9
 Engineering Diagnostics and Integration Tests

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 File: js/diagnostics.js
 Version: 1.0
*/

"use strict";

(function () {

    let running = false;

    const results = [];

    function addTest(name, passed, detail) {
        results.push({
            name,
            passed: Boolean(passed),
            detail: String(detail || "")
        });
    }

    function approximatelyEqual(a, b, tolerance) {
        return (
            Number.isFinite(a) &&
            Number.isFinite(b) &&
            Math.abs(a - b) <= tolerance
        );
    }

    function checkModule(name, object) {
        const passed = Boolean(
            object &&
            typeof object.isReady === "function" &&
            object.isReady()
        );

        addTest(
            name,
            passed,
            passed ? "Module initialised" : "Module unavailable"
        );
    }

    function testCalculationModel() {
        const model = window.HYROVISION3D_HYDRODYNAMICS;

        if (!model || typeof model.calculate !== "function") {
            addTest(
                "Engineering calculation",
                false,
                "Calculation function missing"
            );
            return;
        }

        const input = {
            rpm: 120,
            pitch: 25,
            advanceSpeed: 5
        };

        const result = model.calculate(input);

        addTest(
            "Default calculation",
            result.valid === true,
            result.message
        );

        addTest(
            "Default thrust",
            approximatelyEqual(
                result.thrust,
                49.77587,
                0.02
            ),
            "Expected approximately 49.78 kN"
        );

        addTest(
            "Default torque",
            approximatelyEqual(
                result.torque,
                50.45774,
                0.02
            ),
            "Expected approximately 50.46 kN·m"
        );

        addTest(
            "Default shaft input",
            approximatelyEqual(
                result.power,
                634.07068,
                0.05
            ),
            "Expected approximately 634.07 kW"
        );

        addTest(
            "Default efficiency",
            approximatelyEqual(
                result.efficiency,
                39.25104,
                0.05
            ),
            "Expected approximately 39.25%"
        );

        const shaftIdentity =
            2 * Math.PI * (input.rpm / 60) *
            result.torque;

        addTest(
            "Shaft input identity",
            approximatelyEqual(
                result.power,
                shaftIdentity,
                0.001
            ),
            "Shaft input = angular velocity × torque"
        );

        const stopped = model.calculate({
            rpm: 0,
            pitch: 25,
            advanceSpeed: 0
        });

        addTest(
            "Stationary propeller",
            stopped.valid &&
            stopped.thrust === 0 &&
            stopped.torque === 0 &&
            stopped.power === 0,
            "Zero input and no advance"
        );

        const unsupported = model.calculate({
            rpm: 0,
            pitch: 25,
            advanceSpeed: 5
        });

        addTest(
            "Unsupported operating condition",
            unsupported.valid === false,
            "Stopped propeller with non-zero advance"
        );
    }

    function testCavitation() {
        const model = window.HYROVISION3D_CAVITATION;

        if (!model || typeof model.calculate !== "function") {
            addTest(
                "Cavitation calculation",
                false,
                "Cavitation function missing"
            );
            return;
        }

        const result = model.calculate({
            rpm: 180,
            pitch: 25,
            advanceSpeed: 5
        });

        addTest(
            "Cavitation numerical validity",
            result.valid &&
            Number.isFinite(result.cavitationNumber) &&
            Number.isFinite(result.pressureMargin),
            "Cavitation number and pressure margin"
        );
    }

    function testInterface() {
        const ids = [
            "rpmSlider",
            "pitchSlider",
            "speedSlider",
            "startButton",
            "pauseButton",
            "resetButton",
            "propellerContainer",
            "thrustValue",
            "torqueValue",
            "powerValue",
            "efficiencyValue",
            "pressureLegend",
            "cavitationStatus"
        ];

        const missing = ids.filter(
            id => !document.getElementById(id)
        );

        addTest(
            "Dashboard elements",
            missing.length === 0,
            missing.length
                ? "Missing: " + missing.join(", ")
                : "All required elements found"
        );
    }

    function testGraphs() {
        const ids = [
            "thrustGraph",
            "torqueGraph",
            "efficiencyGraph",
            "comparisonGraph"
        ];

        const missing = ids.filter(id => {
            const graph = document.getElementById(id);

            return !graph || !graph._fullLayout;
        });

        addTest(
            "Four interactive graphs",
            missing.length === 0,
            missing.length
                ? "Not rendered: " + missing.join(", ")
                : "All four Plotly graphs rendered"
        );
    }

    function displayResults() {
        const body = document.getElementById(
            "diagnosticsResults"
        );

        const summary = document.getElementById(
            "diagnosticsSummary"
        );

        if (!body || !summary) return;

        body.replaceChildren();

        for (const result of results) {
            const row = document.createElement("tr");

            const nameCell = document.createElement("td");
            const statusCell = document.createElement("td");
            const detailCell = document.createElement("td");

            nameCell.textContent = result.name;
            statusCell.textContent =
                result.passed ? "PASS" : "FAIL";
            detailCell.textContent = result.detail;

            statusCell.style.color = result.passed
                ? "#168A73"
                : "#B45309";

            statusCell.style.fontWeight = "700";

            [nameCell, statusCell, detailCell].forEach(
                cell => {
                    cell.style.padding = "10px";
                    cell.style.borderBottom =
                        "1px solid #DCE6EC";
                    row.appendChild(cell);
                }
            );

            body.appendChild(row);
        }

        const passed = results.filter(
            test => test.passed
        ).length;

        summary.textContent =
            passed + " / " + results.length +
            " diagnostic checks passed.";

        summary.style.color =
            passed === results.length
                ? "#168A73"
                : "#B45309";

        console.table(results);
    }

    function runDiagnostics() {
        if (running) return;

        running = true;
        results.length = 0;

        try {
            checkModule(
                "Main controller",
                {
                    isReady: () =>
                        Boolean(window.HYROVISION3D)
                }
            );

            checkModule(
                "3D propeller",
                window.HYROVISION3D_RENDERER
            );

            checkModule(
                "Water flow",
                window.HYROVISION3D_WATERFLOW
            );

            checkModule(
                "Hydrodynamics",
                window.HYROVISION3D_HYDRODYNAMICS
            );

            checkModule(
                "Cavitation",
                window.HYROVISION3D_CAVITATION
            );

            checkModule(
                "Pressure visualisation",
                window.HYROVISION3D_PRESSURE
            );

            checkModule(
                "Performance charts",
                window.HYROVISION3D_PERFORMANCE
            );

            testInterface();
            testCalculationModel();
            testCavitation();
            testGraphs();

            displayResults();

        } catch (error) {
            console.error(
                "HYROVISION3D diagnostic error:",
                error
            );

            addTest(
                "Diagnostic execution",
                false,
                error.message
            );

            displayResults();

        } finally {
            running = false;
        }
    }

    function initialise() {
        const button = document.getElementById(
            "runDiagnosticsButton"
        );

        if (button) {
            button.addEventListener(
                "click",
                runDiagnostics
            );
        }

        console.info(
            "HYROVISION3D: Diagnostics module ready."
        );
    }

    window.HYROVISION3D_DIAGNOSTICS =
        Object.freeze({
            run: runDiagnostics,
            getResults: () =>
                results.map(result => ({ ...result }))
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