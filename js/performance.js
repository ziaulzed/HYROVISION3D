/*
===========================================================
 HYROVISION3D
 INVISIBLE FORCES BEHIND THE SHIP'S PROPELLER

 STEP 8: INTERACTIVE PERFORMANCE ANALYSIS

 Author:
 Md Ziaul Haque FICS
 Lecturer in Marine Engineering

 File: js/performance.js
 Version: 1.0

 Technology:
 JavaScript and Plotly.js

 Charts:
 1. Thrust vs RPM
 2. Torque vs RPM
 3. Efficiency vs advance speed
 4. Operating condition comparison

 Engineering data:
 Uses the existing hydrodynamics.js calculation module.

 Theme:
 Ocean Blue / Deep Navy / Marine White

 IMPORTANT:
 Results are illustrative open-water estimates.
 They are not validated CFD predictions.
===========================================================
*/

"use strict";

(function () {

    // =====================================================
    // 01. CONFIGURATION
    // =====================================================

    const CONFIG = Object.freeze({

        defaultRPM: 120,
        defaultPitch: 25,
        defaultSpeed: 5,

        maximumRPM: 300,
        maximumSpeed: 15,

        rpmStep: 5,
        speedStep: 0.25,

        colours: {

            ocean: "#006994",
            navy: "#003B5C",
            turquoise: "#16A6B6",
            teal: "#168A73",
            amber: "#E5A23D",

            steel: "#8799A5",
            grid: "#E5EDF1",
            text: "#243746",
            muted: "#526778",
            white: "#FFFFFF"

        }

    });


    // =====================================================
    // 02. MODULE STATE
    // =====================================================

    let initialised = false;

    let hydrodynamics = null;

    let application = null;

    let unsubscribe = null;

    let chartTimer = null;

    let chartRequestId = 0;

    let chartsBusy = false;

    let chartsPending = false;

    let currentCondition = {

        rpm: CONFIG.defaultRPM,
        pitch: CONFIG.defaultPitch,
        advanceSpeed: CONFIG.defaultSpeed

    };

    let referenceCondition = {

        ...currentCondition

    };

    const graphIds = [

        "thrustGraph",
        "torqueGraph",
        "efficiencyGraph",
        "comparisonGraph"

    ];


    // =====================================================
    // 03. NUMERICAL UTILITIES
    // =====================================================

    function finite(value) {

        return (
            typeof value === "number" &&
            Number.isFinite(value)
        );

    }


    function round(value, decimals = 2) {

        return finite(value)
            ? value.toFixed(decimals)
            : "--";

    }


    function calculate(condition) {

        if (!hydrodynamics) {

            return null;

        }

        return hydrodynamics.calculate(condition);

    }


    function validResult(result) {

        return Boolean(
            result && result.valid
        );

    }


    // =====================================================
    // 04. PLOTLY CONFIGURATION
    // =====================================================

    const plotConfig = {

        responsive: true,

        displaylogo: false,

        displayModeBar: true,

        scrollZoom: false,

        doubleClick: "reset",

        toImageButtonOptions: {

            format: "png",

            filename: "HYROVISION3D_Performance",

            height: 650,

            width: 1000,

            scale: 2

        },

        modeBarButtonsToRemove: [

            "lasso2d",
            "select2d",
            "autoScale2d"

        ]

    };


    // =====================================================
    // 05. CHART LAYOUT
    // =====================================================

    function baseLayout(

        horizontalTitle,

        verticalTitle

    ) {

        return {

            autosize: true,

            height: 320,

            paper_bgcolor:
                CONFIG.colours.white,

            plot_bgcolor:
                CONFIG.colours.white,

            font: {

                family:
                    "Segoe UI, Arial, sans-serif",

                size: 11,

                color:
                    CONFIG.colours.text

            },

            margin: {

                l: 72,
                r: 22,
                t: 24,
                b: 70

            },

            hovermode: "closest",

            showlegend: true,

            legend: {

                orientation: "h",

                x: 0,

                y: 1.16,

                font: {

                    size: 10

                }

            },

            xaxis: {

                title: {

                    text: horizontalTitle,

                    standoff: 12

                },

                showgrid: true,

                gridcolor:
                    CONFIG.colours.grid,

                zeroline: false,

                automargin: true

            },

            yaxis: {

                title: {

                    text: verticalTitle,

                    standoff: 10

                },

                showgrid: true,

                gridcolor:
                    CONFIG.colours.grid,

                zeroline: false,

                rangemode: "tozero",

                automargin: true

            },

            hoverlabel: {

                bgcolor:
                    CONFIG.colours.navy,

                font: {

                    color: "#FFFFFF"

                }

            }

        };

    }


    // =====================================================
    // 06. CREATE LINE TRACE
    // =====================================================

    function lineTrace(

        name,

        x,

        y,

        colour,

        unit

    ) {

        return {

            type: "scatter",

            mode: "lines",

            name: name,

            x: x,

            y: y,

            connectgaps: false,

            line: {

                color: colour,

                width: 2.6,

                shape: "linear"

            },

            hovertemplate:

                "%{x:.2f}<br>" +

                "%{y:.2f} " +

                unit +

                "<extra>" +

                name +

                "</extra>"

        };

    }


    // =====================================================
    // 07. CREATE CURRENT OPERATING POINT
    // =====================================================

    function pointTrace(

        name,

        x,

        y,

        unit

    ) {

        return {

            type: "scatter",

            mode: "markers",

            name: name,

            x: finite(y) ? [x] : [],

            y: finite(y) ? [y] : [],

            marker: {

                color:
                    CONFIG.colours.amber,

                size: 11,

                symbol: "circle",

                line: {

                    color:
                        CONFIG.colours.navy,

                    width: 1.5

                }

            },

            hovertemplate:

                "%{x:.2f}<br>" +

                "%{y:.2f} " +

                unit +

                "<extra>Current</extra>"

        };

    }


    // =====================================================
    // 08. GENERATE RPM SWEEP
    //
    // Invalid calculation points remain null.
    // Plotly displays gaps instead of invented values.
    // =====================================================

    function generateRPMSweep() {

        const rpmValues = [];

        const thrustValues = [];

        const torqueValues = [];

        for (

            let rpm = 0;

            rpm <= CONFIG.maximumRPM;

            rpm += CONFIG.rpmStep

        ) {

            const result = calculate({

                rpm: rpm,

                pitch:
                    currentCondition.pitch,

                advanceSpeed:
                    currentCondition.advanceSpeed

            });

            rpmValues.push(rpm);

            thrustValues.push(

                validResult(result)
                    ? result.thrust
                    : null

            );

            torqueValues.push(

                validResult(result)
                    ? result.torque
                    : null

            );

        }

        return {

            rpm: rpmValues,

            thrust: thrustValues,

            torque: torqueValues

        };

    }


    // =====================================================
    // 09. THRUST GRAPH
    // =====================================================

    async function renderThrustGraph() {

        const data = generateRPMSweep();

        const current = calculate(
            currentCondition
        );

        const currentThrust =

            validResult(current)
                ? current.thrust
                : null;

        const traces = [

            lineTrace(

                "Estimated thrust",

                data.rpm,

                data.thrust,

                CONFIG.colours.ocean,

                "kN"

            ),

            pointTrace(

                "Current condition",

                currentCondition.rpm,

                currentThrust,

                "kN"

            )

        ];

        const layout = baseLayout(

            "Propeller speed (RPM)",

            "Thrust (kN)"

        );

        await Plotly.react(

            "thrustGraph",

            traces,

            layout,

            plotConfig

        );

    }


    // =====================================================
    // 10. TORQUE GRAPH
    // =====================================================

    async function renderTorqueGraph() {

        const data = generateRPMSweep();

        const current = calculate(
            currentCondition
        );

        const currentTorque =

            validResult(current)
                ? current.torque
                : null;

        const traces = [

            lineTrace(

                "Estimated torque",

                data.rpm,

                data.torque,

                CONFIG.colours.teal,

                "kN·m"

            ),

            pointTrace(

                "Current condition",

                currentCondition.rpm,

                currentTorque,

                "kN·m"

            )

        ];

        const layout = baseLayout(

            "Propeller speed (RPM)",

            "Shaft torque (kN·m)"

        );

        await Plotly.react(

            "torqueGraph",

            traces,

            layout,

            plotConfig

        );

    }


    // =====================================================
    // 11. EFFICIENCY CURVE
    //
    // Efficiency is plotted against advance speed
    // at the currently selected RPM and pitch.
    //
    // Values outside the calculation envelope
    // are excluded.
    // =====================================================

    function generateEfficiencySweep() {

        const speeds = [];

        const efficiencies = [];

        for (

            let speed = 0;

            speed <= CONFIG.maximumSpeed + 0.0001;

            speed += CONFIG.speedStep

        ) {

            const result = calculate({

                rpm:
                    currentCondition.rpm,

                pitch:
                    currentCondition.pitch,

                advanceSpeed: speed

            });

            speeds.push(speed);

            efficiencies.push(

                validResult(result) &&
                finite(result.efficiency)

                    ? result.efficiency

                    : null

            );

        }

        return {

            speeds: speeds,

            efficiencies: efficiencies

        };

    }


    // =====================================================
    // 12. EFFICIENCY GRAPH
    // =====================================================

    async function renderEfficiencyGraph() {

        const sweep =
            generateEfficiencySweep();

        const current = calculate(
            currentCondition
        );

        const currentEfficiency =

            validResult(current)
                ? current.efficiency
                : null;

        const traces = [

            lineTrace(

                "Open-water efficiency",

                sweep.speeds,

                sweep.efficiencies,

                CONFIG.colours.turquoise,

                "%"

            ),

            pointTrace(

                "Current condition",

                currentCondition.advanceSpeed,

                currentEfficiency,

                "%"

            )

        ];

        const layout = baseLayout(

            "Advance speed (m/s)",

            "Open-water efficiency (%)"

        );

        layout.yaxis.range = [0, 100];

        await Plotly.react(

            "efficiencyGraph",

            traces,

            layout,

            plotConfig

        );

    }


    // =====================================================
    // 13. NORMALISED COMPARISON
    //
    // Comparing different engineering units directly
    // on one numerical scale would be misleading.
    //
    // Each reference metric is represented by 100%.
    //
    // Current performance is shown relative to
    // the reference value.
    //
    // Actual values are retained in hover information.
    // =====================================================

    function getMetricValue(

        result,

        key

    ) {

        if (!validResult(result)) {

            return null;

        }

        const value = result[key];

        return finite(value)
            ? value
            : null;

    }


    function comparisonPercentage(

        reference,

        current

    ) {

        if (

            !finite(reference) ||

            !finite(current) ||

            reference <= 0

        ) {

            return null;

        }

        return current / reference * 100;

    }


    // =====================================================
    // 14. COMPARISON GRAPH
    // =====================================================

    async function renderComparisonGraph() {

        const referenceResult =
            calculate(referenceCondition);

        const currentResult =
            calculate(currentCondition);

        const metrics = [

            {
                key: "thrust",
                label: "Thrust",
                unit: "kN"
            },

            {
                key: "torque",
                label: "Torque",
                unit: "kN·m"
            },

            {
                key: "power",
                label: "Shaft input",
                unit: "kW"
            },

            {
                key: "efficiency",
                label: "Efficiency",
                unit: "%"
            }

        ];

        const labels = [];

        const referenceValues = [];

        const currentValues = [];

        const referenceHover = [];

        const currentHover = [];

        for (const metric of metrics) {

            const reference = getMetricValue(

                referenceResult,

                metric.key

            );

            const current = getMetricValue(

                currentResult,

                metric.key

            );

            labels.push(metric.label);

            const comparable =

                finite(reference) &&

                finite(current) &&

                reference > 0;

            referenceValues.push(

                comparable ? 100 : null

            );

            currentValues.push(

                comparable

                    ? comparisonPercentage(
                        reference,
                        current
                    )

                    : null

            );

            referenceHover.push(

                finite(reference)

                    ? round(reference) +
                      " " +
                      metric.unit

                    : "Unavailable"

            );

            currentHover.push(

                finite(current)

                    ? round(current) +
                      " " +
                      metric.unit

                    : "Unavailable"

            );

        }

        const traces = [

            {

                type: "bar",

                name: "Saved reference",

                x: labels,

                y: referenceValues,

                marker: {

                    color:
                        CONFIG.colours.steel

                },

                customdata: referenceHover,

                hovertemplate:

                    "%{x}<br>" +

                    "%{y:.1f}% of reference<br>" +

                    "Actual: %{customdata}" +

                    "<extra>Reference</extra>"

            },

            {

                type: "bar",

                name: "Current condition",

                x: labels,

                y: currentValues,

                marker: {

                    color:
                        CONFIG.colours.ocean

                },

                customdata: currentHover,

                hovertemplate:

                    "%{x}<br>" +

                    "%{y:.1f}% of reference<br>" +

                    "Actual: %{customdata}" +

                    "<extra>Current</extra>"

            }

        ];

        const layout = baseLayout(

            "Engineering parameter",

            "Percentage of saved reference (%)"

        );

        layout.barmode = "group";

        layout.yaxis.rangemode = "tozero";

        layout.xaxis.type = "category";

        await Plotly.react(

            "comparisonGraph",

            traces,

            layout,

            plotConfig

        );

        updateReferenceLabel();

    }


    // =====================================================
    // 15. UPDATE REFERENCE INFORMATION
    // =====================================================

    function updateReferenceLabel() {

        const label = document.getElementById(
            "referenceConditionLabel"
        );

        if (!label) {

            return;

        }

        label.textContent =

            "Saved reference: " +

            round(referenceCondition.rpm, 0) +

            " RPM | " +

            round(referenceCondition.pitch, 0) +

            "° pitch | " +

            round(
                referenceCondition.advanceSpeed,
                1
            ) +

            " m/s advance speed";

    }


    // =====================================================
    // 16. SAVE CURRENT CONDITION
    // =====================================================

    function saveReference() {

        referenceCondition = {

            ...currentCondition

        };

        updateReferenceLabel();

        scheduleCharts();

    }


    // =====================================================
    // 17. RESTORE DEFAULT REFERENCE
    // =====================================================

    function restoreReference() {

        referenceCondition = {

            rpm: CONFIG.defaultRPM,

            pitch: CONFIG.defaultPitch,

            advanceSpeed: CONFIG.defaultSpeed

        };

        updateReferenceLabel();

        scheduleCharts();

    }


    // =====================================================
    // 18. RENDER ALL CHARTS
    // =====================================================

    async function renderAllCharts() {

        if (!initialised) {

            return;

        }

        if (chartsBusy) {

            chartsPending = true;

            return;

        }

        chartsBusy = true;

        try {

            await renderThrustGraph();

            await renderTorqueGraph();

            await renderEfficiencyGraph();

            await renderComparisonGraph();

        } catch (error) {

            console.error(

                "HYROVISION3D chart error:",

                error

            );

            const status =
                document.getElementById(
                    "graphStatus"
                );

            if (status) {

                status.textContent =
                    "Graph rendering error. " +
                    "Check the browser Console.";

            }

        } finally {

            chartsBusy = false;

            if (chartsPending) {

                chartsPending = false;

                scheduleCharts();

            }

        }

    }


    // =====================================================
    // 19. THROTTLE GRAPH UPDATES
    //
    // Prevents excessive full-chart rendering
    // during continuous slider movement.
    // =====================================================

    function scheduleCharts() {

        if (!initialised) {

            return;

        }

        if (chartTimer !== null) {

            clearTimeout(chartTimer);

        }

        chartRequestId++;

        chartTimer = setTimeout(

            function () {

                chartTimer = null;

                renderAllCharts();

            },

            120

        );

    }


    // =====================================================
    // 20. RECEIVE APPLICATION CHANGES
    // =====================================================

    function handleApplicationChange(

        state,

        eventType

    ) {

        const relevantEvents = [

            "rpm-change",

            "pitch-change",

            "speed-change",

            "simulation-reset",

            "application-ready"

        ];

        if (!relevantEvents.includes(eventType)) {

            return;

        }

        currentCondition = {

            rpm: state.rpm,

            pitch: state.pitch,

            advanceSpeed:
                state.advanceSpeed

        };

        scheduleCharts();

    }


    // =====================================================
    // 21. CONNECT COMPARISON BUTTONS
    // =====================================================

    function connectButtons() {

        const saveButton =
            document.getElementById(
                "saveReferenceButton"
            );

        const restoreButton =
            document.getElementById(
                "restoreReferenceButton"
            );

        if (saveButton) {

            saveButton.addEventListener(

                "click",

                saveReference

            );

        }

        if (restoreButton) {

            restoreButton.addEventListener(

                "click",

                restoreReference

            );

        }

    }


    // =====================================================
    // 22. INITIALISATION
    // =====================================================

    function initialisePerformance() {

        if (initialised) {

            return;

        }

        application =
            window.HYROVISION3D;

        hydrodynamics =
            window.HYROVISION3D_HYDRODYNAMICS;

        if (

            !application ||

            !hydrodynamics ||

            typeof application.subscribe !== "function" ||

            typeof hydrodynamics.calculate !== "function"

        ) {

            console.error(

                "HYROVISION3D: Performance dependencies missing."

            );

            return;

        }

        if (

            typeof window.Plotly === "undefined"

        ) {

            console.error(

                "HYROVISION3D: Plotly.js unavailable."

            );

            graphIds.forEach(function (id) {

                const element =
                    document.getElementById(id);

                if (element) {

                    element.textContent =

                        "Plotly.js could not load. " +
                        "Check your internet connection.";

                }

            });

            return;

        }

        currentCondition = {

            rpm:
                application.getState().rpm,

            pitch:
                application.getState().pitch,

            advanceSpeed:
                application.getState().advanceSpeed

        };

        unsubscribe =
            application.subscribe(
                handleApplicationChange
            );

        connectButtons();

        initialised = true;

        updateReferenceLabel();

        scheduleCharts();

        console.info(

            "HYROVISION3D: Performance graphs ready."

        );

    }


    // =====================================================
    // 23. PUBLIC INTERFACE
    // =====================================================

    window.HYROVISION3D_PERFORMANCE =
        Object.freeze({

            initialise:
                initialisePerformance,

            update:
                scheduleCharts,

            saveReference:
                saveReference,

            restoreReference:
                restoreReference,

            getReference: function () {

                return {

                    ...referenceCondition

                };

            },

            isReady: function () {

                return initialised;

            }

        });


    // =====================================================
    // 24. START MODULE
    // =====================================================

    if (document.readyState === "loading") {

        document.addEventListener(

            "DOMContentLoaded",

            initialisePerformance,

            { once: true }

        );

    } else {

        initialisePerformance();

    }


    // =====================================================
    // END OF FILE
    //
    // HYROVISION3D
    // Interactive Engineering Performance
    //
    // Md Ziaul Haque FICS
    // Lecturer in Marine Engineering
    // =====================================================

})();