/* ============================================================
 *  PICO / CEL-FI QUATRA — Application principale
 *  IPKONEKT / Bouygues Telecom
 * ============================================================ */

// ---- Stockage photos en mémoire (clé → { dataUrl, annotated, ... }) ----
const photoStore = {};

// ---- Compteurs pour clés dynamiques ----
let measureCounter = 0;
let picoPoseCounter = 0;
let picoPhotoCounter = 0;
let quatraPhotoCounter = 0;
let evacPointCounter = 0;
const evacPoints = []; // {id, label, xPct, yPct}

// =============================================================
//  MODE AUDIT / TRAVAUX
// =============================================================
function getMode() {
    const el = document.getElementById("modeIntervention");
    return (el && el.value === "travaux") ? "travaux" : "audit";
}
function setMode(mode) {
    const hidden = document.getElementById("modeIntervention");
    if (hidden) hidden.value = (mode === "travaux") ? "travaux" : "audit";
    const ba = document.getElementById("modeAuditBtn");
    const bt = document.getElementById("modeTravauxBtn");
    if (ba && bt) {
        ba.classList.toggle("active", mode === "audit");
        bt.classList.toggle("active", mode === "travaux");
    }
}
window.setMode = setMode;
window.getMode = getMode;

// =============================================================
//  STATUS BAR
// =============================================================
function showStatus(msg, type) {
    const s = document.getElementById("status");
    s.textContent = msg;
    s.className = type || "info";
    setTimeout(() => { s.className = ""; s.textContent = ""; }, 5000);
}

// =============================================================
//  INITIALISATION AU CHARGEMENT
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    renderQualiteGrid();
    renderForfaits("Pico");
    renderForfaits("Quatra");
    renderFournitures();
    addMeasureRow(); // une ligne par défaut
    addPicoPose();
    setupPicoPhotoBlocks();
    setupQuatraPhotoBlocks();
    setupEvacUpload();
    updateSectionState();

    // Date d'aujourd'hui par défaut
    const today = new Date().toISOString().slice(0, 10);
    const dateAudit = document.getElementById("date_audit");
    if (dateAudit && !dateAudit.value) dateAudit.value = today;

    document.body.addEventListener("click", handleGlobalClick);
    console.log("✅ PICO / Quatra — formulaire chargé");
});

// =============================================================
//  GRILLE DE QUALITÉ RADIO
// =============================================================
function renderQualiteGrid() {
    const grid = document.getElementById("qualiteGrid");
    if (!grid || !window.QUALITE_RSRP) return;
    grid.innerHTML = "";
    window.QUALITE_RSRP.forEach(q => {
        const div = document.createElement("div");
        div.className = "qualite-item";
        div.style.background = q.color;
        div.innerHTML = `<span class="label">${q.label}</span><span class="seuil">${q.seuil}</span>`;
        grid.appendChild(div);
    });
}

// =============================================================
//  SECTIONS DÉPLIANTES
// =============================================================
function toggleSection(name) {
    const section = document.getElementById("section" + name);
    if (!section) return;
    // Empêcher le toggle si on clique sur la checkbox d'activation
    section.classList.toggle("collapsed");
}
window.toggleSection = toggleSection;

function updateSectionState() {
    const picoActive = document.getElementById("activePico").checked;
    const quatraActive = document.getElementById("activeQuatra").checked;

    const secPico = document.getElementById("sectionPico");
    const secQuatra = document.getElementById("sectionQuatra");

    secPico.classList.toggle("active-pico", picoActive);
    secQuatra.classList.toggle("active-quatra", quatraActive);

    document.getElementById("picoBadge").textContent = picoActive ? "✓ Activée" : "Non activée";
    document.getElementById("quatraBadge").textContent = quatraActive ? "✓ Activée" : "Non activée";
}
window.updateSectionState = updateSectionState;

// =============================================================
//  FORFAITS (PICO ou QUATRA)
// =============================================================
function renderForfaits(type) {
    const container = document.getElementById((type === "Pico" ? "pico" : "quatra") + "ForfaitList");
    const data = (type === "Pico") ? window.PICO_FORFAITS : window.QUATRA_FORFAITS;
    if (!container || !data) return;

    container.innerHTML = "";
    const groupName = "forfait_" + type.toLowerCase();
    data.forEach(f => {
        const lbl = document.createElement("label");
        lbl.className = "forfait-card";
        lbl.dataset.ref = f.ref;
        lbl.innerHTML = `
            <input type="radio" name="${groupName}" value="${f.ref}">
            <div class="ref">${f.ref}</div>
            <div class="name">${f.label}</div>
            <div class="desc">${f.description}</div>
            <div class="crit">${f.critere}</div>
        `;
        const radio = lbl.querySelector("input[type='radio']");
        radio.addEventListener("change", () => {
            // Désélectionner les autres cartes du même groupe
            container.querySelectorAll(".forfait-card").forEach(c => c.classList.remove("selected"));
            if (radio.checked) lbl.classList.add("selected");
        });
        container.appendChild(lbl);
    });
}

// =============================================================
//  MESURES RADIO
// =============================================================
function addMeasureRow() {
    measureCounter++;
    const id = "m_" + measureCounter;
    const tr = document.createElement("tr");
    tr.dataset.measureId = id;
    tr.innerHTML = `
        <td><input type="text" id="${id}_zone" placeholder="Ex : Foyer, Bureau..."></td>
        <td><input type="text" id="${id}_4g" placeholder="-110/-8/20"></td>
        <td><input type="text" id="${id}_5g" placeholder="-112/-10/28"></td>
        <td><input type="text" id="${id}_dn" placeholder="37"></td>
        <td><input type="text" id="${id}_up" placeholder="0.4"></td>
        <td><button type="button" class="row-del" onclick="removeMeasureRow('${id}')">✕</button></td>
    `;
    document.getElementById("measuresBody").appendChild(tr);
}
window.addMeasureRow = addMeasureRow;
function removeMeasureRow(id) {
    const tr = document.querySelector(`tr[data-measure-id="${id}"]`);
    if (tr) tr.remove();
}
window.removeMeasureRow = removeMeasureRow;

// =============================================================
//  PICO POSÉS
// =============================================================
function addPicoPose() {
    picoPoseCounter++;
    const id = "pp_" + picoPoseCounter;
    const div = document.createElement("div");
    div.className = "pico-item";
    div.dataset.picoId = id;
    div.innerHTML = `
        <div class="num">PICO ${picoPoseCounter}</div>
        <input type="text" id="${id}_zone" placeholder="Zone / pièce (ex : Foyer, Studio 1...)">
        <input type="text" id="${id}_note" placeholder="Note (ex : fixation au plafond, antenne intégrée...)">
        <button type="button" class="row-del" onclick="removePicoPose('${id}')">✕ Supprimer</button>
    `;
    document.getElementById("picoPosesList").appendChild(div);
}
window.addPicoPose = addPicoPose;
function removePicoPose(id) {
    const div = document.querySelector(`[data-pico-id="${id}"]`);
    if (div) div.remove();
}
window.removePicoPose = removePicoPose;

// =============================================================
//  PHOTOS PICO & QUATRA (blocs dynamiques)
// =============================================================
const PICO_PHOTO_PRESETS = [
    "Vue de la baie informatique",
    "Emplacement PICO 1",
    "Emplacement PICO 2",
    "Cheminement câbles",
    "Point de pénétration / percement"
];
function setupPicoPhotoBlocks() {
    PICO_PHOTO_PRESETS.forEach(label => addPicoPhotoBlock(label));
}
function addPicoPhotoBlock(presetLabel) {
    picoPhotoCounter++;
    const key = "pico_photo_" + picoPhotoCounter;
    const block = createPhotoBlock(key, presetLabel || ("Photo PICO " + picoPhotoCounter), true);
    document.getElementById("picoPhotoGrid").appendChild(block);
}
window.addPicoPhotoBlock = addPicoPhotoBlock;

const QUATRA_PHOTO_PRESETS = [
    "NU (unité réseau)",
    "CU (unité de couverture)",
    "Cheminement câble RJ45",
    "Baie informatique"
];
function setupQuatraPhotoBlocks() {
    QUATRA_PHOTO_PRESETS.forEach(label => addQuatraPhotoBlock(label));
}
function addQuatraPhotoBlock(presetLabel) {
    quatraPhotoCounter++;
    const key = "quatra_photo_" + quatraPhotoCounter;
    const block = createPhotoBlock(key, presetLabel || ("Photo Quatra " + quatraPhotoCounter), true);
    document.getElementById("quatraPhotoGrid").appendChild(block);
}
window.addQuatraPhotoBlock = addQuatraPhotoBlock;

function createPhotoBlock(key, defaultLabel, removable) {
    const block = document.createElement("div");
    block.className = "photo-block";
    block.dataset.photoKey = key;
    block.innerHTML = `
        <input type="text" class="photo-label-input" data-photo-label-for="${key}"
               value="${escapeHtml(defaultLabel)}"
               placeholder="Libellé de la photo"
               style="width:100%; margin-bottom:8px; padding:8px; border:1px solid #cfdce9; border-radius:4px; font-size:0.88rem;">
        <input type="file" accept="image/*" data-photo-input="${key}">
        <img class="photo-preview" id="preview_${key}" alt="">
        <div class="photo-actions">
            <button type="button" class="annotate-btn" data-annotate="${key}" disabled>✏ Annoter</button>
            <button type="button" class="clear-photo" data-clear="${key}">✕ Effacer</button>
            ${removable ? `<button type="button" class="clear-photo" data-remove-block="${key}" style="background:#6c757d;">🗑 Supprimer le bloc</button>` : ""}
        </div>
    `;

    // Listener pour upload
    const fileInput = block.querySelector('input[type="file"]');
    fileInput.addEventListener("change", (e) => handlePhotoUpload(key, e.target.files[0]));

    return block;
}

function escapeHtml(str) {
    if (!str) return "";
    return String(str).replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
}

async function handlePhotoUpload(key, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
        showStatus("Veuillez choisir une image.", "error");
        return;
    }
    try {
        const dataUrl = await fileToDataUrl(file);
        photoStore[key] = {
            dataUrl: dataUrl,
            originalDataUrl: dataUrl,
            annotated: false,
            type: file.type.includes("png") ? "png" : "jpg",
            name: file.name
        };
        const preview = document.getElementById("preview_" + key);
        if (preview) {
            preview.src = dataUrl;
            preview.classList.add("shown");
        }
        const annBtn = document.querySelector(`[data-annotate="${key}"]`);
        if (annBtn) annBtn.disabled = false;
    } catch (err) {
        console.error(err);
        showStatus("Erreur de lecture de l'image", "error");
    }
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
    });
}

// =============================================================
//  CLIC GLOBAL (Annoter / Effacer / Supprimer bloc)
// =============================================================
function handleGlobalClick(e) {
    const annBtn = e.target.closest("[data-annotate]");
    if (annBtn) {
        const key = annBtn.dataset.annotate;
        if (!photoStore[key]) {
            showStatus("Importez d'abord une photo.", "error");
            return;
        }
        if (typeof window.Editor !== 'undefined' && window.Editor.open) {
            const labelInput = document.querySelector(`[data-photo-label-for="${key}"]`);
            const label = labelInput ? labelInput.value : "Photo";
            window.Editor.open(key, label);
        } else {
            showStatus("L'éditeur n'est pas chargé.", "error");
        }
        return;
    }

    const clearBtn = e.target.closest("[data-clear]");
    if (clearBtn) {
        const key = clearBtn.dataset.clear;
        delete photoStore[key];
        const preview = document.getElementById("preview_" + key);
        if (preview) {
            preview.src = "";
            preview.classList.remove("shown");
        }
        const ann = document.querySelector(`[data-annotate="${key}"]`);
        if (ann) ann.disabled = true;
        const fileInput = document.querySelector(`[data-photo-input="${key}"]`);
        if (fileInput) fileInput.value = "";
        return;
    }

    const removeBlockBtn = e.target.closest("[data-remove-block]");
    if (removeBlockBtn) {
        const key = removeBlockBtn.dataset.removeBlock;
        delete photoStore[key];
        const block = removeBlockBtn.closest(".photo-block");
        if (block) block.remove();
        return;
    }
}

// =============================================================
//  PLAN D'ÉVACUATION
// =============================================================
function setupEvacUpload() {
    const area = document.getElementById("evacUploadArea");
    const input = document.getElementById("evacInput");
    if (!area || !input) return;

    area.addEventListener("click", () => input.click());
    input.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const dataUrl = await fileToDataUrl(file);
            photoStore["plan_evac"] = {
                dataUrl: dataUrl,
                originalDataUrl: dataUrl,
                annotated: false,
                type: file.type.includes("png") ? "png" : "jpg",
                name: file.name
            };
            const img = document.getElementById("planEvacImg");
            img.src = dataUrl;
            document.getElementById("planEvacContainer").classList.add("shown");
            document.getElementById("evacAddControls").style.display = "flex";
            area.style.display = "none";
        } catch (err) {
            console.error(err);
        }
    });
}

let placePointArmed = false;
function armPlacePoint() {
    const labelInput = document.getElementById("evacLabel");
    const label = (labelInput.value || "").trim();
    if (!label) {
        showStatus("Entrez d'abord un libellé pour le point.", "error");
        return;
    }
    placePointArmed = true;
    showStatus("👆 Cliquez maintenant sur le plan à l'emplacement souhaité.", "info");
    const container = document.getElementById("planEvacContainer");
    container.style.cursor = "crosshair";

    const onClick = (e) => {
        if (!placePointArmed) return;
        const rect = container.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width) * 100;
        const yPct = ((e.clientY - rect.top) / rect.height) * 100;
        addEvacPoint(label, xPct, yPct);
        placePointArmed = false;
        container.style.cursor = "";
        labelInput.value = "";
        container.removeEventListener("click", onClick);
    };
    container.addEventListener("click", onClick, { once: false });
}
window.armPlacePoint = armPlacePoint;

function addEvacPoint(label, xPct, yPct) {
    evacPointCounter++;
    const id = "ep_" + evacPointCounter;
    const point = { id, label, xPct, yPct };
    evacPoints.push(point);
    renderEvacPoint(point);
}

function renderEvacPoint(point) {
    const container = document.getElementById("planEvacContainer");
    const div = document.createElement("div");
    div.className = "evac-point";
    div.dataset.evacId = point.id;
    div.style.left = point.xPct + "%";
    div.style.top = point.yPct + "%";
    div.innerHTML = `${escapeHtml(point.label)}<span class="evac-del" data-evac-del="${point.id}">✕</span>`;
    container.appendChild(div);
    makeEvacPointDraggable(div, point);

    div.querySelector(".evac-del").addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = evacPoints.findIndex(p => p.id === point.id);
        if (idx >= 0) evacPoints.splice(idx, 1);
        div.remove();
    });
}

function makeEvacPointDraggable(div, point) {
    let dragging = false;
    let startX = 0, startY = 0, startXPct = 0, startYPct = 0;
    div.addEventListener("pointerdown", (e) => {
        if (e.target.classList.contains("evac-del")) return;
        dragging = true;
        div.setPointerCapture(e.pointerId);
        startX = e.clientX;
        startY = e.clientY;
        startXPct = point.xPct;
        startYPct = point.yPct;
        e.preventDefault();
    });
    div.addEventListener("pointermove", (e) => {
        if (!dragging) return;
        const container = document.getElementById("planEvacContainer");
        const rect = container.getBoundingClientRect();
        const dxPct = ((e.clientX - startX) / rect.width) * 100;
        const dyPct = ((e.clientY - startY) / rect.height) * 100;
        point.xPct = Math.max(0, Math.min(100, startXPct + dxPct));
        point.yPct = Math.max(0, Math.min(100, startYPct + dyPct));
        div.style.left = point.xPct + "%";
        div.style.top = point.yPct + "%";
    });
    div.addEventListener("pointerup", () => { dragging = false; });
    div.addEventListener("pointercancel", () => { dragging = false; });
}

function clearPlan() {
    if (!confirm("Retirer le plan et tous les points placés ?")) return;
    delete photoStore["plan_evac"];
    document.getElementById("planEvacImg").src = "";
    document.getElementById("planEvacContainer").classList.remove("shown");
    document.getElementById("evacAddControls").style.display = "none";
    document.getElementById("evacUploadArea").style.display = "flex";
    document.getElementById("evacInput").value = "";
    evacPoints.length = 0;
    document.querySelectorAll(".evac-point").forEach(p => p.remove());
}
window.clearPlan = clearPlan;

// =============================================================
//  FOURNITURES
// =============================================================
function renderFournitures() {
    const container = document.getElementById("fournituresContainer");
    if (!container || !window.FOURNITURES_PICO) return;
    container.innerHTML = "";

    window.FOURNITURES_PICO.forEach(catBlock => {
        const cat = document.createElement("div");
        cat.className = "fournitures-cat";
        cat.innerHTML = `<h4>${catBlock.cat}</h4><div class="fournitures-list"></div>`;
        const list = cat.querySelector(".fournitures-list");
        catBlock.items.forEach(item => {
            const row = document.createElement("div");
            row.className = "fourn-item";
            row.innerHTML = `
                <input type="checkbox" id="${item.id}_chk">
                <label for="${item.id}_chk">${item.label}</label>
                <input type="number" class="qty-input" id="${item.id}_qty" min="0" step="${item.unit === 'ML' ? '1' : '1'}" placeholder="0">
                <span class="unit-tag">${item.unit}</span>
            `;
            list.appendChild(row);

            // Cocher auto si on saisit une quantité
            const qtyInput = row.querySelector(".qty-input");
            const chk = row.querySelector("input[type='checkbox']");
            qtyInput.addEventListener("input", () => {
                if (qtyInput.value && parseFloat(qtyInput.value) > 0) {
                    chk.checked = true;
                }
            });
        });
        container.appendChild(cat);
    });
}

// =============================================================
//  COLLECTE DES DONNÉES (utilisée pour Word & JSON)
// =============================================================
function val(id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
}
function radioVal(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : "";
}

function collectMeasures() {
    const rows = [];
    document.querySelectorAll("#measuresBody tr[data-measure-id]").forEach(tr => {
        const id = tr.dataset.measureId;
        rows.push({
            zone: val(id + "_zone"),
            m4g:  val(id + "_4g"),
            m5g:  val(id + "_5g"),
            dn:   val(id + "_dn"),
            up:   val(id + "_up")
        });
    });
    return rows;
}

function collectPicoPoses() {
    const list = [];
    document.querySelectorAll("#picoPosesList .pico-item").forEach((div, idx) => {
        const id = div.dataset.picoId;
        const zone = val(id + "_zone");
        const note = val(id + "_note");
        if (zone || note) {
            list.push({ num: idx + 1, zone, note });
        }
    });
    return list;
}

function collectFournitures() {
    const list = [];
    if (!window.FOURNITURES_PICO) return list;
    window.FOURNITURES_PICO.forEach(catBlock => {
        catBlock.items.forEach(item => {
            const chk = document.getElementById(item.id + "_chk");
            const qty = document.getElementById(item.id + "_qty");
            if (chk && chk.checked) {
                const q = qty && qty.value ? parseFloat(qty.value) : 0;
                list.push({
                    label: item.label,
                    qty: q || 1,
                    unit: item.unit,
                    cat: catBlock.cat
                });
            }
        });
    });
    return list;
}

function getSelectedForfait(type) {
    const groupName = "forfait_" + type.toLowerCase();
    const sel = document.querySelector(`input[name="${groupName}"]:checked`);
    if (!sel) return null;
    const data = (type === "Pico") ? window.PICO_FORFAITS : window.QUATRA_FORFAITS;
    return data.find(f => f.ref === sel.value) || null;
}

function collectAllPhotoKeys() {
    return Object.keys(photoStore);
}

// =============================================================
//  RESET
// =============================================================
function resetForm() {
    if (!confirm("Réinitialiser le formulaire ? Toutes les données saisies seront perdues.")) return;
    document.querySelectorAll("input, textarea, select").forEach(el => {
        if (el.id === "modeIntervention") return;
        if (el.type === "checkbox" || el.type === "radio") el.checked = false;
        else if (el.type !== "file") el.value = "";
    });
    setMode("audit");
    Object.keys(photoStore).forEach(k => delete photoStore[k]);
    document.querySelectorAll(".photo-preview").forEach(p => { p.src = ""; p.classList.remove("shown"); });
    document.querySelectorAll(".annotate-btn").forEach(b => b.disabled = true);
    document.querySelectorAll(".forfait-card").forEach(c => c.classList.remove("selected"));

    // Réinitialiser mesures, pico posés, photos dynamiques
    document.getElementById("measuresBody").innerHTML = "";
    document.getElementById("picoPosesList").innerHTML = "";
    document.getElementById("picoPhotoGrid").innerHTML = "";
    document.getElementById("quatraPhotoGrid").innerHTML = "";
    measureCounter = picoPoseCounter = picoPhotoCounter = quatraPhotoCounter = 0;
    addMeasureRow();
    addPicoPose();
    setupPicoPhotoBlocks();
    setupQuatraPhotoBlocks();

    clearPlan();
    updateSectionState();
    showStatus("Formulaire réinitialisé.", "success");
}
window.resetForm = resetForm;

// =============================================================
//  EXPORT / IMPORT JSON
// =============================================================
function buildBaseFilename() {
    const ref = (val("numero_ot") || "").replace(/[^a-zA-Z0-9_-]/g, "_");
    const raison = (val("raison_sociale") || "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 30);
    const date = val("date_audit") || new Date().toISOString().slice(0, 10);
    const mode = (getMode() === "travaux") ? "TRAVAUX" : "AUDIT";

    // Préfixe selon les sections actives
    const picoActive = document.getElementById("activePico").checked;
    const quatraActive = document.getElementById("activeQuatra").checked;
    let type = "PICO_QUATRA";
    if (picoActive && !quatraActive) type = "PICO";
    else if (!picoActive && quatraActive) type = "QUATRA";
    else if (picoActive && quatraActive) type = "PICO_QUATRA";

    let parts = [`${mode}_${type}`];
    if (ref) parts.push(ref);
    if (raison) parts.push(raison);
    parts.push(date);
    return parts.join("_");
}

async function exportToJSON() {
    try {
        const formData = collectAllFormData();
        const photos = {};
        Object.entries(photoStore).forEach(([k, p]) => {
            photos[k] = {
                dataUrl: p.dataUrl,
                originalDataUrl: p.originalDataUrl || null,
                annotated: p.annotated || false,
                annotations: p.annotations || null,
                naturalWidth: p.naturalWidth || null,
                naturalHeight: p.naturalHeight || null,
                type: p.type || "png",
                name: p.name || null
            };
        });

        const fullExport = {
            version: 1,
            type: "pico-quatra",
            exportedAt: new Date().toISOString(),
            mode: getMode(),
            picoActive: document.getElementById("activePico").checked,
            quatraActive: document.getElementById("activeQuatra").checked,
            formData,
            photos,
            evacPoints: evacPoints.slice()
        };

        const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: "application/json" });
        saveAs(blob, buildBaseFilename() + "_BACKUP.json");
        showStatus("✅ Sauvegarde JSON exportée.", "success");
    } catch (err) {
        console.error(err);
        showStatus("❌ Erreur export JSON : " + err.message, "error");
    }
}
window.exportToJSON = exportToJSON;

function collectAllFormData() {
    return {
        // En-tête
        numero_ot: val("numero_ot"),
        cdp_bytel: val("cdp_bytel"),
        auditeur: val("auditeur"),
        direction: val("direction"),
        date_audit: val("date_audit"),
        // Client
        raison_sociale: val("raison_sociale"),
        adresse: val("adresse"),
        code_postal: val("code_postal"),
        ville: val("ville"),
        horaire: val("horaire"),
        procedure_acces: val("procedure_acces"),
        tel_site: val("tel_site"),
        contact_nom: val("contact_nom"),
        contact_fonction: val("contact_fonction"),
        contact_tel: val("contact_tel"),
        contact_mail: val("contact_mail"),
        // Technique
        batiment_classe: radioVal("batiment_classe"),
        loc_baie: val("loc_baie"),
        nb_prises_elec: val("nb_prises_elec"),
        rj45_optimal: radioVal("rj45_optimal"),
        devis_desserte: radioVal("devis_desserte"),
        vlan_besoin: radioVal("vlan_besoin"),
        vlan_port: val("vlan_port"),
        // Mesures
        mesures: collectMeasures(),
        mesures_note: val("mesures_note"),
        // PICO
        pico_forfait: getSelectedForfait("Pico"),
        pico_poses: collectPicoPoses(),
        pico_metrage: val("pico_metrage"),
        pico_hauteur: val("pico_hauteur"),
        // Quatra
        quatra_forfait: getSelectedForfait("Quatra"),
        quatra_nb_nu: val("quatra_nb_nu"),
        quatra_nb_cu: val("quatra_nb_cu"),
        quatra_metrage_cu: val("quatra_metrage_cu"),
        // Fournitures
        fournitures: collectFournitures(),
        fournitures_libre: val("fournitures_libre"),
        outils_libre: val("outils_libre"),
        // Mise en œuvre
        hauteur_max: val("hauteur_max"),
        nb_techniciens: val("nb_techniciens"),
        duree_totale: val("duree_totale"),
        nacelle_prevoir: radioVal("nacelle_prevoir"),
        echelle_prevoir: radioVal("echelle_prevoir"),
        // Synthèse
        acces_site: val("acces_site"),
        solution_validee_par: val("solution_validee_par"),
        observations: val("observations"),
        signataire_nom: val("signataire_nom"),
        signataire_date: val("signataire_date"),
        // Photo labels (libellés saisis)
        photoLabels: collectPhotoLabels()
    };
}

function collectPhotoLabels() {
    const labels = {};
    document.querySelectorAll("[data-photo-label-for]").forEach(inp => {
        const key = inp.dataset.photoLabelFor;
        labels[key] = inp.value || "";
    });
    return labels;
}

async function importFromJSON(file) {
    if (!file) return;
    if (!confirm("Importer ce fichier va remplacer toutes les données actuelles. Continuer ?")) {
        document.getElementById("importJsonInput").value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const fd = data.formData || {};

            // Reset visuel sans confirmation
            document.querySelectorAll("input, textarea, select").forEach(el => {
                if (el.id === "modeIntervention") return;
                if (el.type === "checkbox" || el.type === "radio") el.checked = false;
                else if (el.type !== "file") el.value = "";
            });
            Object.keys(photoStore).forEach(k => delete photoStore[k]);
            document.querySelectorAll(".photo-preview").forEach(p => { p.src = ""; p.classList.remove("shown"); });
            document.querySelectorAll(".annotate-btn").forEach(b => b.disabled = true);
            document.querySelectorAll(".forfait-card").forEach(c => c.classList.remove("selected"));

            // Reset mesures / pico-poses / photos dynamiques
            document.getElementById("measuresBody").innerHTML = "";
            document.getElementById("picoPosesList").innerHTML = "";
            document.getElementById("picoPhotoGrid").innerHTML = "";
            document.getElementById("quatraPhotoGrid").innerHTML = "";
            measureCounter = picoPoseCounter = picoPhotoCounter = quatraPhotoCounter = 0;
            evacPoints.length = 0;
            document.querySelectorAll(".evac-point").forEach(p => p.remove());

            // Mode
            setMode(data.mode === "travaux" ? "travaux" : "audit");

            // Sections actives
            document.getElementById("activePico").checked = !!data.picoActive;
            document.getElementById("activeQuatra").checked = !!data.quatraActive;

            // Champs simples
            const TEXT_FIELDS = [
                "numero_ot", "cdp_bytel", "auditeur", "direction", "date_audit",
                "raison_sociale", "adresse", "code_postal", "ville", "horaire", "procedure_acces",
                "tel_site", "contact_nom", "contact_fonction", "contact_tel", "contact_mail",
                "loc_baie", "nb_prises_elec", "vlan_port", "mesures_note",
                "pico_metrage", "pico_hauteur",
                "quatra_nb_nu", "quatra_nb_cu", "quatra_metrage_cu",
                "fournitures_libre", "outils_libre",
                "hauteur_max", "nb_techniciens", "duree_totale",
                "acces_site", "solution_validee_par", "observations",
                "signataire_nom", "signataire_date"
            ];
            TEXT_FIELDS.forEach(id => {
                const el = document.getElementById(id);
                if (el && fd[id] !== undefined && fd[id] !== null) el.value = fd[id];
            });

            // Radios
            ["batiment_classe", "rj45_optimal", "devis_desserte", "vlan_besoin",
             "nacelle_prevoir", "echelle_prevoir"].forEach(name => {
                const v = fd[name];
                if (v) {
                    const r = document.querySelector(`input[name="${name}"][value="${v}"]`);
                    if (r) r.checked = true;
                }
            });

            // Mesures
            (fd.mesures || []).forEach(m => {
                addMeasureRow();
                const id = "m_" + measureCounter;
                document.getElementById(id + "_zone").value = m.zone || "";
                document.getElementById(id + "_4g").value = m.m4g || "";
                document.getElementById(id + "_5g").value = m.m5g || "";
                document.getElementById(id + "_dn").value = m.dn || "";
                document.getElementById(id + "_up").value = m.up || "";
            });
            if ((fd.mesures || []).length === 0) addMeasureRow();

            // Pico posés
            (fd.pico_poses || []).forEach(p => {
                addPicoPose();
                const id = "pp_" + picoPoseCounter;
                document.getElementById(id + "_zone").value = p.zone || "";
                document.getElementById(id + "_note").value = p.note || "";
            });
            if ((fd.pico_poses || []).length === 0) addPicoPose();

            // Forfait pico
            if (fd.pico_forfait && fd.pico_forfait.ref) {
                const r = document.querySelector(`input[name="forfait_pico"][value="${fd.pico_forfait.ref}"]`);
                if (r) {
                    r.checked = true;
                    r.closest(".forfait-card").classList.add("selected");
                }
            }
            if (fd.quatra_forfait && fd.quatra_forfait.ref) {
                const r = document.querySelector(`input[name="forfait_quatra"][value="${fd.quatra_forfait.ref}"]`);
                if (r) {
                    r.checked = true;
                    r.closest(".forfait-card").classList.add("selected");
                }
            }

            // Fournitures
            (fd.fournitures || []).forEach(f => {
                // Re-trouver l'item par label
                window.FOURNITURES_PICO.forEach(catBlock => {
                    catBlock.items.forEach(item => {
                        if (item.label === f.label) {
                            const chk = document.getElementById(item.id + "_chk");
                            const qty = document.getElementById(item.id + "_qty");
                            if (chk) chk.checked = true;
                            if (qty) qty.value = f.qty || "";
                        }
                    });
                });
            });

            // Photos : recréer les blocs personnalisés et restaurer les images
            const photos = data.photos || {};
            const labels = fd.photoLabels || {};

            // Photos PICO et Quatra : on recrée les blocs en fonction des clés présentes
            const picoKeys = Object.keys(photos).filter(k => k.startsWith("pico_photo_"));
            const quatraKeys = Object.keys(photos).filter(k => k.startsWith("quatra_photo_"));

            if (picoKeys.length > 0) {
                document.getElementById("picoPhotoGrid").innerHTML = "";
                picoPhotoCounter = 0;
                picoKeys.sort((a, b) => parseInt(a.split("_")[2]) - parseInt(b.split("_")[2]));
                picoKeys.forEach(k => {
                    const lbl = labels[k] || ("Photo PICO " + (picoPhotoCounter + 1));
                    addPicoPhotoBlock(lbl);
                });
            } else {
                setupPicoPhotoBlocks();
            }

            if (quatraKeys.length > 0) {
                document.getElementById("quatraPhotoGrid").innerHTML = "";
                quatraPhotoCounter = 0;
                quatraKeys.sort((a, b) => parseInt(a.split("_")[2]) - parseInt(b.split("_")[2]));
                quatraKeys.forEach(k => {
                    const lbl = labels[k] || ("Photo Quatra " + (quatraPhotoCounter + 1));
                    addQuatraPhotoBlock(lbl);
                });
            } else {
                setupQuatraPhotoBlocks();
            }

            // Restaurer les photos dans photoStore et les previews
            Object.entries(photos).forEach(([key, p]) => {
                photoStore[key] = {
                    dataUrl: p.dataUrl,
                    originalDataUrl: p.originalDataUrl || p.dataUrl,
                    annotated: p.annotated || false,
                    annotations: p.annotations || null,
                    naturalWidth: p.naturalWidth || null,
                    naturalHeight: p.naturalHeight || null,
                    type: p.type || "png",
                    name: p.name || null
                };
                const preview = document.getElementById("preview_" + key);
                if (preview && p.dataUrl) {
                    preview.src = p.dataUrl;
                    preview.classList.add("shown");
                }
                const annBtn = document.querySelector(`[data-annotate="${key}"]`);
                if (annBtn) annBtn.disabled = false;
            });

            // Plan d'évacuation
            if (photos.plan_evac && photos.plan_evac.dataUrl) {
                document.getElementById("planEvacImg").src = photos.plan_evac.dataUrl;
                document.getElementById("planEvacContainer").classList.add("shown");
                document.getElementById("evacAddControls").style.display = "flex";
                document.getElementById("evacUploadArea").style.display = "none";

                // Restaurer les points
                (data.evacPoints || []).forEach(pt => {
                    evacPoints.push({ ...pt });
                    renderEvacPoint(pt);
                    if (pt.id) {
                        const num = parseInt(pt.id.split("_")[1]);
                        if (!isNaN(num) && num > evacPointCounter) evacPointCounter = num;
                    }
                });
            }

            updateSectionState();
            document.getElementById("importJsonInput").value = "";
            showStatus("✅ Sauvegarde importée.", "success");
        } catch (err) {
            console.error(err);
            showStatus("❌ Erreur d'import : " + err.message, "error");
        }
    };
    reader.readAsText(file);
}
window.importFromJSON = importFromJSON;

// =============================================================
//  GÉNÉRATION DU RAPPORT WORD
// =============================================================

// Couleurs reprises du style 4G/5G pour cohérence
const COLOR_TITLE = "1F3864";
const COLOR_SUBTITLE = "2E75B6";
const COLOR_TABLE_LABEL = "F2F2F2";
const COLOR_BORDER = "BFBFBF";
const COLOR_WHITE = "FFFFFF";
const COLOR_HEADER_BG = "2E5481";

async function generateReport() {
    showStatus("⏳ Génération du rapport en cours...", "info");

    try {
        await window.__libsLoaded;
        if (typeof docx === "undefined") {
            throw new Error("La bibliothèque docx n'a pas pu être chargée.");
        }

        const {
            Document, Paragraph, TextRun, Table, TableRow, TableCell,
            ImageRun, AlignmentType, WidthType, BorderStyle, ShadingType,
            VerticalAlign, HeightRule, Footer, Header, PageNumber,
            HeadingLevel, Packer, LevelFormat, PageOrientation
        } = docx;

        const FONT = "Calibri";
        const stdBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
        const stdBorders = { top: stdBorder, bottom: stdBorder, left: stdBorder, right: stdBorder };

        // Helpers
        const P = (text, opts) => new Paragraph({
            spacing: { before: 80, after: 80 },
            ...(opts || {}),
            children: Array.isArray(text)
                ? text
                : [new TextRun({ text: text || "", font: FONT, size: 22, ...(opts && opts.runOpts || {}) })]
        });

        const H = (text, level) => new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [new TextRun({
                text, bold: true, font: FONT,
                size: level === 1 ? 30 : (level === 2 ? 26 : 22),
                color: level === 1 ? COLOR_TITLE : COLOR_SUBTITLE
            })]
        });

        const cellText = (text, opts) => new TableCell({
            width: opts && opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
            shading: opts && opts.shading ? { fill: opts.shading, type: ShadingType.CLEAR, color: "auto" } : undefined,
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            borders: stdBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({
                alignment: opts && opts.align ? opts.align : AlignmentType.LEFT,
                children: [new TextRun({
                    text: text || "",
                    font: FONT,
                    size: 20,
                    bold: !!(opts && opts.bold),
                    color: opts && opts.color ? opts.color : "000000"
                })]
            })]
        });

        // Helper : convertir dataURL → Uint8Array
        function dataUrlToBytes(dataUrl) {
            const base64 = dataUrl.split(",")[1];
            const binary = atob(base64);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            return bytes;
        }

        // Helper : récupérer une photo prête pour ImageRun
        function getPhotoImageRun(key, w, h) {
            const p = photoStore[key];
            if (!p || !p.dataUrl) return null;
            try {
                return new ImageRun({
                    data: dataUrlToBytes(p.dataUrl),
                    transformation: { width: w, height: h },
                    type: (p.type === "png") ? "png" : "jpg"
                });
            } catch (err) {
                console.warn("Photo invalide", key, err);
                return null;
            }
        }

        const mode = getMode();
        const picoActive = document.getElementById("activePico").checked;
        const quatraActive = document.getElementById("activeQuatra").checked;

        // Titre du rapport
        let typeLabel = "";
        if (picoActive && quatraActive) typeLabel = "PICO BTS + CEL-FI QUATRA";
        else if (picoActive) typeLabel = "INSTALLATION PICO BTS";
        else if (quatraActive) typeLabel = "INSTALLATION CEL-FI QUATRA";
        else typeLabel = "PICO / CEL-FI QUATRA";
        const titreRapport = ((mode === "travaux") ? "RAPPORT DE TRAVAUX - " : "RAPPORT D'AUDIT - ") + typeLabel;

        // ============ CONSTRUCTION DU DOCUMENT ============
        const children = [];

        // Bandeau titre principal
        children.push(new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [9360],
            rows: [new TableRow({
                children: [new TableCell({
                    width: { size: 9360, type: WidthType.DXA },
                    shading: { fill: COLOR_HEADER_BG, type: ShadingType.CLEAR, color: "auto" },
                    margins: { top: 240, bottom: 200, left: 200, right: 200 },
                    borders: stdBorders,
                    children: [
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({
                                text: titreRapport,
                                bold: true, size: 32, color: COLOR_WHITE, font: FONT
                            })]
                        }),
                        new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 80 },
                            children: [new TextRun({
                                text: "Bouygues Telecom | IPKONEKT",
                                size: 22, color: COLOR_WHITE, font: FONT
                            })]
                        })
                    ]
                })]
            })]
        }));

        children.push(P(""));

        // Tableau d'en-tête (info OT, contact, date)
        const hdrRows = [
            ["Numéro d'OT", val("numero_ot")],
            ["CDP Bytel", val("cdp_bytel")],
            ["Auditeur / Intervenant", val("auditeur")],
            ["Direction / Service", val("direction")],
            ["Date d'intervention", val("date_audit")]
        ].filter(r => r[1] && r[1].trim());

        if (hdrRows.length > 0) {
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [3120, 6240],
                rows: hdrRows.map(([k, v]) => new TableRow({
                    children: [
                        cellText(k, { width: 3120, shading: COLOR_TABLE_LABEL, bold: true }),
                        cellText(v, { width: 6240 })
                    ]
                }))
            }));
            children.push(P(""));
        }

        // ===== 1. INFOS CLIENT =====
        children.push(H("1. Informations administratives du client", 1));
        const clientRows = [
            ["Raison sociale", val("raison_sociale")],
            ["Adresse", [val("adresse"), val("code_postal"), val("ville")].filter(x => x).join(" ")],
            ["Horaire d'ouverture", val("horaire")],
            ["Procédure d'accès", val("procedure_acces")],
            ["Téléphone du site", val("tel_site")],
            ["Contact", [val("contact_nom"), val("contact_fonction")].filter(x => x).join(" — ")],
            ["Téléphone du contact", val("contact_tel")],
            ["Mail du contact", val("contact_mail")]
        ].filter(r => r[1] && r[1].trim());

        if (clientRows.length > 0) {
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [3120, 6240],
                rows: clientRows.map(([k, v]) => new TableRow({
                    children: [
                        cellText(k, { width: 3120, shading: COLOR_TABLE_LABEL, bold: true }),
                        cellText(v, { width: 6240 })
                    ]
                }))
            }));
        }

        // ===== 2. INFOS TECHNIQUES =====
        children.push(H("2. Informations techniques client", 1));
        const techRows = [
            ["Bâtiment classé", radioVal("batiment_classe")],
            ["Localisation de la baie informatique", val("loc_baie")],
            ["Nb de prises électriques disponibles", val("nb_prises_elec")],
            ["Prise RJ45 à l'emplacement optimal", radioVal("rj45_optimal")],
            ["Devis desserte à prévoir", radioVal("devis_desserte")],
            ["Besoin VLAN", radioVal("vlan_besoin")],
            ["Si VLAN, sur quel port", val("vlan_port")]
        ].filter(r => r[1] && r[1].trim());

        if (techRows.length > 0) {
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                rows: techRows.map(([k, v]) => new TableRow({
                    children: [
                        cellText(k, { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }),
                        cellText(v, { width: 4680 })
                    ]
                }))
            }));
        }

        // ===== 3. MESURES RADIO =====
        children.push(H("3. Mesures radio (avant intervention)", 1));
        children.push(P("Tests réalisés avec l'application Network Cell Info Lite.", { runOpts: { italics: true, color: "555555" } }));

        // Grille qualité
        children.push(H("État de la couverture radio", 2));
        children.push(new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [3120, 6240],
            rows: [
                new TableRow({
                    children: [
                        cellText("Qualité couverture", { width: 3120, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true }),
                        cellText("4G", { width: 6240, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER })
                    ]
                }),
                new TableRow({ children: [cellText("Bonne", { width: 3120, bold: true }), cellText("> -97 dBm", { width: 6240 })] }),
                new TableRow({ children: [cellText("Moyenne", { width: 3120, bold: true }), cellText("-98 dBm < X < -107 dBm", { width: 6240 })] }),
                new TableRow({ children: [cellText("Médiocre", { width: 3120, bold: true }), cellText("-108 dBm < X < -117 dBm", { width: 6240 })] }),
                new TableRow({ children: [cellText("Mauvaise", { width: 3120, bold: true }), cellText("> -118 dBm", { width: 6240 })] }),
                new TableRow({ children: [cellText("Inexistante", { width: 3120, bold: true }), cellText("Pas de couverture", { width: 6240 })] })
            ]
        }));

        // Tableau des points de mesure
        const mesures = collectMeasures().filter(m => m.zone || m.m4g || m.m5g);
        if (mesures.length > 0) {
            children.push(H("Points de mesure", 2));
            const mesureRows = [
                new TableRow({
                    tableHeader: true,
                    children: [
                        cellText("Point de mesure", { width: 2400, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true }),
                        cellText("4G (RSRP/RSRQ/Band)", { width: 2240, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER }),
                        cellText("5G (RSRP/RSRQ/Band)", { width: 2240, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER }),
                        cellText("Speedtest 4G ↓ (Mb)", { width: 1240, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER }),
                        cellText("Speedtest 4G ↑ (Mb)", { width: 1240, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER })
                    ]
                })
            ];
            mesures.forEach(m => mesureRows.push(new TableRow({
                children: [
                    cellText(m.zone || "—", { width: 2400, bold: true }),
                    cellText(m.m4g || "—", { width: 2240, align: AlignmentType.CENTER }),
                    cellText(m.m5g || "—", { width: 2240, align: AlignmentType.CENTER }),
                    cellText(m.dn || "—", { width: 1240, align: AlignmentType.CENTER }),
                    cellText(m.up || "—", { width: 1240, align: AlignmentType.CENTER })
                ]
            })));
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [2400, 2240, 2240, 1240, 1240],
                rows: mesureRows
            }));
        }

        const mesureNote = val("mesures_note");
        if (mesureNote.trim()) {
            children.push(P(""));
            children.push(P(mesureNote, { runOpts: { italics: true } }));
        }

        // ===== 4. PLAN D'IMPLANTATION =====
        if (photoStore["plan_evac"]) {
            children.push(H("4. Plan d'implantation / d'évacuation", 1));
            const planImg = await renderPlanWithPoints();
            if (planImg) {
                children.push(new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                        data: dataUrlToBytes(planImg),
                        transformation: { width: 600, height: 380 },
                        type: "png"
                    })]
                }));
            }
            if (evacPoints.length > 0) {
                children.push(P("Légende : " + evacPoints.map(p => p.label).join(" • "),
                    { runOpts: { italics: true, color: "555555" } }));
            }
        }

        // ===== 5. SECTION PICO =====
        if (picoActive) {
            children.push(H("5. Mise en place de la solution PICO BTS", 1));

            const picoForfait = getSelectedForfait("Pico");
            if (picoForfait) {
                children.push(H("5.1 Forfait retenu", 2));
                children.push(new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: [2080, 7280],
                    rows: [
                        new TableRow({ children: [cellText("Référence", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(picoForfait.ref, { width: 7280 })] }),
                        new TableRow({ children: [cellText("Forfait", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(picoForfait.label, { width: 7280, bold: true })] }),
                        new TableRow({ children: [cellText("Description", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(picoForfait.description, { width: 7280 })] }),
                        new TableRow({ children: [cellText("Critères", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(picoForfait.critere, { width: 7280 })] })
                    ]
                }));
            }

            const picoPoses = collectPicoPoses();
            if (picoPoses.length > 0) {
                children.push(H("5.2 PICO posés", 2));
                const rows = [
                    new TableRow({
                        tableHeader: true,
                        children: [
                            cellText("N°", { width: 800, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER }),
                            cellText("Zone / Pièce", { width: 3280, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true }),
                            cellText("Note", { width: 5280, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true })
                        ]
                    })
                ];
                picoPoses.forEach(p => rows.push(new TableRow({
                    children: [
                        cellText(`PICO ${p.num}`, { width: 800, bold: true, align: AlignmentType.CENTER }),
                        cellText(p.zone || "—", { width: 3280 }),
                        cellText(p.note || "", { width: 5280 })
                    ]
                })));
                children.push(new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: [800, 3280, 5280],
                    rows
                }));
            }

            // Métré + hauteur
            const metrage = val("pico_metrage");
            const hauteur = val("pico_hauteur");
            if (metrage || hauteur) {
                children.push(H("5.3 Métré câble & hauteur", 2));
                const metRows = [];
                if (metrage) metRows.push(new TableRow({ children: [cellText("Linéaire câble Ethernet total", { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }), cellText(metrage + " ml", { width: 4680 })] }));
                if (hauteur) metRows.push(new TableRow({ children: [cellText("Hauteur de pose des PICO", { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }), cellText(hauteur + " m", { width: 4680 })] }));
                children.push(new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: [4680, 4680],
                    rows: metRows
                }));
            }

            // Photos PICO
            const picoPhotoKeys = Object.keys(photoStore).filter(k => k.startsWith("pico_photo_"));
            if (picoPhotoKeys.length > 0) {
                children.push(H("5.4 Reporting photos / cheminement câbles", 2));
                picoPhotoKeys.sort((a, b) => parseInt(a.split("_")[2]) - parseInt(b.split("_")[2]));
                for (const key of picoPhotoKeys) {
                    const labelInput = document.querySelector(`[data-photo-label-for="${key}"]`);
                    const label = labelInput ? labelInput.value : key;
                    const img = getPhotoImageRun(key, 480, 320);
                    if (img) {
                        children.push(new Paragraph({
                            spacing: { before: 200, after: 60 },
                            children: [new TextRun({
                                text: "📷 " + label, bold: true, size: 22, color: COLOR_SUBTITLE, font: FONT
                            })]
                        }));
                        children.push(new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [img]
                        }));
                    }
                }
            }
        }

        // ===== 6. SECTION QUATRA =====
        if (quatraActive) {
            children.push(H("6. Mise en place de la solution CEL-FI QUATRA", 1));

            const quatraForfait = getSelectedForfait("Quatra");
            if (quatraForfait) {
                children.push(H("6.1 Forfait retenu", 2));
                children.push(new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: [2080, 7280],
                    rows: [
                        new TableRow({ children: [cellText("Référence", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(quatraForfait.ref, { width: 7280 })] }),
                        new TableRow({ children: [cellText("Forfait", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(quatraForfait.label, { width: 7280, bold: true })] }),
                        new TableRow({ children: [cellText("Description", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(quatraForfait.description, { width: 7280 })] }),
                        new TableRow({ children: [cellText("Critères", { width: 2080, shading: COLOR_TABLE_LABEL, bold: true }), cellText(quatraForfait.critere, { width: 7280 })] })
                    ]
                }));
            }

            const qNu = val("quatra_nb_nu");
            const qCu = val("quatra_nb_cu");
            const qMet = val("quatra_metrage_cu");
            if (qNu || qCu || qMet) {
                children.push(H("6.2 Équipements posés", 2));
                const qRows = [];
                if (qNu) qRows.push(new TableRow({ children: [cellText("Nombre de NU", { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }), cellText(qNu, { width: 4680 })] }));
                if (qCu) qRows.push(new TableRow({ children: [cellText("Nombre de CU", { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }), cellText(qCu, { width: 4680 })] }));
                if (qMet) qRows.push(new TableRow({ children: [cellText("Linéaire câble RJ45 par CU", { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }), cellText(qMet + " m", { width: 4680 })] }));
                children.push(new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: [4680, 4680],
                    rows: qRows
                }));
            }

            // Photos Quatra
            const quatraPhotoKeys = Object.keys(photoStore).filter(k => k.startsWith("quatra_photo_"));
            if (quatraPhotoKeys.length > 0) {
                children.push(H("6.3 Photos Quatra", 2));
                quatraPhotoKeys.sort((a, b) => parseInt(a.split("_")[2]) - parseInt(b.split("_")[2]));
                for (const key of quatraPhotoKeys) {
                    const labelInput = document.querySelector(`[data-photo-label-for="${key}"]`);
                    const label = labelInput ? labelInput.value : key;
                    const img = getPhotoImageRun(key, 480, 320);
                    if (img) {
                        children.push(new Paragraph({
                            spacing: { before: 200, after: 60 },
                            children: [new TextRun({
                                text: "📷 " + label, bold: true, size: 22, color: COLOR_SUBTITLE, font: FONT
                            })]
                        }));
                        children.push(new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [img]
                        }));
                    }
                }
            }
        }

        // ===== 7. FOURNITURES =====
        const fournitures = collectFournitures();
        const fLibre = val("fournitures_libre");
        const oLibre = val("outils_libre");
        if (fournitures.length > 0 || fLibre.trim() || oLibre.trim()) {
            children.push(H("7. Fournitures & matériel", 1));

            if (fournitures.length > 0) {
                // Grouper par catégorie
                const byCat = {};
                fournitures.forEach(f => {
                    if (!byCat[f.cat]) byCat[f.cat] = [];
                    byCat[f.cat].push(f);
                });

                const fRows = [
                    new TableRow({
                        tableHeader: true,
                        children: [
                            cellText("Désignation", { width: 6480, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true }),
                            cellText("Quantité", { width: 1440, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER }),
                            cellText("Unité", { width: 1440, shading: COLOR_SUBTITLE, color: COLOR_WHITE, bold: true, align: AlignmentType.CENTER })
                        ]
                    })
                ];
                Object.keys(byCat).forEach(cat => {
                    fRows.push(new TableRow({
                        children: [new TableCell({
                            width: { size: 9360, type: WidthType.DXA },
                            columnSpan: 3,
                            shading: { fill: COLOR_TABLE_LABEL, type: ShadingType.CLEAR, color: "auto" },
                            margins: { top: 60, bottom: 60, left: 100, right: 100 },
                            borders: stdBorders,
                            children: [new Paragraph({
                                children: [new TextRun({ text: cat, bold: true, italics: true, color: COLOR_TITLE, size: 20, font: FONT })]
                            })]
                        })]
                    }));
                    byCat[cat].forEach(f => fRows.push(new TableRow({
                        children: [
                            cellText("• " + f.label, { width: 6480 }),
                            cellText(String(f.qty), { width: 1440, align: AlignmentType.CENTER, bold: true }),
                            cellText(f.unit, { width: 1440, align: AlignmentType.CENTER })
                        ]
                    })));
                });
                children.push(new Table({
                    width: { size: 9360, type: WidthType.DXA },
                    columnWidths: [6480, 1440, 1440],
                    rows: fRows
                }));
            }

            if (fLibre.trim()) {
                children.push(H("Autres fournitures", 2));
                fLibre.split(/\n+/).forEach(line => {
                    if (line.trim()) children.push(P("• " + line.trim()));
                });
            }
            if (oLibre.trim()) {
                children.push(H("Outils nécessaires", 2));
                oLibre.split(/\n+/).forEach(line => {
                    if (line.trim()) children.push(P("• " + line.trim()));
                });
            }
        }

        // ===== 8. MISE EN ŒUVRE =====
        children.push(H("8. Mise en œuvre", 1));
        const mevRows = [
            ["Hauteur de travail max", val("hauteur_max") ? val("hauteur_max") + " m" : ""],
            ["Nombre d'intervenants", val("nb_techniciens")],
            ["Temps de travaux estimé", val("duree_totale")],
            ["Nacelle à prévoir", radioVal("nacelle_prevoir")],
            ["Échelle / échafaudage", radioVal("echelle_prevoir")]
        ].filter(r => r[1] && r[1].trim());

        if (mevRows.length > 0) {
            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [4680, 4680],
                rows: mevRows.map(([k, v]) => new TableRow({
                    children: [
                        cellText(k, { width: 4680, shading: COLOR_TABLE_LABEL, bold: true }),
                        cellText(v, { width: 4680 })
                    ]
                }))
            }));
        }

        // ===== 9. ACCÈS & VALIDATION =====
        children.push(H("9. Accès site & validation", 1));
        const acces = val("acces_site");
        const valide = val("solution_validee_par");
        const obs = val("observations");

        if (acces.trim()) {
            children.push(P([new TextRun({ text: "Conditions d'accès : ", bold: true, font: FONT, size: 22 }),
                             new TextRun({ text: acces, font: FONT, size: 22 })]));
        }
        if (valide.trim()) {
            children.push(P([new TextRun({ text: "Solution validée par : ", bold: true, font: FONT, size: 22 }),
                             new TextRun({ text: valide, font: FONT, size: 22 })]));
        }
        if (obs.trim()) {
            children.push(H("Observations / Commentaires complémentaires", 2));
            obs.split(/\n+/).forEach(line => {
                if (line.trim()) children.push(P(line.trim()));
            });
        }

        // Signature
        const signNom = val("signataire_nom");
        const signDate = val("signataire_date");
        if (signNom || signDate) {
            children.push(P(""));
            children.push(P(""));
            children.push(P([new TextRun({ text: "Signataire : ", bold: true, font: FONT, size: 22 }),
                             new TextRun({ text: signNom + (signDate ? "  —  " + signDate : ""), font: FONT, size: 22 })]));
        }

        // ============ DOCUMENT ============
        const doc = new Document({
            creator: "IPKONEKT",
            title: titreRapport,
            description: titreRapport,
            styles: {
                default: { document: { run: { font: FONT, size: 22 } } }
            },
            sections: [{
                properties: {
                    page: {
                        margin: { top: 720, bottom: 720, left: 720, right: 720 }
                    }
                },
                footers: {
                    default: new Footer({
                        children: [new Paragraph({
                            alignment: AlignmentType.CENTER,
                            children: [new TextRun({
                                text: "IPKONEKT — Bouygues Telecom — ",
                                font: FONT, size: 18, color: "808080"
                            }), new TextRun({
                                children: [PageNumber.CURRENT], font: FONT, size: 18, color: "808080"
                            }), new TextRun({
                                text: " / ", font: FONT, size: 18, color: "808080"
                            }), new TextRun({
                                children: [PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: "808080"
                            })]
                        })]
                    })
                },
                children: children
            }]
        });

        const blob = await Packer.toBlob(doc);
        const filename = buildBaseFilename() + ".docx";
        saveAs(blob, filename);
        showStatus("✅ Rapport généré : " + filename, "success");
    } catch (err) {
        console.error(err);
        showStatus("❌ Erreur lors de la génération : " + err.message, "error");
    }
}
window.generateReport = generateReport;

// ----- Rendre le plan d'évacuation avec ses points dessinés (canvas → dataUrl) -----
async function renderPlanWithPoints() {
    const planPhoto = photoStore["plan_evac"];
    if (!planPhoto || !planPhoto.dataUrl) return null;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            // Dessiner les points
            evacPoints.forEach(p => {
                const x = (p.xPct / 100) * canvas.width;
                const y = (p.yPct / 100) * canvas.height;

                // Mesure du label pour boîte
                ctx.font = "bold " + Math.max(14, canvas.width * 0.022) + "px Arial";
                const label = p.label || "•";
                const padding = 8;
                const metrics = ctx.measureText(label);
                const w = metrics.width + padding * 2;
                const h = parseInt(ctx.font, 10) + padding;

                // Boîte
                ctx.fillStyle = "#2e75b6";
                ctx.strokeStyle = "#ffffff";
                ctx.lineWidth = 3;
                const rx = x - w / 2, ry = y - h / 2;
                roundRect(ctx, rx, ry, w, h, 8);
                ctx.fill();
                ctx.stroke();

                // Texte
                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(label, x, y);
            });
            resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => resolve(null);
        img.src = planPhoto.dataUrl;
    });
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
