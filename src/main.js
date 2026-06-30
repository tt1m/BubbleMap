"use strict";

const SVG_NS = "http://www.w3.org/2000/svg";

const WIDTH = 1240;
const HEIGHT = 1754;

const MIN_BUBBLE_W = 5;
const MIN_BUBBLE_H = 5;
const MIN_GRID_W = 20;
const MIN_GRID_H = 20;

const FIELD_OUTLINE_PADDING = 10;
const FIELD_OUTLINE_STROKE = "#2563eb";
const ENTRY_OUTLINE_STROKE = "#f97316";
const BUBBLE_SELECTED_STROKE = "#dc2626";
const NORMAL_BUBBLE_STROKE = "#111827";

// Buttons / controls
const uploadImageInput = document.getElementById("image_upload");
const addFieldButton = document.getElementById("new_field");
const addEntryButton = document.getElementById("new_entry");
const deleteButton = document.getElementById("delete_button");
const duplicateButton = document.getElementById("duplicate_button");

const exportBlueprintButton = document.getElementById("export_blueprint_button");
const exportTemplateButton = document.getElementById("export_template_button");
const importBlueprintInput = document.getElementById("import_blueprint_input");

const addAnchorButton = document.getElementById("add_anchor_button");
const templateNameInput = document.getElementById("template_name_input");

const zoomOutButton = document.getElementById("zoom_out_button");
const zoomResetButton = document.getElementById("zoom_reset_button");
const zoomInButton = document.getElementById("zoom_in_button");

// Canvas
const canvasWrap = document.getElementById("canvas_wrap");
const canvasScale = document.getElementById("canvas_scale");
const svgImage = document.getElementById("loaded_image");
const svg = document.getElementById("image_svg");
const overlayLayer = document.getElementById("overlay_layer");

// Sidebar list
const fieldList = document.getElementById("field_list");

// Config panels
const fieldConfigEmpty = document.getElementById("field_config_empty");
const fieldConfigForm = document.getElementById("field_config_form");
const entryConfigEmpty = document.getElementById("entry_config_empty");
const entryConfigForm = document.getElementById("entry_config_form");

const fieldNameInput = document.getElementById("field_name_input");
const fieldTypeInput = document.getElementById("field_type_input");
const bubbleShapeInput = document.getElementById("bubble_shape_input");
const bubbleWInput = document.getElementById("bubble_w_input");
const bubbleHInput = document.getElementById("bubble_h_input");

const entryNameInput = document.getElementById("entry_name_input");
const entryStartXInput = document.getElementById("entry_start_x_input");
const entryStartYInput = document.getElementById("entry_start_y_input");
const numQuestionsInput = document.getElementById("num_questions_input");
const optionsInput = document.getElementById("options_input");
const rowSpacingInput = document.getElementById("row_spacing_input");
const colSpacingInput = document.getElementById("col_spacing_input");
const startQuestionNumInput = document.getElementById("start_question_num_input");
const verticalOptionsInput = document.getElementById("vertical_options_input");
const clearOverridesButton = document.getElementById("clear_overrides_button");

// Optional defaults panel
const useSelectedAsDefaultButton = document.getElementById("use_selected_as_default_button");
const resetDefaultsButton = document.getElementById("reset_defaults_button");
const defaultsSummary = document.getElementById("defaults_summary");

// Only remember visual/layout defaults globally.
const editorDefaults = {
    bubble_shape: "rect",
    bubble_w: 20,
    bubble_h: 20,
    num_questions: 4,
    options: ["A", "B", "C", "D"],
    row_spacing: 40,
    col_spacing: 40,
    vertical_options: false
};

let fields = [];
let anchors = [];

let selectedFieldId = null;
let selectedEntryId = null;
let selectedAnchorId = null;

let configRedrawFrame = null;
let zoom = 1;

let isPanningCanvas = false;
let didPanCanvas = false;
let panStartClientX = 0;
let panStartClientY = 0;
let panStartScrollLeft = 0;
let panStartScrollTop = 0;

svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
svg.setAttribute("width", WIDTH);
svg.setAttribute("height", HEIGHT);

svgImage.setAttribute("x", 0);
svgImage.setAttribute("y", 0);
svgImage.setAttribute("width", WIDTH);
svgImage.setAttribute("height", HEIGHT);

function createSvgElement(tagName) {
    return document.createElementNS(SVG_NS, tagName);
}

function formatNumber(value) {
    return Number(Number(value).toFixed(2));
}

function applyZoom() {
    if (!canvasScale) {
        return;
    }

    canvasScale.style.width = `${WIDTH * zoom}px`;
    canvasScale.style.height = `${HEIGHT * zoom}px`;
    canvasScale.style.transform = `scale(${zoom})`;
}

function saveEditorDefaults() {
    localStorage.setItem("blueprintEditorDefaults", JSON.stringify(editorDefaults));
}

function loadEditorDefaults() {
    const saved = localStorage.getItem("blueprintEditorDefaults");

    if (!saved) {
        return;
    }

    try {
        const parsed = JSON.parse(saved);

        Object.assign(editorDefaults, {
            bubble_shape: parsed.bubble_shape || editorDefaults.bubble_shape,
            bubble_w: Number(parsed.bubble_w) || editorDefaults.bubble_w,
            bubble_h: Number(parsed.bubble_h) || editorDefaults.bubble_h,
            num_questions: Number(parsed.num_questions) || editorDefaults.num_questions,
            options: Array.isArray(parsed.options) && parsed.options.length > 0
                ? parsed.options
                : editorDefaults.options,
            row_spacing: Number(parsed.row_spacing) || editorDefaults.row_spacing,
            col_spacing: Number(parsed.col_spacing) || editorDefaults.col_spacing,
            vertical_options: Boolean(parsed.vertical_options)
        });
    } catch {
        localStorage.removeItem("blueprintEditorDefaults");
    }
}

function redrawDefaultsSummary() {
    if (!defaultsSummary) {
        return;
    }

    defaultsSummary.textContent =
        `${formatNumber(editorDefaults.bubble_w)}×${formatNumber(editorDefaults.bubble_h)}, ` +
        `${editorDefaults.num_questions}Q, ` +
        `${editorDefaults.options.join("/")}, ` +
        `row ${formatNumber(editorDefaults.row_spacing)}, ` +
        `col ${formatNumber(editorDefaults.col_spacing)}, ` +
        `${editorDefaults.vertical_options ? "vertical" : "horizontal"}`;
}

function updateEditorDefault(key, value) {
    editorDefaults[key] = value;
    saveEditorDefaults();
    redrawDefaultsSummary();
}

function updateEditorDefaultsFromField(field) {
    updateEditorDefault("bubble_shape", field.bubble_shape);
    updateEditorDefault("bubble_w", field.bubble_w);
    updateEditorDefault("bubble_h", field.bubble_h);
}

function updateEditorDefaultsFromEntry(entry) {
    updateEditorDefault("num_questions", entry.num_questions);
    updateEditorDefault("options", structuredClone(entry.options));
    updateEditorDefault("row_spacing", entry.row_spacing);
    updateEditorDefault("col_spacing", entry.col_spacing);
    updateEditorDefault("vertical_options", entry.vertical_options);
}

function resetEditorDefaults() {
    Object.assign(editorDefaults, {
        bubble_shape: "rect",
        bubble_w: 20,
        bubble_h: 20,
        num_questions: 4,
        options: ["A", "B", "C", "D"],
        row_spacing: 40,
        col_spacing: 40,
        vertical_options: false
    });

    saveEditorDefaults();
    redrawDefaultsSummary();
}

function useSelectedAsDefault() {
    const field = getSelectedField();
    const entry = getSelectedEntry();

    if (field) {
        editorDefaults.bubble_shape = field.bubble_shape;
        editorDefaults.bubble_w = field.bubble_w;
        editorDefaults.bubble_h = field.bubble_h;
    }

    if (entry) {
        editorDefaults.num_questions = entry.num_questions;
        editorDefaults.options = structuredClone(entry.options);
        editorDefaults.row_spacing = entry.row_spacing;
        editorDefaults.col_spacing = entry.col_spacing;
        editorDefaults.vertical_options = entry.vertical_options;
    }

    saveEditorDefaults();
    redrawDefaultsSummary();
}

loadEditorDefaults();

function downloadJson(filename, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();

    URL.revokeObjectURL(url);
}

function normalizeShapeForTemplate(shape) {
    if (shape === "rect") {
        return "rectangle";
    }

    return shape;
}

function denormalizeShapeFromTemplate(shape) {
    if (shape === "rectangle") {
        return "rect";
    }

    return shape;
}

function getFieldById(fieldId) {
    return fields.find((field) => field.id === fieldId) || null;
}

function getEntryById(entryId) {
    const fieldId = entryId.split("|")[0];
    const field = getFieldById(fieldId);

    if (!field) {
        return null;
    }

    return field.entries.find((entry) => entry.id === entryId) || null;
}

function getFieldByEntryId(entryId) {
    const fieldId = entryId.split("|")[0];

    return getFieldById(fieldId);
}

function getAnchorById(anchorId) {
    return anchors.find((anchor) => anchor.id === anchorId) || null;
}

function getSelectedField() {
    if (selectedEntryId) {
        return getFieldByEntryId(selectedEntryId);
    }

    if (selectedFieldId) {
        return getFieldById(selectedFieldId);
    }

    return null;
}

function getSelectedEntry() {
    if (!selectedEntryId) {
        return null;
    }

    return getEntryById(selectedEntryId);
}

function getOverride(entry, rowIdx, colIdx) {
    return entry.overrides.find((override) => {
        return override.row_idx === rowIdx && override.col_idx === colIdx;
    }) || null;
}

function getOrCreateOverride(entry, rowIdx, colIdx, defaultX, defaultY) {
    let override = getOverride(entry, rowIdx, colIdx);

    if (!override) {
        override = {
            row_idx: rowIdx,
            col_idx: colIdx,
            x: defaultX,
            y: defaultY
        };

        entry.overrides.push(override);
    }

    return override;
}

function clientPointToSvgPoint(clientX, clientY) {
    const point = svg.createSVGPoint();

    point.x = clientX;
    point.y = clientY;

    return point.matrixTransform(svg.getScreenCTM().inverse());
}

function getSvgDeltaFromInteractEvent(event) {
    const previousPoint = clientPointToSvgPoint(
        event.clientX - event.dx,
        event.clientY - event.dy
    );

    const currentPoint = clientPointToSvgPoint(
        event.clientX,
        event.clientY
    );

    return {
        dx: currentPoint.x - previousPoint.x,
        dy: currentPoint.y - previousPoint.y
    };
}

function getBubbleDefaultPosition(entry, rowIdx, colIdx) {
    if (entry.vertical_options) {
        return {
            x: entry.col_spacing * rowIdx,
            y: entry.row_spacing * colIdx
        };
    }

    return {
        x: entry.col_spacing * colIdx,
        y: entry.row_spacing * rowIdx
    };
}

function getBubblePosition(entry, rowIdx, colIdx) {
    const defaultPosition = getBubbleDefaultPosition(entry, rowIdx, colIdx);
    const override = getOverride(entry, rowIdx, colIdx);

    if (!override) {
        return defaultPosition;
    }

    return {
        x: override.x,
        y: override.y
    };
}

function getAbsoluteBubblePosition(entry, rowIdx, colIdx, field) {
    const localPosition = getBubblePosition(entry, rowIdx, colIdx);

    return {
        x: entry.start_x + localPosition.x + field.bubble_w / 2,
        y: entry.start_y + localPosition.y + field.bubble_h / 2
    };
}

function getGridWidth(field, entry) {
    if (entry.vertical_options) {
        const numQuestions = entry.num_questions;

        if (numQuestions <= 1) {
            return field.bubble_w;
        }

        return field.bubble_w + entry.col_spacing * (numQuestions - 1);
    }

    const numOptions = entry.options.length;

    if (numOptions <= 1) {
        return field.bubble_w;
    }

    return field.bubble_w + entry.col_spacing * (numOptions - 1);
}

function getGridHeight(field, entry) {
    if (entry.vertical_options) {
        const numOptions = entry.options.length;

        if (numOptions <= 1) {
            return field.bubble_h;
        }

        return field.bubble_h + entry.row_spacing * (numOptions - 1);
    }

    const numQuestions = entry.num_questions;

    if (numQuestions <= 1) {
        return field.bubble_h;
    }

    return field.bubble_h + entry.row_spacing * (numQuestions - 1);
}

function getFieldBounds(field) {
    if (!field.entries.length) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    field.entries.forEach((entry) => {
        const gridWidth = getGridWidth(field, entry);
        const gridHeight = getGridHeight(field, entry);

        minX = Math.min(minX, entry.start_x);
        minY = Math.min(minY, entry.start_y);
        maxX = Math.max(maxX, entry.start_x + gridWidth);
        maxY = Math.max(maxY, entry.start_y + gridHeight);
    });

    return {
        x: minX - FIELD_OUTLINE_PADDING,
        y: minY - FIELD_OUTLINE_PADDING,
        width: maxX - minX + FIELD_OUTLINE_PADDING * 2,
        height: maxY - minY + FIELD_OUTLINE_PADDING * 2
    };
}

function createFieldHitbox(field) {
    const bounds = getFieldBounds(field);

    if (!bounds) {
        return null;
    }

    const isSelectedField = field.id === selectedFieldId && selectedEntryId === null;

    const hitbox = createSvgElement("rect");

    hitbox.classList.add("field-hitbox");
    hitbox.dataset.fieldId = field.id;
    hitbox.setAttribute("x", bounds.x);
    hitbox.setAttribute("y", bounds.y);
    hitbox.setAttribute("width", bounds.width);
    hitbox.setAttribute("height", bounds.height);
    hitbox.setAttribute("fill", isSelectedField ? "rgba(37, 99, 235, 0.04)" : "rgba(37, 99, 235, 0)");
    hitbox.setAttribute("stroke", isSelectedField ? FIELD_OUTLINE_STROKE : "transparent");
    hitbox.setAttribute("stroke-width", isSelectedField ? 1.5 : 0);
    hitbox.setAttribute("stroke-dasharray", "3 3");
    hitbox.setAttribute("rx", 6);
    hitbox.setAttribute("ry", 6);
    hitbox.setAttribute("pointer-events", "all");

    return hitbox;
}

function updateRenderedFieldHitbox(fieldId) {
    const field = getFieldById(fieldId);

    if (!field) {
        return;
    }

    const hitbox = overlayLayer.querySelector(
        `.field-hitbox[data-field-id="${CSS.escape(fieldId)}"]`
    );

    if (!hitbox) {
        return;
    }

    const bounds = getFieldBounds(field);

    if (!bounds) {
        return;
    }

    hitbox.setAttribute("x", bounds.x);
    hitbox.setAttribute("y", bounds.y);
    hitbox.setAttribute("width", bounds.width);
    hitbox.setAttribute("height", bounds.height);
}

function parseOptions(value) {
    return value
        .split(",")
        .map((option) => option.trim())
        .filter((option) => option.length > 0);
}

function scheduleRedrawConfig() {
    if (configRedrawFrame !== null) {
        return;
    }

    configRedrawFrame = requestAnimationFrame(() => {
        redrawConfig();
        configRedrawFrame = null;
    });
}

function redrawAll() {
    redrawField();
    redrawCanvas();
    redrawConfig();
}

function getDefaultEntryPosition(field) {
    const lastEntry = field.entries[field.entries.length - 1];

    if (!lastEntry) {
        return {
            x: 100,
            y: 100
        };
    }

    return {
        x: lastEntry.start_x + 40,
        y: lastEntry.start_y + 40
    };
}

function getNextStartQuestionNum(field) {
    const lastEntry = field.entries[field.entries.length - 1];

    if (!lastEntry) {
        return 1;
    }

    return lastEntry.start_question_num + lastEntry.num_questions;
}

function newField() {
    const idx = fields.length + 1;
    const fieldId = crypto.randomUUID();
    const entryId = `${fieldId}|${crypto.randomUUID()}`;

    return {
        id: fieldId,
        name: `Field ${idx}`,
        type: "answers",
        bubble_shape: editorDefaults.bubble_shape,
        bubble_w: editorDefaults.bubble_w,
        bubble_h: editorDefaults.bubble_h,
        entries: [
            {
                id: entryId,
                name: "Entry 1",
                start_x: 100,
                start_y: 100,
                num_questions: editorDefaults.num_questions,
                options: structuredClone(editorDefaults.options),
                row_spacing: editorDefaults.row_spacing,
                col_spacing: editorDefaults.col_spacing,
                vertical_options: editorDefaults.vertical_options,
                start_question_num: 1,
                overrides: []
            }
        ]
    };
}

function newEntry(fieldId) {
    const field = getFieldById(fieldId);

    if (!field) {
        return null;
    }

    const idx = field.entries.length + 1;
    const entryId = `${fieldId}|${crypto.randomUUID()}`;
    const position = getDefaultEntryPosition(field);

    return {
        id: entryId,
        name: `Entry ${idx}`,
        start_x: position.x,
        start_y: position.y,
        num_questions: editorDefaults.num_questions,
        options: structuredClone(editorDefaults.options),
        row_spacing: editorDefaults.row_spacing,
        col_spacing: editorDefaults.col_spacing,
        vertical_options: editorDefaults.vertical_options,
        start_question_num: getNextStartQuestionNum(field),
        overrides: []
    };
}

function newAnchor() {
    return {
        id: crypto.randomUUID(),
        name: `Anchor ${anchors.length + 1}`,
        x: 100,
        y: 100,
        width: 300,
        height: 180
    };
}

function cloneEntry(entry, newFieldId) {
    return {
        ...structuredClone(entry),
        id: `${newFieldId}|${crypto.randomUUID()}`,
        name: `${entry.name} Copy`,
        start_x: entry.start_x + 30,
        start_y: entry.start_y + 30
    };
}

function cloneField(field) {
    const newFieldId = crypto.randomUUID();

    const clonedField = {
        ...structuredClone(field),
        id: newFieldId,
        name: `${field.name} Copy`,
        entries: []
    };

    clonedField.entries = field.entries.map((entry) => {
        return cloneEntry(entry, newFieldId);
    });

    return clonedField;
}

function buildBlueprintJson() {
    return {
        version: 1,
        name: templateNameInput.value || "Untitled",
        image: {
            width: WIDTH,
            height: HEIGHT
        },
        fields: fields,
        anchor: anchors
    };
}

function buildTemplateJson() {
    return {
        name: templateNameInput.value || "Untitled",
        image: {
            width: WIDTH,
            height: HEIGHT
        },
        anchor: anchors.map((anchor) => {
            return {
                name: anchor.name,
                x: Math.round(anchor.x),
                y: Math.round(anchor.y),
                width: Math.round(anchor.width),
                height: Math.round(anchor.height)
            };
        }),
        fields: fields.map((field) => {
            return {
                name: field.name,
                type: field.type,
                bubble: {
                    shape: normalizeShapeForTemplate(field.bubble_shape),
                    width: Math.round(field.bubble_w),
                    height: Math.round(field.bubble_h)
                },
                entries: field.entries.flatMap((entry) => {
                    const exportedEntries = [];

                    for (let rowIdx = 0; rowIdx < entry.num_questions; rowIdx++) {
                        const question = entry.start_question_num + rowIdx;
                        const bubbles = [];

                        for (let colIdx = 0; colIdx < entry.options.length; colIdx++) {
                            const absolutePosition = getAbsoluteBubblePosition(entry, rowIdx, colIdx, field);

                            bubbles.push({
                                x: Math.round(absolutePosition.x),
                                y: Math.round(absolutePosition.y),
                                value: entry.options[colIdx]
                            });
                        }

                        exportedEntries.push({
                            question: question,
                            bubbles: bubbles
                        });
                    }

                    return exportedEntries;
                })
            };
        })
    };
}

function redrawField() {
    fieldList.innerHTML = "";

    fields.forEach((field) => {
        const fieldLi = document.createElement("li");

        const fieldButton = document.createElement("button");
        fieldButton.classList.add("list-item");
        fieldButton.textContent = field.name;
        fieldButton.dataset.id = field.id;

        if (field.id === selectedFieldId && selectedEntryId === null) {
            fieldButton.classList.add("selected");
        }

        fieldLi.appendChild(fieldButton);

        const entryList = document.createElement("ul");

        field.entries.forEach((entry) => {
            const entryLi = document.createElement("li");

            const entryButton = document.createElement("button");
            entryButton.classList.add("list-item");
            entryButton.textContent = entry.name;
            entryButton.dataset.id = entry.id;

            if (entry.id === selectedEntryId) {
                entryButton.classList.add("selected");
            }

            entryLi.appendChild(entryButton);
            entryList.appendChild(entryLi);
        });

        fieldLi.appendChild(entryList);
        fieldList.appendChild(fieldLi);
    });
}

function createBubbleShape(field, entry, rowIdx, colIdx) {
    const bubbleShape = field.bubble_shape;
    const bubbleW = field.bubble_w;
    const bubbleH = field.bubble_h;

    const shape = createSvgElement(bubbleShape);

    shape.classList.add("bubble-shape");
    shape.dataset.fieldId = field.id;
    shape.dataset.entryId = entry.id;
    shape.dataset.rowIdx = rowIdx;
    shape.dataset.colIdx = colIdx;

    if (entry.id === selectedEntryId) {
        shape.classList.add("selected");
    }

    if (bubbleShape === "rect") {
        shape.setAttribute("x", 0);
        shape.setAttribute("y", 0);
        shape.setAttribute("width", bubbleW);
        shape.setAttribute("height", bubbleH);
    } else if (bubbleShape === "ellipse") {
        shape.setAttribute("cx", bubbleW / 2);
        shape.setAttribute("cy", bubbleH / 2);
        shape.setAttribute("rx", bubbleW / 2);
        shape.setAttribute("ry", bubbleH / 2);
    }

    shape.setAttribute("fill", "none");
    shape.setAttribute("stroke", entry.id === selectedEntryId ? BUBBLE_SELECTED_STROKE : NORMAL_BUBBLE_STROKE);
    shape.setAttribute("stroke-width", entry.id === selectedEntryId ? 1.5 : 1);
    shape.setAttribute("pointer-events", "all");

    return shape;
}

function createBubbleResizeHandle(field, entry) {
    const handleSize = 3;
    const handle = createSvgElement("rect");

    handle.classList.add("bubble-size-handle");

    if (entry.id !== selectedEntryId) {
        handle.classList.add("hidden-handle");
    }

    handle.setAttribute("x", field.bubble_w - handleSize / 2);
    handle.setAttribute("y", field.bubble_h - handleSize / 2);
    handle.setAttribute("width", handleSize);
    handle.setAttribute("height", handleSize);
    handle.setAttribute("fill", "white");
    handle.setAttribute("stroke", "black");
    handle.setAttribute("stroke-width", 1);
    handle.setAttribute("pointer-events", entry.id === selectedEntryId ? "all" : "none");

    return handle;
}

function createBubbleGroup(field, entry, rowIdx, colIdx) {
    const position = getBubblePosition(entry, rowIdx, colIdx);
    const gBubble = createSvgElement("g");

    gBubble.classList.add("bubble-item");
    gBubble.dataset.fieldId = field.id;
    gBubble.dataset.entryId = entry.id;
    gBubble.dataset.rowIdx = rowIdx;
    gBubble.dataset.colIdx = colIdx;
    gBubble.setAttribute("transform", `translate(${position.x}, ${position.y})`);

    const shape = createBubbleShape(field, entry, rowIdx, colIdx);
    const handle = createBubbleResizeHandle(field, entry);

    handle.dataset.fieldId = field.id;
    handle.dataset.entryId = entry.id;
    handle.dataset.rowIdx = rowIdx;
    handle.dataset.colIdx = colIdx;

    gBubble.appendChild(shape);
    gBubble.appendChild(handle);

    return gBubble;
}

function createEntryResizeBox(field, entry) {
    const gridWidth = getGridWidth(field, entry);
    const gridHeight = getGridHeight(field, entry);
    const box = createSvgElement("rect");

    box.classList.add("entry-grid-box");
    box.dataset.fieldId = field.id;
    box.dataset.entryId = entry.id;
    box.setAttribute("x", 0);
    box.setAttribute("y", 0);
    box.setAttribute("width", gridWidth);
    box.setAttribute("height", gridHeight);
    box.setAttribute("fill", "transparent");
    box.setAttribute("stroke", entry.id === selectedEntryId ? ENTRY_OUTLINE_STROKE : "transparent");
    box.setAttribute("stroke-width", 1.5);
    box.setAttribute("stroke-dasharray", "3 3");
    box.setAttribute("rx", 4);
    box.setAttribute("ry", 4);
    box.setAttribute("pointer-events", "all");

    return box;
}

function createEntryResizeHandle(field, entry) {
    const handleSize = 5;
    const gridWidth = getGridWidth(field, entry);
    const gridHeight = getGridHeight(field, entry);
    const handle = createSvgElement("rect");

    handle.classList.add("entry-grid-size-handle");

    if (entry.id !== selectedEntryId) {
        handle.classList.add("hidden-handle");
    }

    handle.dataset.fieldId = field.id;
    handle.dataset.entryId = entry.id;
    handle.setAttribute("x", gridWidth - handleSize / 2);
    handle.setAttribute("y", gridHeight - handleSize / 2);
    handle.setAttribute("width", handleSize);
    handle.setAttribute("height", handleSize);
    handle.setAttribute("fill", "white");
    handle.setAttribute("stroke", "black");
    handle.setAttribute("stroke-width", 1);
    handle.setAttribute("pointer-events", entry.id === selectedEntryId ? "all" : "none");

    return handle;
}

function redrawCanvas() {
    overlayLayer.innerHTML = "";

    fields.forEach((field) => {
        const gField = createSvgElement("g");

        gField.dataset.id = field.id;

        const fieldHitbox = createFieldHitbox(field);

        if (fieldHitbox) {
            gField.appendChild(fieldHitbox);
        }

        field.entries.forEach((entry) => {
            const numCols = entry.options.length;
            const numRows = entry.num_questions;
            const gEntry = createSvgElement("g");

            gEntry.classList.add("entry-grid");
            gEntry.dataset.fieldId = field.id;
            gEntry.dataset.entryId = entry.id;
            gEntry.setAttribute("transform", `translate(${entry.start_x}, ${entry.start_y})`);

            const entryBox = createEntryResizeBox(field, entry);

            gEntry.appendChild(entryBox);

            for (let rowIdx = 0; rowIdx < numRows; rowIdx++) {
                for (let colIdx = 0; colIdx < numCols; colIdx++) {
                    const gBubble = createBubbleGroup(field, entry, rowIdx, colIdx);

                    gEntry.appendChild(gBubble);
                }
            }

            const entryResizeHandle = createEntryResizeHandle(field, entry);

            gEntry.appendChild(entryResizeHandle);
            gField.appendChild(gEntry);
        });

        overlayLayer.appendChild(gField);
    });

    anchors.forEach((anchor) => {
        const gAnchor = createSvgElement("g");

        gAnchor.classList.add("anchor-item");
        gAnchor.dataset.anchorId = anchor.id;
        gAnchor.style.pointerEvents = "all";
        gAnchor.setAttribute("transform", `translate(${anchor.x}, ${anchor.y})`);

        const rect = createSvgElement("rect");

        rect.classList.add("anchor-rect");
        rect.dataset.anchorId = anchor.id;
        rect.setAttribute("x", 0);
        rect.setAttribute("y", 0);
        rect.setAttribute("width", anchor.width);
        rect.setAttribute("height", anchor.height);
        rect.setAttribute("fill", "rgba(59, 130, 246, 0.08)");
        rect.setAttribute("stroke", anchor.id === selectedAnchorId ? "#2563eb" : "#60a5fa");
        rect.setAttribute("stroke-width", anchor.id === selectedAnchorId ? 2 : 1.5);
        rect.setAttribute("stroke-dasharray", "3 3");
        rect.setAttribute("pointer-events", "all");

        const handleSize = 10;
        const handle = createSvgElement("rect");

        handle.classList.add("anchor-size-handle");
        handle.dataset.anchorId = anchor.id;
        handle.setAttribute("x", anchor.width - handleSize / 2);
        handle.setAttribute("y", anchor.height - handleSize / 2);
        handle.setAttribute("width", handleSize);
        handle.setAttribute("height", handleSize);
        handle.setAttribute("fill", "white");
        handle.setAttribute("stroke", "#2563eb");
        handle.setAttribute("stroke-width", 1);
        handle.setAttribute("pointer-events", "all");

        gAnchor.appendChild(rect);
        gAnchor.appendChild(handle);
        overlayLayer.appendChild(gAnchor);
    });

    setupInteractions();
}

function redrawConfig() {
    const field = getSelectedField();
    const entry = getSelectedEntry();

    if (!field) {
        fieldConfigEmpty.classList.remove("hidden");
        fieldConfigForm.classList.add("hidden");
    } else {
        fieldConfigEmpty.classList.add("hidden");
        fieldConfigForm.classList.remove("hidden");

        fieldNameInput.value = field.name;
        fieldTypeInput.value = field.type;
        bubbleShapeInput.value = field.bubble_shape;
        bubbleWInput.value = formatNumber(field.bubble_w);
        bubbleHInput.value = formatNumber(field.bubble_h);
    }

    if (!entry) {
        entryConfigEmpty.classList.remove("hidden");
        entryConfigForm.classList.add("hidden");
    } else {
        entryConfigEmpty.classList.add("hidden");
        entryConfigForm.classList.remove("hidden");

        entryNameInput.value = entry.name;
        entryStartXInput.value = formatNumber(entry.start_x);
        entryStartYInput.value = formatNumber(entry.start_y);
        numQuestionsInput.value = entry.num_questions;
        optionsInput.value = entry.options.join(",");
        rowSpacingInput.value = formatNumber(entry.row_spacing);
        colSpacingInput.value = formatNumber(entry.col_spacing);
        startQuestionNumInput.value = entry.start_question_num;
        verticalOptionsInput.checked = entry.vertical_options;
    }
}

function selectEntry(entryId) {
    selectedEntryId = entryId;
    selectedFieldId = entryId.split("|")[0];
    selectedAnchorId = null;

    redrawField();
    redrawConfig();
}

function selectField(fieldId) {
    selectedFieldId = fieldId;
    selectedEntryId = null;
    selectedAnchorId = null;

    redrawAll();
}

function updateRenderedEntryPosition(entryId) {
    const entry = getEntryById(entryId);

    if (!entry) {
        return;
    }

    const entryNode = overlayLayer.querySelector(
        `.entry-grid[data-entry-id="${CSS.escape(entryId)}"]`
    );

    if (!entryNode) {
        return;
    }

    entryNode.setAttribute("transform", `translate(${entry.start_x}, ${entry.start_y})`);
}

function updateRenderedBubblePosition(entryId, rowIdx, colIdx, x, y) {
    const bubbleNode = overlayLayer.querySelector(
        `.bubble-item[data-entry-id="${CSS.escape(entryId)}"][data-row-idx="${rowIdx}"][data-col-idx="${colIdx}"]`
    );

    if (!bubbleNode) {
        return;
    }

    bubbleNode.setAttribute("transform", `translate(${x}, ${y})`);
}

function updateRenderedAnchor(anchorId) {
    const anchor = getAnchorById(anchorId);

    if (!anchor) {
        return;
    }

    const anchorNode = overlayLayer.querySelector(
        `.anchor-item[data-anchor-id="${CSS.escape(anchorId)}"]`
    );

    if (!anchorNode) {
        return;
    }

    anchorNode.setAttribute("transform", `translate(${anchor.x}, ${anchor.y})`);

    const rect = anchorNode.querySelector(".anchor-rect");

    if (rect) {
        rect.setAttribute("width", anchor.width);
        rect.setAttribute("height", anchor.height);
        rect.setAttribute("stroke", anchor.id === selectedAnchorId ? "#2563eb" : "#60a5fa");
        rect.setAttribute("stroke-width", anchor.id === selectedAnchorId ? 2 : 1.5);
    }

    const handle = anchorNode.querySelector(".anchor-size-handle");

    if (handle) {
        const handleSize = Number(handle.getAttribute("width"));

        handle.setAttribute("x", anchor.width - handleSize / 2);
        handle.setAttribute("y", anchor.height - handleSize / 2);
    }
}

function updateRenderedFieldBubbleSizes(fieldId) {
    const field = getFieldById(fieldId);

    if (!field) {
        return;
    }

    const shapes = overlayLayer.querySelectorAll(
        `.bubble-shape[data-field-id="${CSS.escape(fieldId)}"]`
    );

    shapes.forEach((shape) => {
        if (field.bubble_shape === "rect") {
            shape.setAttribute("width", field.bubble_w);
            shape.setAttribute("height", field.bubble_h);
        } else if (field.bubble_shape === "ellipse") {
            shape.setAttribute("cx", field.bubble_w / 2);
            shape.setAttribute("cy", field.bubble_h / 2);
            shape.setAttribute("rx", field.bubble_w / 2);
            shape.setAttribute("ry", field.bubble_h / 2);
        }
    });

    const bubbleHandles = overlayLayer.querySelectorAll(
        `.bubble-size-handle[data-field-id="${CSS.escape(fieldId)}"]`
    );

    bubbleHandles.forEach((handle) => {
        const handleSize = Number(handle.getAttribute("width"));

        handle.setAttribute("x", field.bubble_w - handleSize / 2);
        handle.setAttribute("y", field.bubble_h - handleSize / 2);
    });

    field.entries.forEach((entry) => {
        updateRenderedEntryGrid(entry.id);
    });

    updateRenderedFieldHitbox(fieldId);
}

function updateRenderedEntryGrid(entryId) {
    const field = getFieldByEntryId(entryId);
    const entry = getEntryById(entryId);

    if (!field || !entry) {
        return;
    }

    const entryNode = overlayLayer.querySelector(
        `.entry-grid[data-entry-id="${CSS.escape(entryId)}"]`
    );

    if (!entryNode) {
        return;
    }

    const bubbleNodes = entryNode.querySelectorAll(".bubble-item");

    bubbleNodes.forEach((bubbleNode) => {
        const rowIdx = Number(bubbleNode.dataset.rowIdx);
        const colIdx = Number(bubbleNode.dataset.colIdx);
        const position = getBubblePosition(entry, rowIdx, colIdx);

        bubbleNode.setAttribute(
            "transform",
            `translate(${position.x}, ${position.y})`
        );
    });

    const box = entryNode.querySelector(".entry-grid-box");

    if (box) {
        box.setAttribute("width", getGridWidth(field, entry));
        box.setAttribute("height", getGridHeight(field, entry));
    }

    const handle = entryNode.querySelector(".entry-grid-size-handle");

    if (handle) {
        const handleSize = Number(handle.getAttribute("width"));
        const gridWidth = getGridWidth(field, entry);
        const gridHeight = getGridHeight(field, entry);

        handle.setAttribute("x", gridWidth - handleSize / 2);
        handle.setAttribute("y", gridHeight - handleSize / 2);
    }

    updateRenderedFieldHitbox(field.id);
}

function applyEntrySpacingFromGridResize(field, entry, newGridWidth, newGridHeight) {
    if (entry.vertical_options) {
        const numQuestions = entry.num_questions;
        const numOptions = entry.options.length;

        if (numQuestions > 1) {
            const newColSpacing = (newGridWidth - field.bubble_w) / (numQuestions - 1);

            entry.col_spacing = Math.max(field.bubble_w + 1, newColSpacing);
        }

        if (numOptions > 1) {
            const newRowSpacing = (newGridHeight - field.bubble_h) / (numOptions - 1);

            entry.row_spacing = Math.max(field.bubble_h + 1, newRowSpacing);
        }

        return;
    }

    const numCols = entry.options.length;
    const numRows = entry.num_questions;

    if (numCols > 1) {
        const newColSpacing = (newGridWidth - field.bubble_w) / (numCols - 1);

        entry.col_spacing = Math.max(field.bubble_w + 1, newColSpacing);
    }

    if (numRows > 1) {
        const newRowSpacing = (newGridHeight - field.bubble_h) / (numRows - 1);

        entry.row_spacing = Math.max(field.bubble_h + 1, newRowSpacing);
    }
}

function moveFieldBy(fieldId, dx, dy) {
    const field = getFieldById(fieldId);

    if (!field) {
        return;
    }

    field.entries.forEach((entry) => {
        entry.start_x += dx;
        entry.start_y += dy;

        updateRenderedEntryPosition(entry.id);
    });

    updateRenderedFieldHitbox(fieldId);
}

function setupInteractions() {
    interact(".field-hitbox").unset();
    interact(".entry-grid").unset();
    interact(".bubble-item").unset();
    interact(".bubble-size-handle").unset();
    interact(".entry-grid-size-handle").unset();
    interact(".anchor-item").unset();
    interact(".anchor-rect").unset();
    interact(".anchor-size-handle").unset();

    interact(".field-hitbox").draggable({
        listeners: {
            start(event) {
                const fieldId = event.target.dataset.fieldId;

                selectedFieldId = fieldId;
                selectedEntryId = null;
                selectedAnchorId = null;

                redrawAll();
            },

            move(event) {
                const fieldId = event.target.dataset.fieldId;
                const delta = getSvgDeltaFromInteractEvent(event);

                moveFieldBy(fieldId, delta.dx, delta.dy);
                scheduleRedrawConfig();
            },

            end() {
                redrawCanvas();
                redrawConfig();
            }
        }
    });

    interact(".entry-grid").draggable({
        ignoreFrom: ".bubble-item, .bubble-size-handle, .entry-grid-size-handle",

        listeners: {
            start(event) {
                const entryId = event.target.dataset.entryId;

                selectEntry(entryId);
            },

            move(event) {
                const entryId = event.target.dataset.entryId;
                const entry = getEntryById(entryId);

                if (!entry) {
                    return;
                }

                const delta = getSvgDeltaFromInteractEvent(event);

                entry.start_x += delta.dx;
                entry.start_y += delta.dy;

                updateRenderedEntryPosition(entryId);
                updateRenderedFieldHitbox(entry.id.split("|")[0]);
                scheduleRedrawConfig();
            },

            end() {
                redrawCanvas();
                redrawConfig();
            }
        }
    });

    interact(".bubble-item").draggable({
        ignoreFrom: ".bubble-size-handle",

        listeners: {
            start(event) {
                const entryId = event.target.dataset.entryId;

                selectEntry(entryId);
            },

            move(event) {
                const entryId = event.target.dataset.entryId;
                const rowIdx = Number(event.target.dataset.rowIdx);
                const colIdx = Number(event.target.dataset.colIdx);
                const entry = getEntryById(entryId);

                if (!entry) {
                    return;
                }

                const defaultPosition = getBubbleDefaultPosition(entry, rowIdx, colIdx);
                const currentPosition = getBubblePosition(entry, rowIdx, colIdx);
                const override = getOrCreateOverride(
                    entry,
                    rowIdx,
                    colIdx,
                    defaultPosition.x,
                    defaultPosition.y
                );

                const delta = getSvgDeltaFromInteractEvent(event);

                override.x = currentPosition.x + delta.dx;
                override.y = currentPosition.y + delta.dy;

                updateRenderedBubblePosition(entryId, rowIdx, colIdx, override.x, override.y);
            },

            end() {
                redrawCanvas();
            }
        }
    });

    interact(".bubble-size-handle").draggable({
        listeners: {
            start(event) {
                document.body.classList.add("is-resizing");

                const entryId = event.target.dataset.entryId;

                selectEntry(entryId);
            },

            move(event) {
                const fieldId = event.target.dataset.fieldId;
                const field = getFieldById(fieldId);

                if (!field) {
                    return;
                }

                const delta = getSvgDeltaFromInteractEvent(event);

                field.bubble_w = Math.max(MIN_BUBBLE_W, field.bubble_w + delta.dx);
                field.bubble_h = Math.max(MIN_BUBBLE_H, field.bubble_h + delta.dy);

                updateEditorDefaultsFromField(field);
                updateRenderedFieldBubbleSizes(fieldId);
                scheduleRedrawConfig();
            },

            end() {
                document.body.classList.remove("is-resizing");

                redrawCanvas();
                redrawConfig();
            }
        }
    });

    interact(".entry-grid-size-handle").draggable({
        listeners: {
            start(event) {
                document.body.classList.add("is-resizing");

                const entryId = event.target.dataset.entryId;

                selectEntry(entryId);
            },

            move(event) {
                const entryId = event.target.dataset.entryId;
                const field = getFieldByEntryId(entryId);
                const entry = getEntryById(entryId);

                if (!field || !entry) {
                    return;
                }

                const delta = getSvgDeltaFromInteractEvent(event);

                const currentGridWidth = getGridWidth(field, entry);
                const currentGridHeight = getGridHeight(field, entry);

                const newGridWidth = Math.max(MIN_GRID_W, currentGridWidth + delta.dx);
                const newGridHeight = Math.max(MIN_GRID_H, currentGridHeight + delta.dy);

                applyEntrySpacingFromGridResize(field, entry, newGridWidth, newGridHeight);
                updateEditorDefaultsFromEntry(entry);
                updateRenderedEntryGrid(entryId);
                scheduleRedrawConfig();
            },

            end() {
                document.body.classList.remove("is-resizing");

                redrawCanvas();
                redrawConfig();
            }
        }
    });

    interact(".anchor-item").draggable({
        ignoreFrom: ".anchor-size-handle",

        listeners: {
            start(event) {
                const anchorNode = event.target.closest(".anchor-item");

                if (!anchorNode) {
                    return;
                }

                selectedAnchorId = anchorNode.dataset.anchorId;
                selectedFieldId = null;
                selectedEntryId = null;

                redrawField();
                redrawConfig();

                const rect = anchorNode.querySelector(".anchor-rect");

                if (rect) {
                    rect.setAttribute("stroke", "#2563eb");
                    rect.setAttribute("stroke-width", 2);
                }
            },

            move(event) {
                const anchorNode = event.target.closest(".anchor-item");

                if (!anchorNode) {
                    return;
                }

                const anchorId = anchorNode.dataset.anchorId;
                const anchor = getAnchorById(anchorId);

                if (!anchor) {
                    return;
                }

                const delta = getSvgDeltaFromInteractEvent(event);

                anchor.x += delta.dx;
                anchor.y += delta.dy;

                updateRenderedAnchor(anchorId);
            },

            end() {
                redrawCanvas();
                redrawConfig();
            }
        }
    });

    interact(".anchor-size-handle").draggable({
        listeners: {
            start(event) {
                document.body.classList.add("is-resizing");

                selectedAnchorId = event.target.dataset.anchorId;
                selectedFieldId = null;
                selectedEntryId = null;

                redrawField();
                redrawConfig();
            },

            move(event) {
                const anchorId = event.target.dataset.anchorId;
                const anchor = getAnchorById(anchorId);

                if (!anchor) {
                    return;
                }

                const delta = getSvgDeltaFromInteractEvent(event);

                anchor.width = Math.max(20, anchor.width + delta.dx);
                anchor.height = Math.max(20, anchor.height + delta.dy);

                updateRenderedAnchor(anchorId);
            },

            end() {
                document.body.classList.remove("is-resizing");

                redrawCanvas();
                redrawConfig();
            }
        }
    });
}

// Config listeners
fieldNameInput.addEventListener("input", () => {
    const field = getSelectedField();

    if (!field) {
        return;
    }

    field.name = fieldNameInput.value;

    redrawField();
});

fieldTypeInput.addEventListener("change", () => {
    const field = getSelectedField();

    if (!field) {
        return;
    }

    field.type = fieldTypeInput.value;
});

bubbleShapeInput.addEventListener("change", () => {
    const field = getSelectedField();

    if (!field) {
        return;
    }

    field.bubble_shape = bubbleShapeInput.value;

    updateEditorDefaultsFromField(field);
    redrawCanvas();
});

bubbleWInput.addEventListener("input", () => {
    const field = getSelectedField();

    if (!field) {
        return;
    }

    field.bubble_w = Math.max(MIN_BUBBLE_W, Number(bubbleWInput.value) || MIN_BUBBLE_W);

    updateEditorDefaultsFromField(field);
    redrawCanvas();
});

bubbleHInput.addEventListener("input", () => {
    const field = getSelectedField();

    if (!field) {
        return;
    }

    field.bubble_h = Math.max(MIN_BUBBLE_H, Number(bubbleHInput.value) || MIN_BUBBLE_H);

    updateEditorDefaultsFromField(field);
    redrawCanvas();
});

entryNameInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.name = entryNameInput.value;

    redrawField();
});

entryStartXInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.start_x = Number(entryStartXInput.value) || 0;

    redrawCanvas();
});

entryStartYInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.start_y = Number(entryStartYInput.value) || 0;

    redrawCanvas();
});

numQuestionsInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.num_questions = Math.max(1, Number(numQuestionsInput.value) || 1);

    entry.overrides = entry.overrides.filter((override) => {
        return override.row_idx < entry.num_questions;
    });

    updateEditorDefaultsFromEntry(entry);
    redrawCanvas();
});

optionsInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    const options = parseOptions(optionsInput.value);

    entry.options = options.length > 0 ? options : ["A"];

    entry.overrides = entry.overrides.filter((override) => {
        return override.col_idx < entry.options.length;
    });

    updateEditorDefaultsFromEntry(entry);
    redrawCanvas();
});

rowSpacingInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.row_spacing = Math.max(1, Number(rowSpacingInput.value) || 1);

    updateEditorDefaultsFromEntry(entry);
    redrawCanvas();
});

colSpacingInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.col_spacing = Math.max(1, Number(colSpacingInput.value) || 1);

    updateEditorDefaultsFromEntry(entry);
    redrawCanvas();
});

startQuestionNumInput.addEventListener("input", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.start_question_num = Math.max(1, Number(startQuestionNumInput.value) || 1);
});

verticalOptionsInput.addEventListener("change", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.vertical_options = verticalOptionsInput.checked;

    updateEditorDefaultsFromEntry(entry);
    redrawCanvas();
});

clearOverridesButton.addEventListener("click", () => {
    const entry = getSelectedEntry();

    if (!entry) {
        return;
    }

    entry.overrides = [];

    redrawCanvas();
});

// Defaults panel
if (useSelectedAsDefaultButton) {
    useSelectedAsDefaultButton.addEventListener("click", () => {
        useSelectedAsDefault();
    });
}

if (resetDefaultsButton) {
    resetDefaultsButton.addEventListener("click", () => {
        resetEditorDefaults();
    });
}

// Canvas click selection
overlayLayer.addEventListener("click", (event) => {
    if (didPanCanvas) {
        didPanCanvas = false;
        return;
    }

    const entryGrid = event.target.closest(".entry-grid");

    if (entryGrid) {
        selectedFieldId = entryGrid.dataset.fieldId;
        selectedEntryId = entryGrid.dataset.entryId;
        selectedAnchorId = null;

        redrawAll();
        return;
    }

    const anchorItem = event.target.closest(".anchor-item");

    if (anchorItem) {
        selectedAnchorId = anchorItem.dataset.anchorId;
        selectedFieldId = null;
        selectedEntryId = null;

        redrawAll();
        return;
    }

    const fieldHitbox = event.target.closest(".field-hitbox");

    if (fieldHitbox) {
        selectedFieldId = fieldHitbox.dataset.fieldId;
        selectedEntryId = null;
        selectedAnchorId = null;

        redrawAll();
        return;
    }

    selectedFieldId = null;
    selectedEntryId = null;
    selectedAnchorId = null;

    redrawAll();
});

svg.addEventListener("click", (event) => {
    if (event.target !== svg && event.target !== overlayLayer) {
        return;
    }

    if (didPanCanvas) {
        didPanCanvas = false;
        return;
    }

    selectedFieldId = null;
    selectedEntryId = null;
    selectedAnchorId = null;

    redrawAll();
});

// Sidebar list
fieldList.addEventListener("click", (event) => {
    const item = event.target.closest(".list-item");

    if (!item || !fieldList.contains(item)) {
        return;
    }

    const targetId = item.dataset.id;
    const isEntry = targetId.includes("|");

    selectedAnchorId = null;

    if (isEntry) {
        const parentFieldId = targetId.split("|")[0];

        if (selectedEntryId === targetId) {
            selectedEntryId = null;
            selectedFieldId = parentFieldId;
        } else {
            selectedEntryId = targetId;
            selectedFieldId = parentFieldId;
        }
    } else {
        if (selectedFieldId === targetId && selectedEntryId === null) {
            selectedFieldId = null;
            selectedEntryId = null;
        } else {
            selectedFieldId = targetId;
            selectedEntryId = null;
        }
    }

    redrawAll();
});

// Main buttons
addFieldButton.addEventListener("click", () => {
    const field = newField();

    fields.push(field);

    selectedFieldId = field.id;
    selectedEntryId = null;
    selectedAnchorId = null;

    redrawAll();
});

addEntryButton.addEventListener("click", () => {
    if (!selectedFieldId) {
        return;
    }

    const field = getFieldById(selectedFieldId);

    if (!field) {
        return;
    }

    const entry = newEntry(selectedFieldId);

    if (!entry) {
        return;
    }

    field.entries.push(entry);

    selectedEntryId = entry.id;
    selectedAnchorId = null;

    redrawAll();
});

duplicateButton.addEventListener("click", () => {
    if (selectedEntryId) {
        const field = getFieldByEntryId(selectedEntryId);
        const entry = getEntryById(selectedEntryId);

        if (!field || !entry) {
            return;
        }

        const clonedEntry = cloneEntry(entry, field.id);

        field.entries.push(clonedEntry);

        selectedFieldId = field.id;
        selectedEntryId = clonedEntry.id;
        selectedAnchorId = null;

        redrawAll();
        return;
    }

    if (selectedFieldId) {
        const field = getFieldById(selectedFieldId);

        if (!field) {
            return;
        }

        const clonedField = cloneField(field);

        fields.push(clonedField);

        selectedFieldId = clonedField.id;
        selectedEntryId = null;
        selectedAnchorId = null;

        redrawAll();
    }
});

deleteButton.addEventListener("click", () => {
    if (selectedAnchorId) {
        anchors = anchors.filter((anchor) => anchor.id !== selectedAnchorId);

        selectedAnchorId = null;

        redrawAll();
        return;
    }

    if (selectedEntryId) {
        const parentFieldId = selectedEntryId.split("|")[0];
        const field = getFieldById(parentFieldId);

        if (!field) {
            return;
        }

        field.entries = field.entries.filter((entry) => entry.id !== selectedEntryId);

        selectedEntryId = null;
        selectedFieldId = parentFieldId;

        redrawAll();
        return;
    }

    if (selectedFieldId) {
        fields = fields.filter((field) => field.id !== selectedFieldId);

        selectedFieldId = null;
        selectedEntryId = null;

        redrawAll();
    }
});

addAnchorButton.addEventListener("click", () => {
    const anchor = newAnchor();

    anchors.push(anchor);

    selectedAnchorId = anchor.id;
    selectedFieldId = null;
    selectedEntryId = null;

    redrawAll();
});

// Export / import
exportBlueprintButton.addEventListener("click", () => {
    const blueprint = buildBlueprintJson();
    const name = templateNameInput.value || "blueprint";

    downloadJson(`${name}_blueprint.json`, blueprint);
});

exportTemplateButton.addEventListener("click", () => {
    const template = buildTemplateJson();
    const name = templateNameInput.value || "template";

    downloadJson(`${name}_template.json`, template);
});

importBlueprintInput.addEventListener("change", async (event) => {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const text = await file.text();
    const blueprint = JSON.parse(text);

    templateNameInput.value = blueprint.name || "Untitled";

    fields = blueprint.fields || [];
    anchors = blueprint.anchor || [];

    fields.forEach((field) => {
        field.bubble_shape = denormalizeShapeFromTemplate(field.bubble_shape);

        if (!field.type) {
            field.type = "answers";
        }

        if (!field.bubble_shape) {
            field.bubble_shape = "rect";
        }

        if (!field.bubble_w) {
            field.bubble_w = 20;
        }

        if (!field.bubble_h) {
            field.bubble_h = 20;
        }

        field.entries.forEach((entry, index) => {
            if (!entry.name) {
                entry.name = `Entry ${index + 1}`;
            }

            if (!entry.overrides) {
                entry.overrides = [];
            }

            if (!entry.options) {
                entry.options = ["A", "B", "C", "D"];
            }

            if (entry.start_question_num === undefined) {
                entry.start_question_num = 1;
            }

            if (entry.vertical_options === undefined) {
                entry.vertical_options = false;
            }

            if (entry.num_questions === undefined) {
                entry.num_questions = 4;
            }

            if (entry.row_spacing === undefined) {
                entry.row_spacing = 40;
            }

            if (entry.col_spacing === undefined) {
                entry.col_spacing = 40;
            }
        });
    });

    selectedFieldId = null;
    selectedEntryId = null;
    selectedAnchorId = null;

    redrawAll();

    importBlueprintInput.value = "";
});

// Image loading
uploadImageInput.addEventListener("change", (event) => {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const imageUrl = URL.createObjectURL(file);

    svgImage.setAttribute("href", imageUrl);
    svgImage.setAttribute("width", WIDTH);
    svgImage.setAttribute("height", HEIGHT);

    svg.setAttribute("viewBox", `0 0 ${WIDTH} ${HEIGHT}`);
    svg.setAttribute("width", WIDTH);
    svg.setAttribute("height", HEIGHT);
});

// Zoom
zoomOutButton.addEventListener("click", () => {
    zoom = Math.max(0.1, zoom - 0.1);

    applyZoom();
});

zoomResetButton.addEventListener("click", () => {
    zoom = 1;

    applyZoom();
});

zoomInButton.addEventListener("click", () => {
    zoom = Math.min(5, zoom + 0.1);

    applyZoom();
});

canvasWrap.addEventListener("wheel", (event) => {
    if (!event.ctrlKey && !event.metaKey) {
        return;
    }

    event.preventDefault();

    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;

    zoom = Math.min(5, Math.max(0.1, zoom * zoomFactor));

    applyZoom();
}, { passive: false });

// Keyboard movement
function moveSelectedBy(dx, dy) {
    if (selectedEntryId) {
        const entry = getEntryById(selectedEntryId);

        if (!entry) {
            return;
        }

        entry.start_x += dx;
        entry.start_y += dy;

        updateRenderedEntryPosition(entry.id);
        updateRenderedFieldHitbox(entry.id.split("|")[0]);
        redrawConfig();
        return;
    }

    if (selectedFieldId) {
        moveFieldBy(selectedFieldId, dx, dy);
        redrawConfig();
        return;
    }

    if (selectedAnchorId) {
        const anchor = getAnchorById(selectedAnchorId);

        if (!anchor) {
            return;
        }

        anchor.x += dx;
        anchor.y += dy;

        updateRenderedAnchor(anchor.id);
    }
}

window.addEventListener("keydown", (event) => {
    const activeElement = document.activeElement;
    const isTyping =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

    if (isTyping) {
        return;
    }

    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

    if (!arrowKeys.includes(event.key)) {
        return;
    }

    if (!selectedFieldId && !selectedEntryId && !selectedAnchorId) {
        return;
    }

    event.preventDefault();

    const step = event.shiftKey ? 10 : 1;

    if (event.key === "ArrowUp") {
        moveSelectedBy(0, -step);
    } else if (event.key === "ArrowDown") {
        moveSelectedBy(0, step);
    } else if (event.key === "ArrowLeft") {
        moveSelectedBy(-step, 0);
    } else if (event.key === "ArrowRight") {
        moveSelectedBy(step, 0);
    }
});

window.addEventListener("keyup", (event) => {
    const arrowKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

    if (!arrowKeys.includes(event.key)) {
        return;
    }

    if (!selectedFieldId && !selectedEntryId && !selectedAnchorId) {
        return;
    }

    redrawCanvas();
    redrawConfig();
});

// Canvas panning
canvasWrap.addEventListener("pointerdown", (event) => {
    const clickedInteractiveItem = event.target.closest(
        ".field-hitbox, .entry-grid, .bubble-item, .bubble-size-handle, .entry-grid-size-handle, .anchor-item, .anchor-rect, .anchor-size-handle"
    );

    if (clickedInteractiveItem) {
        return;
    }

    isPanningCanvas = true;
    didPanCanvas = false;

    panStartClientX = event.clientX;
    panStartClientY = event.clientY;
    panStartScrollLeft = canvasWrap.scrollLeft;
    panStartScrollTop = canvasWrap.scrollTop;

    canvasWrap.classList.add("is-panning");

    event.preventDefault();
});

window.addEventListener("pointermove", (event) => {
    if (!isPanningCanvas) {
        return;
    }

    const dx = event.clientX - panStartClientX;
    const dy = event.clientY - panStartClientY;

    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        didPanCanvas = true;
    }

    canvasWrap.scrollLeft = panStartScrollLeft - dx;
    canvasWrap.scrollTop = panStartScrollTop - dy;
});

window.addEventListener("pointerup", () => {
    if (!isPanningCanvas) {
        return;
    }

    isPanningCanvas = false;
    canvasWrap.classList.remove("is-panning");
});

// Safety cleanup
window.addEventListener("mouseup", () => {
    document.body.classList.remove("is-resizing");
});

window.addEventListener("blur", () => {
    document.body.classList.remove("is-resizing");
    isPanningCanvas = false;
    canvasWrap.classList.remove("is-panning");
});

applyZoom();
redrawAll();
redrawDefaultsSummary();