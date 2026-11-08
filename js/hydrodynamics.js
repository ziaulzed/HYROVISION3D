/*
==============================================================
 HYROVISION3D
 INVISIBLE FORCES BEHIND THE SHIP'S PROPELLER

 STEP 6: PROPELLER HYDRODYNAMIC PERFORMANCE

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 File: js/hydrodynamics.js
 Version: 1.0

 Units: SI

 Model:
 Illustrative open-water propeller characteristics.

 Engineering equations:
 T  = KT * rho * n² * D⁴
 Q  = KQ * rho * n² * D⁵
 PD = 2 * PI * n * Q
 J  = VA / (n * D)
 eta0 = J * KT / (2 * PI * KQ)

 Important:
 KT and KQ are illustrative coefficients.
 They are not validated propeller-series data.

 No CFD solution is performed by this module.
==============================================================
*/

"use strict";

(function () {

    // ========================================================
    // 01. ENGINEERING CONFIGURATION
    // ========================================================

    const CONFIG = Object.freeze({

        name: "HYROVISION3D",

        version: "1.0",

        author: "Md Ziaul Haque FICS",

        designation: "Lecturer in Marine Engineering",

        diameter: 3.30,

        bladeCount: 5,

        waterDensity: 1025,

        referencePitch: 25,

        minimumPitch: 5,

        maximumPitch: 45,

        minimumRPM: 0,

        maximumRPM: 300,

        minimumAdvanceSpeed: 0,

        maximumAdvanceSpeed: 15,

        // Illustrative coefficient-curve parameters.

        referenceKT0: 0.30,

        referenceKQ0: 0.052,

        referenceZeroThrustJ: 1.15,

        torqueReductionFactor: 0.60,

        minimumOperatingRPM: 1

    });


    // ========================================================
    // 02. MODULE STATE
    // ========================================================

    let initialised = false;

    let unsubscribe = null;

    let currentResults = null;


    // ========================================================
    // 03. NUMERICAL UTILITIES
    // ========================================================

    function clamp(value, minimum, maximum) {

        return Math.min(
            maximum,
            Math.max(minimum, value)
        );

    }


    function validNumber(value) {

        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );

    }


    function createUnavailableResult(
        status,
        message,
        inputs
    ) {

        return {

            valid: false,

            status: status,

            message: message,

            thrust: null,

            torque: null,

            power: null,

            efficiency: null,

            advanceCoefficient: null,

            thrustCoefficient: null,

            torqueCoefficient: null,

            rpm: inputs.rpm,

            pitch: inputs.pitch,

            advanceSpeed: inputs.advanceSpeed,

            diameter: CONFIG.diameter,

            density: CONFIG.waterDensity,

            cavitationStatus: "Not assessed — Step 7"

        };

    }


    // ========================================================
    // 04. PITCH DEPENDENCE
    //
    // The selected pitch angle modifies the illustrative
    // open-water characteristic curves.
    //
    // This is a teaching approximation.
    //
    // The 3D geometry is not used to calculate blade
    // sectional lift, drag or pressure.
    // ========================================================

    function getPitchFactor(pitchDegrees) {

        const pitch = clamp(

            pitchDegrees,

            CONFIG.minimumPitch,

            CONFIG.maximumPitch

        );

        const referenceRadians =
            CONFIG.referencePitch * Math.PI / 180;

        const pitchRadians =
            pitch * Math.PI / 180;

        const ratio =

            Math.tan(pitchRadians) /

            Math.tan(referenceRadians);

        return clamp(
            ratio,
            0.20,
            2.15
        );

    }


    // ========================================================
    // 05. ILLUSTRATIVE COEFFICIENT CURVES
    //
    // A conventional open-water propeller uses
    // experimentally obtained KT(J) and KQ(J) curves.
    //
    // Here, simplified curves are used to demonstrate
    // the effect of changing operating conditions.
    //
    // Predictions are restricted to an illustrative
    // positive-thrust operating envelope.
    // ========================================================

    function getCoefficients(
        advanceCoefficient,
        pitchDegrees
    ) {

        const pitchFactor =
            getPitchFactor(pitchDegrees);

        const ktAtZeroAdvance =

            CONFIG.referenceKT0 *

            Math.pow(pitchFactor, 0.65);

        const kqAtZeroAdvance =

            CONFIG.referenceKQ0 *

            Math.pow(pitchFactor, 0.70);

        const zeroThrustJ =

            CONFIG.referenceZeroThrustJ *

            Math.pow(pitchFactor, 0.32);

        if (

            !validNumber(advanceCoefficient) ||

            advanceCoefficient < 0 ||

            advanceCoefficient >= zeroThrustJ

        ) {

            return {

                valid: false,

                zeroThrustJ: zeroThrustJ,

                KT: null,

                KQ: null

            };

        }

        const advanceRatio =

            advanceCoefficient / zeroThrustJ;

        const KT =

            ktAtZeroAdvance *

            (1 - advanceRatio);

        const KQ =

            kqAtZeroAdvance *

            (
                1 -
                CONFIG.torqueReductionFactor *
                advanceRatio
            );

        if (

            KT <= 0 ||

            KQ <= 0 ||

            !validNumber(KT) ||

            !validNumber(KQ)

        ) {

            return {

                valid: false,

                zeroThrustJ: zeroThrustJ,

                KT: null,

                KQ: null

            };

        }

        return {

            valid: true,

            KT: KT,

            KQ: KQ,

            zeroThrustJ: zeroThrustJ

        };

    }


    // ========================================================
    // 06. MAIN ENGINEERING CALCULATION
    //
    // Inputs:
    // rpm          rev/min
    // pitch        degrees
    // advanceSpeed m/s
    //
    // Outputs:
    // thrust       kN
    // torque       kN.m
    // power        kW
    // efficiency   %
    // ========================================================

    function calculatePerformance(inputs = {}) {

        const rpm = Number(inputs.rpm);

        const pitch = Number(inputs.pitch);

        const advanceSpeed =
            Number(inputs.advanceSpeed);

        const normalisedInputs = {

            rpm: rpm,

            pitch: pitch,

            advanceSpeed: advanceSpeed

        };

        // Validate all inputs before calculating.

        if (

            !validNumber(rpm) ||

            !validNumber(pitch) ||

            !validNumber(advanceSpeed) ||

            rpm < CONFIG.minimumRPM ||

            rpm > CONFIG.maximumRPM ||

            pitch < CONFIG.minimumPitch ||

            pitch > CONFIG.maximumPitch ||

            advanceSpeed < CONFIG.minimumAdvanceSpeed ||

            advanceSpeed > CONFIG.maximumAdvanceSpeed

        ) {

            return createUnavailableResult(

                "invalid-input",

                "Operating conditions are outside the " +
                "configured slider limits.",

                normalisedInputs

            );

        }


        // ----------------------------------------------------
        // Stopped propeller
        // ----------------------------------------------------

        if (rpm === 0) {

            if (advanceSpeed > 0) {

                return createUnavailableResult(

                    "stopped-inflow",

                    "Stopped propeller in moving water: " +
                    "windmilling and locked-shaft loads " +
                    "are outside this model.",

                    normalisedInputs

                );

            }

            return {

                valid: true,

                status: "stopped",

                message: "Propeller stationary.",

                thrust: 0,

                torque: 0,

                power: 0,

                efficiency: null,

                advanceCoefficient: null,

                thrustCoefficient: null,

                torqueCoefficient: null,

                rpm: rpm,

                pitch: pitch,

                advanceSpeed: advanceSpeed,

                diameter: CONFIG.diameter,

                density: CONFIG.waterDensity,

                cavitationStatus: "Not assessed — Step 7"

            };

        }


        // ----------------------------------------------------
        // Very low RPM
        // ----------------------------------------------------

        if (rpm < CONFIG.minimumOperatingRPM) {

            return createUnavailableResult(

                "low-rpm",

                "Rotational speed below model limit.",

                normalisedInputs

            );

        }


        // ----------------------------------------------------
        // Revolutions per second
        // ----------------------------------------------------

        const n = rpm / 60;


        // ----------------------------------------------------
        // Advance coefficient
        //
        // J = VA / (n * D)
        // ----------------------------------------------------

        const J =

            advanceSpeed /

            (n * CONFIG.diameter);


        // ----------------------------------------------------
        // Obtain illustrative coefficients
        // ----------------------------------------------------

        const coefficients = getCoefficients(

            J,

            pitch

        );


        if (!coefficients.valid) {

            return createUnavailableResult(

                "outside-envelope",

                "Outside simplified positive-thrust " +
                "coefficient range. No prediction shown.",

                normalisedInputs

            );

        }


        const KT = coefficients.KT;

        const KQ = coefficients.KQ;


        // ----------------------------------------------------
        // THRUST
        //
        // T = KT * rho * n² * D⁴
        // ----------------------------------------------------

        const thrustNewtons =

            KT *

            CONFIG.waterDensity *

            Math.pow(n, 2) *

            Math.pow(CONFIG.diameter, 4);


        // ----------------------------------------------------
        // TORQUE
        //
        // Q = KQ * rho * n² * D⁵
        // ----------------------------------------------------

        const torqueNewtonMetres =

            KQ *

            CONFIG.waterDensity *

            Math.pow(n, 2) *

            Math.pow(CONFIG.diameter, 5);


        // ----------------------------------------------------
        // SHAFT INPUT
        //
        // PD = 2 * PI * n * Q
        // ----------------------------------------------------

        const angularVelocity =

            2 * Math.PI * n;


        const powerWatts =

            angularVelocity *

            torqueNewtonMetres;


        // ----------------------------------------------------
        // OPEN-WATER EFFICIENCY
        //
        // eta0 = (T * VA) / PD
        //
        // Equivalent:
        // eta0 = (J * KT) / (2 * PI * KQ)
        // ----------------------------------------------------

        let efficiency = null;

        if (

            powerWatts > 0 &&

            advanceSpeed > 0

        ) {

            efficiency =

                (
                    thrustNewtons *
                    advanceSpeed /
                    powerWatts
                ) * 100;

        } else if (

            powerWatts > 0 &&

            advanceSpeed === 0

        ) {

            // Open-water efficiency is zero
            // at the bollard/static condition.

            efficiency = 0;

        }


        // ----------------------------------------------------
        // Convert to dashboard engineering units
        // ----------------------------------------------------

        const thrustKN =

            thrustNewtons / 1000;


        const torqueKNm =

            torqueNewtonMetres / 1000;


        const powerKW =

            powerWatts / 1000;


        // ----------------------------------------------------
        // Validate calculated results
        // ----------------------------------------------------

        const values = [

            thrustKN,

            torqueKNm,

            powerKW,

            KT,

            KQ,

            J

        ];

        if (

            values.some(
                value => !validNumber(value)
            ) ||

            (
                efficiency !== null &&
                !validNumber(efficiency)
            )

        ) {

            return createUnavailableResult(

                "calculation-error",

                "Numerical calculation unavailable.",

                normalisedInputs

            );

        }


        // ----------------------------------------------------
        // Return calculated results
        // ----------------------------------------------------

        return {

            valid: true,

            status: "calculated",

            message:

                "Illustrative open-water prediction. " +
                "Not CFD-validated.",

            thrust: thrustKN,

            torque: torqueKNm,

            power: powerKW,

            efficiency: efficiency,

            advanceCoefficient: J,

            thrustCoefficient: KT,

            torqueCoefficient: KQ,

            rpm: rpm,

            pitch: pitch,

            advanceSpeed: advanceSpeed,

            diameter: CONFIG.diameter,

            density: CONFIG.waterDensity,

            revolutionsPerSecond: n,

            angularVelocity: angularVelocity,

            zeroThrustAdvanceCoefficient:
                coefficients.zeroThrustJ,

            cavitationStatus:
                "Not assessed — Step 7"

        };

    }


    // ========================================================
    // 07. UPDATE EXTRA ENGINEERING READINGS
    // ========================================================

    function updateAdditionalReadings(results) {

        const JElement =
            document.getElementById(
                "advanceCoefficientValue"
            );

        const KTElement =
            document.getElementById(
                "thrustCoefficientValue"
            );

        const KQElement =
            document.getElementById(
                "torqueCoefficientValue"
            );

        const modelStatus =
            document.getElementById(
                "calculationStatus"
            );

        function format(value, places) {

            return validNumber(value)
                ? value.toFixed(places)
                : "--";

        }

        if (JElement) {

            JElement.textContent = format(

                results.advanceCoefficient,

                3

            );

        }

        if (KTElement) {

            KTElement.textContent = format(

                results.thrustCoefficient,

                4

            );

        }

        if (KQElement) {

            KQElement.textContent = format(

                results.torqueCoefficient,

                4

            );

        }

        if (modelStatus) {

            modelStatus.textContent =
                results.message;

            modelStatus.style.color =
                results.valid
                    ? "#168A73"
                    : "#B45309";

        }

    }


    // ========================================================
    // 08. UPDATE MAIN DASHBOARD
    // ========================================================

    function updateDashboard(results) {

        const app =
            window.HYROVISION3D;

        if (

            app &&

            typeof app.updateEngineeringResults ===
            "function"

        ) {

            app.updateEngineeringResults({

                thrust:
                    results.valid
                        ? results.thrust
                        : null,

                torque:
                    results.valid
                        ? results.torque
                        : null,

                power:
                    results.valid
                        ? results.power
                        : null,

                efficiency:
                    results.valid
                        ? results.efficiency
                        : null,

                cavitationStatus:
                    results.cavitationStatus

            });

        }

        updateAdditionalReadings(results);

    }


    // ========================================================
    // 09. RECALCULATE OPERATING CONDITION
    // ========================================================

    function recalculate(state) {

        if (!state) {

            return null;

        }

        currentResults =
            calculatePerformance({

                rpm: state.rpm,

                pitch: state.pitch,

                advanceSpeed: state.advanceSpeed

            });

        updateDashboard(currentResults);

        document.dispatchEvent(

            new CustomEvent(

                "hyrovision:performance",

                {

                    detail: {

                        results: currentResults

                    }

                }

            )

        );

        return currentResults;

    }


    // ========================================================
    // 10. APPLICATION STATE CONNECTION
    // ========================================================

    function handleApplicationChange(

        state,

        eventType

    ) {

        // Avoid recalculating every animation frame.

        const relevantEvents = [

            "rpm-change",

            "pitch-change",

            "speed-change",

            "simulation-reset",

            "application-ready",

            "initial-sync"

        ];

        if (

            !relevantEvents.includes(eventType)

        ) {

            return;

        }

        recalculate(state);

    }


    // ========================================================
    // 11. INITIALISE MODULE
    // ========================================================

    function initialiseHydrodynamics() {

        if (initialised) {

            return;

        }

        const app =
            window.HYROVISION3D;

        if (

            !app ||

            typeof app.subscribe !== "function"

        ) {

            console.error(

                "HYROVISION3D: Main controller unavailable."

            );

            return;

        }

        unsubscribe =
            app.subscribe(
                handleApplicationChange
            );

        initialised = true;

        recalculate(
            app.getState()
        );

        console.info(

            "HYROVISION3D: Hydrodynamics ready."

        );

        console.info(

            "Propeller diameter:",

            CONFIG.diameter,

            "m"

        );

        console.info(

            "Seawater density:",

            CONFIG.waterDensity,

            "kg/m3"

        );

    }


    // ========================================================
    // 12. PUBLIC ENGINEERING INTERFACE
    // ========================================================

    window.HYROVISION3D_HYDRODYNAMICS =
        Object.freeze({

            config: CONFIG,

            calculate: calculatePerformance,

            initialise: initialiseHydrodynamics,

            getResults: function () {

                return currentResults
                    ? { ...currentResults }
                    : null;

            },

            getCoefficients: getCoefficients,

            isReady: function () {

                return initialised;

            }

        });


    // ========================================================
    // 13. START MODULE
    //
    // This module is loaded after the main application
    // controller, so its subscription is available.
    // ========================================================

    if (document.readyState === "loading") {

        document.addEventListener(

            "DOMContentLoaded",

            initialiseHydrodynamics,

            { once: true }

        );

    } else {

        initialiseHydrodynamics();

    }


    // ========================================================
    // END OF FILE
    //
    // HYROVISION3D
    // Marine Propeller Engineering Calculations
    //
    // Md Ziaul Haque FICS
    // Lecturer in Marine Engineering
    // ========================================================

})();