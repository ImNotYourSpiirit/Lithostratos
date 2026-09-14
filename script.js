/* =========================================================
   LITHOSTRATOS
   V0.1 — Éditeur de coupes géologiques
========================================================= */


/* =========================================================
   CONFIGURATION
========================================================= */

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 700;

const DEFAULT_RELIEF_Y = 350;


/* =========================================================
   ÉTAT DU PROJET
========================================================= */

let state = {

    relief: [],

    layers: [

        {
            id: 1,
            name: "Couche 1",
            type: "Calcaire",
            color: "#a79b7a",
            thickness: 70
        },

        {
            id: 2,
            name: "Couche 2",
            type: "Marne",
            color: "#777c65",
            thickness: 70
        },

        {
            id: 3,
            name: "Couche 3",
            type: "Grès",
            color: "#9b7153",
            thickness: 80
        },

        {
            id: 4,
            name: "Couche 4",
            type: "Argile",
            color: "#625e58",
            thickness: 90
        }

    ],

    selectedLayer: null,

    currentTool: "relief"
};


/* =========================================================
   HISTORIQUE
========================================================= */

let history = [];
let historyIndex = -1;


function saveHistory() {

    const snapshot = JSON.stringify(state);

    history = history.slice(0, historyIndex + 1);

    history.push(snapshot);

    historyIndex++;

    if (history.length > 50) {
        history.shift();
        historyIndex--;
    }
}


function undo() {

    if (historyIndex <= 0) {
        return;
    }

    historyIndex--;

    state = JSON.parse(history[historyIndex]);

    renderAll();
}


function redo() {

    if (historyIndex >= history.length - 1) {
        return;
    }

    historyIndex++;

    state = JSON.parse(history[historyIndex]);

    renderAll();
}


/* =========================================================
   DOM
========================================================= */

const svg = document.getElementById("geoCanvas");

const reliefFill = document.getElementById("reliefFill");
const reliefLine = document.getElementById("reliefLine");

const layersGroup = document.getElementById("layersGroup");

const layersList = document.getElementById("layersList");

const propertiesContent =
    document.getElementById("propertiesContent");

const emptyMessage =
    document.getElementById("emptyMessage");

const coordinates =
    document.getElementById("coordinates");

const drawingStatus =
    document.getElementById("drawingStatus");

const cursorPoint =
    document.getElementById("cursorPoint");


/* =========================================================
   INITIALISATION
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    createGrid();

    generateDefaultRelief();

    saveHistory();

    renderAll();

    setupTools();

    setupCanvas();

    setupButtons();

});


/* =========================================================
   GRILLE
========================================================= */

function createGrid() {

    const grid = document.getElementById("grid");

    grid.innerHTML = "";

    const spacing = 50;

    for (let x = 0; x <= SVG_WIDTH; x += spacing) {

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );

        line.setAttribute("x1", x);
        line.setAttribute("y1", 0);

        line.setAttribute("x2", x);
        line.setAttribute("y2", SVG_HEIGHT);

        grid.appendChild(line);
    }

    for (let y = 0; y <= SVG_HEIGHT; y += spacing) {

        const line = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "line"
        );

        line.setAttribute("x1", 0);
        line.setAttribute("y1", y);

        line.setAttribute("x2", SVG_WIDTH);
        line.setAttribute("y2", y);

        grid.appendChild(line);
    }
}


/* =========================================================
   RELIEF INITIAL
========================================================= */

function generateDefaultRelief() {

    state.relief = [];

    const points = 80;

    for (let i = 0; i <= points; i++) {

        const x = (i / points) * SVG_WIDTH;

        const y =
            DEFAULT_RELIEF_Y
            - Math.sin(i / 9) * 30
            - Math.sin(i / 17) * 45;

        state.relief.push({
            x,
            y
        });
    }
}


/* =========================================================
   OUTILS
========================================================= */

function setupTools() {

    const tools =
        document.querySelectorAll(".tool");

    tools.forEach(tool => {

        if (tool.classList.contains("disabled-tool")) {
            return;
        }

        tool.addEventListener("click", () => {

            tools.forEach(t =>
                t.classList.remove("active")
            );

            tool.classList.add("active");

            state.currentTool =
                tool.dataset.tool;

            updateCursor();

        });

    });

}


function updateCursor() {

    if (state.currentTool === "relief") {

        svg.style.cursor = "crosshair";

    } else {

        svg.style.cursor = "default";

    }

}


/* =========================================================
   DESSIN DU RELIEF
========================================================= */

let drawing = false;


function setupCanvas() {

    svg.addEventListener("pointerdown", event => {

        if (state.currentTool !== "relief") {
            return;
        }

        drawing = true;

        svg.setPointerCapture(event.pointerId);

        state.relief = [];

        addReliefPoint(event);

        emptyMessage.style.display = "none";

        drawingStatus.textContent =
            "Dessin du relief…";

    });


    svg.addEventListener("pointermove", event => {

        updateCoordinates(event);

        if (!drawing) {
            return;
        }

        addReliefPoint(event);

        renderRelief();
        renderLayers();

    });


    svg.addEventListener("pointerup", event => {

        if (!drawing) {
            return;
        }

        drawing = false;

        svg.releasePointerCapture(event.pointerId);

        simplifyRelief();

        saveHistory();

        renderAll();

        drawingStatus.textContent =
            "Relief enregistré";

    });


    svg.addEventListener("pointerleave", () => {

        cursorPoint.style.opacity = "0";

    });


    svg.addEventListener("pointerenter", () => {

        cursorPoint.style.opacity = "1";

    });

}


function getSVGPoint(event) {

    const rect =
        svg.getBoundingClientRect();

    const x =
        (event.clientX - rect.left)
        / rect.width
        * SVG_WIDTH;

    const y =
        (event.clientY - rect.top)
        / rect.height
        * SVG_HEIGHT;

    return {
        x: Math.max(0, Math.min(SVG_WIDTH, x)),
        y: Math.max(0, Math.min(SVG_HEIGHT, y))
    };

}


function addReliefPoint(event) {

    const point = getSVGPoint(event);

    const last =
        state.relief[state.relief.length - 1];

    /*
       Évite de créer trop de points
       lorsque la souris bouge très rapidement.
    */

    if (last) {

        const distance =
            Math.hypot(
                point.x - last.x,
                point.y - last.y
            );

        if (distance < 8) {
            return;
        }

    }

    state.relief.push(point);

}


/* =========================================================
   SIMPLIFICATION
========================================================= */

function simplifyRelief() {

    if (state.relief.length < 3) {
        return;
    }

    const simplified = [];

    for (let i = 0; i < state.relief.length; i++) {

        if (i % 2 === 0) {
            simplified.push(state.relief[i]);
        }

    }

    state.relief = simplified;

}


/* =========================================================
   RELIEF SVG
========================================================= */

function renderRelief() {

    if (state.relief.length < 2) {

        reliefLine.setAttribute("d", "");
        reliefFill.setAttribute("d", "");

        return;
    }

    let path = "";

    state.relief.forEach((point, index) => {

        if (index === 0) {

            path += `M ${point.x} ${point.y}`;

        } else {

            path += ` L ${point.x} ${point.y}`;

        }

    });


    reliefLine.setAttribute("d", path);


    const first =
        state.relief[0];

    const last =
        state.relief[state.relief.length - 1];


    const fillPath =
        path
        + ` L ${last.x} ${SVG_HEIGHT}`
        + ` L ${first.x} ${SVG_HEIGHT}`
        + " Z";


    reliefFill.setAttribute(
        "d",
        fillPath
    );

}


/* =========================================================
   COUCHES
========================================================= */

function renderLayers() {

    layersGroup.innerHTML = "";

    if (state.relief.length < 2) {
        return;
    }


    state.layers.forEach((layer, layerIndex) => {

        const topPoints =
            getLayerBoundary(layerIndex);

        const bottomPoints =
            getLayerBoundary(layerIndex + 1);


        let path = "";

        topPoints.forEach((point, index) => {

            if (index === 0) {

                path +=
                    `M ${point.x} ${point.y}`;

            } else {

                path +=
                    ` L ${point.x} ${point.y}`;

            }

        });


        for (
            let i = bottomPoints.length - 1;
            i >= 0;
            i--
        ) {

            const point =
                bottomPoints[i];

            path +=
                ` L ${point.x} ${point.y}`;

        }


        path += " Z";


        const element =
            document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );


        element.setAttribute(
            "d",
            path
        );

        element.setAttribute(
            "fill",
            layer.color
        );

        element.setAttribute(
            "stroke",
            "#272727"
        );

        element.setAttribute(
            "stroke-width",
            "1.2"
        );


        element.dataset.layerId =
            layer.id;


        element.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                selectLayer(layer.id);

            }
        );


        layersGroup.appendChild(element);

    });

}


/* =========================================================
   CALCUL DES INTERFACES
========================================================= */

function getLayerBoundary(boundaryIndex) {

    const points = [];

    let depth = 0;

    for (
        let i = 0;
        i < boundaryIndex;
        i++
    ) {

        depth +=
            state.layers[i].thickness;

    }


    state.relief.forEach(point => {

        points.push({

            x: point.x,

            y:
                point.y + depth

        });

    });


    return points;

}


/* =========================================================
   LISTE DES COUCHES
========================================================= */

function renderLayersList() {

    layersList.innerHTML = "";


    /*
       On affiche la couche supérieure
       en premier.
    */

    state.layers.forEach(layer => {

        const item =
            document.createElement("div");

        item.className = "layer-item";


        if (
            layer.id === state.selectedLayer
        ) {

            item.classList.add("selected");

        }


        item.innerHTML = `

            <div
                class="layer-color"
                style="background:${layer.color}">
            </div>

            <div class="layer-info">

                <div class="layer-name">
                    ${escapeHTML(layer.name)}
                </div>

                <div class="layer-type">
                    ${escapeHTML(layer.type)}
                    · ${layer.thickness} m
                </div>

            </div>

            <button
                class="layer-delete"
                title="Supprimer">
                ×
            </button>

        `;


        item.addEventListener(
            "click",
            event => {

                if (
                    event.target.closest(
                        ".layer-delete"
                    )
                ) {
                    return;
                }

                selectLayer(layer.id);

            }
        );


        const deleteButton =
            item.querySelector(
                ".layer-delete"
            );


        deleteButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();

                deleteLayer(layer.id);

            }
        );


        layersList.appendChild(item);

    });

}


/* =========================================================
   SÉLECTION D'UNE COUCHE
========================================================= */

function selectLayer(id) {

    state.selectedLayer = id;

    renderLayersList();

    renderProperties();

}


/* =========================================================
   PROPRIÉTÉS
========================================================= */

function renderProperties() {

    const layer =
        state.layers.find(
            l => l.id === state.selectedLayer
        );


    if (!layer) {

        propertiesContent.innerHTML = `

            <div class="no-selection">

                <span>◈</span>

                <p>
                    Sélectionne une couche pour
                    modifier ses propriétés.
                </p>

            </div>

        `;

        return;

    }


    propertiesContent.innerHTML = `

        <div class="property">

            <label>Nom</label>

            <input
                id="propertyName"
                type="text"
                value="${escapeAttribute(layer.name)}">

        </div>


        <div class="property">

            <label>Lithologie</label>

            <select id="propertyType">

                <option ${layer.type === "Calcaire" ? "selected" : ""}>
                    Calcaire
                </option>

                <option ${layer.type === "Grès" ? "selected" : ""}>
                    Grès
                </option>

                <option ${layer.type === "Marne" ? "selected" : ""}>
                    Marne
                </option>

                <option ${layer.type === "Argile" ? "selected" : ""}>
                    Argile
                </option>

                <option ${layer.type === "Schiste" ? "selected" : ""}>
                    Schiste
                </option>

                <option ${layer.type === "Granite" ? "selected" : ""}>
                    Granite
                </option>

                <option ${layer.type === "Basalte" ? "selected" : ""}>
                    Basalte
                </option>

                <option ${layer.type === "Gneiss" ? "selected" : ""}>
                    Gneiss
                </option>

                <option ${layer.type === "Conglomérat" ? "selected" : ""}>
                    Conglomérat
                </option>

                <option ${layer.type === "Autre" ? "selected" : ""}>
                    Autre
                </option>

            </select>

        </div>


        <div class="property">

            <label>Couleur</label>

            <input
                id="propertyColor"
                type="color"
                value="${layer.color}">

        </div>


        <div class="property">

            <label>Épaisseur (m)</label>

            <input
                id="propertyThickness"
                type="number"
                min="5"
                max="1000"
                value="${layer.thickness}">

        </div>

    `;


    document
        .getElementById("propertyName")
        .addEventListener(
            "change",
            event => {

                layer.name =
                    event.target.value;

                saveHistory();

                renderAll();

            }
        );


    document
        .getElementById("propertyType")
        .addEventListener(
            "change",
            event => {

                layer.type =
                    event.target.value;

                saveHistory();

                renderAll();

            }
        );


    document
        .getElementById("propertyColor")
        .addEventListener(
            "change",
            event => {

                layer.color =
                    event.target.value;

                saveHistory();

                renderAll();

            }
        );


    document
        .getElementById("propertyThickness")
        .addEventListener(
            "change",
            event => {

                let value =
                    Number(event.target.value);

                value =
                    Math.max(
                        5,
                        Math.min(
                            1000,
                            value
                        )
                    );

                layer.thickness = value;

                saveHistory();

                renderAll();

            }
        );

}


/* =========================================================
   AJOUT D'UNE COUCHE
========================================================= */

document
    .getElementById("addLayerBtn")
    .addEventListener(
        "click",
        addLayer
    );


function addLayer() {

    const nextId =
        Date.now();


    const number =
        state.layers.length + 1;


    const newLayer = {

        id: nextId,

        name:
            `Couche ${number}`,

        type:
            "Autre",

        color:
            generateLayerColor(number),

        thickness:
            70

    };


    state.layers.push(newLayer);

    state.selectedLayer =
        nextId;


    saveHistory();

    renderAll();

}


/* =========================================================
   COULEURS AUTOMATIQUES
========================================================= */

function generateLayerColor(index) {

    const colors = [

        "#a79b7a",
        "#777c65",
        "#9b7153",
        "#625e58",
        "#80735e",
        "#6d716c",
        "#8d826a",
        "#555b58",
        "#947d62",
        "#70705f"

    ];


    return colors[
        (index - 1) % colors.length
    ];

}


/* =========================================================
   SUPPRESSION D'UNE COUCHE
========================================================= */

function deleteLayer(id) {

    if (state.layers.length <= 1) {

        alert(
            "Lithostratos doit conserver au moins une couche."
        );

        return;

    }


    state.layers =
        state.layers.filter(
            layer => layer.id !== id
        );


    if (state.selectedLayer === id) {

        state.selectedLayer =
            null;

    }


    saveHistory();

    renderAll();

}


/* =========================================================
   BOUTONS
========================================================= */

function setupButtons() {

    document
        .getElementById("undoBtn")
        .addEventListener(
            "click",
            undo
        );


    document
        .getElementById("redoBtn")
        .addEventListener(
            "click",
            redo
        );


    document
        .getElementById("resetBtn")
        .addEventListener(
            "click",
            resetProject
        );


    document
        .getElementById("exportBtn")
        .addEventListener(
            "click",
            exportSVG
        );

}


/* =========================================================
   RESET
========================================================= */

function resetProject() {

    const confirmation =
        confirm(
            "Réinitialiser complètement la coupe ?"
        );


    if (!confirmation) {
        return;
    }


    state.relief = [];

    state.selectedLayer = null;

    generateDefaultRelief();

    saveHistory();

    renderAll();

    emptyMessage.style.display =
        "none";

}


/* =========================================================
   EXPORT SVG
========================================================= */

function exportSVG() {

    const serializer =
        new XMLSerializer();


    const svgString =
        serializer.serializeToString(svg);


    const blob =
        new Blob(
            [svgString],
            {
                type: "image/svg+xml"
            }
        );


    const url =
        URL.createObjectURL(blob);


    const link =
        document.createElement("a");


    link.href = url;

    link.download =
        "lithostratos-coupe.svg";


    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

}


/* =========================================================
   COORDONNÉES
========================================================= */

function updateCoordinates(event) {

    const point =
        getSVGPoint(event);


    coordinates.textContent =
        `X : ${Math.round(point.x)} m | Y : ${Math.round(point.y)} m`;


    cursorPoint.setAttribute(
        "cx",
        point.x
    );

    cursorPoint.setAttribute(
        "cy",
        point.y
    );

}


/* =========================================================
   RENDU GLOBAL
========================================================= */

function renderAll() {

    renderRelief();

    renderLayers();

    renderLayersList();

    renderProperties();

    updateCursor();


    if (
        state.relief.length > 0
    ) {

        emptyMessage.style.display =
            "none";

    }

}


/* =========================================================
   SÉCURITÉ HTML
========================================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


function escapeAttribute(value) {

    return escapeHTML(value);

}
