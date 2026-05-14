// ============================================================
//  AUDIT 4G/5G — VERSION COMPLÈTE (Style Starlink)
//  Génération Word identique au template Starlink validé
// ============================================================

const photoStore = {};
// Compteurs séparés par techno (pour numérotation interne stable)
let measureCounter4G = 0;
let measureCounter5G = 0;
let cheminementCounter = 0;

// État des points placés sur le plan évac
// Chaque entrée : { pointId: "4g-1" | "5g-2", leftPct, topPct, size }
let evacPoints = [];

// ---------- Couleurs / constantes du style Starlink ----------
const COLOR_TITLE       = "1F3864"; // bleu marine titres
const COLOR_SUBTITLE    = "2E75B6"; // bleu sous-titres 2.1 -
const COLOR_TABLE_LABEL = "F2F2F2"; // gris clair (libellés)
const COLOR_PHOTO_BG    = "DEEBF7"; // bleu pâle (bandeau photo)
const COLOR_PHOTO_BORDER= "BDD7EE";
const COLOR_BORDER      = "BFBFBF";
const COLOR_FOOTER      = "808080";
const COLOR_WHITE       = "FFFFFF";

// Couleurs accent par techno (pour pickers et titres)
const TECH_COLOR_4G = "2E75B6";
const TECH_COLOR_5G = "16A34A";

// ---------- ATTENTE DES LIBRAIRIES ----------
function waitForLibs() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.docx !== 'undefined' && typeof window.saveAs !== 'undefined') {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", async () => {
    await waitForLibs();

    const today = new Date().toISOString().slice(0, 10);
    const dateAudit = document.getElementById("date_audit");
    const sigDate = document.getElementById("signataire_date");
    if (dateAudit && !dateAudit.value) dateAudit.value = today;
    if (sigDate && !sigDate.value) sigDate.value = today;

    document.body.addEventListener("click", handleGlobalClick);

    // Initialiser 3 points par défaut pour chaque techno
    initMeasurePoints();

    const addMP4 = document.getElementById("addMeasurePointBtn4G");
    if (addMP4) addMP4.addEventListener("click", () => addMeasurePoint("4g"));

    const addMP5 = document.getElementById("addMeasurePointBtn5G");
    if (addMP5) addMP5.addEventListener("click", () => addMeasurePoint("5g"));

    const btnChem = document.getElementById("addCheminementBtn");
    if (btnChem) btnChem.addEventListener("click", () => addCheminementItem());

    const evacInput = document.getElementById("evacFileInput");
    if (evacInput) evacInput.addEventListener("change", handleEvacUpload);

    // Bouton "Supprimer le plan d'évacuation" : permet de repartir d'une photo
    // vierge si le technicien s'est trompé d'image.
    const evacDelBtn = document.getElementById("evacDeletePlanBtn");
    if (evacDelBtn) evacDelBtn.addEventListener("click", deleteEvacPlan);

    // Au moins un cheminement par défaut
    if (document.getElementById("cheminementContainer") &&
        document.getElementById("cheminementContainer").children.length === 0) {
        addCheminementItem();
    }

    // Première génération de la liste de picker (vide tant que le plan n'est pas chargé)
    refreshEvacPicker();

    // Photo d'installation du routeur (mode TRAVAUX)
    const routeurInput = document.getElementById("routeurPhotoInput");
    if (routeurInput) {
        routeurInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await processPhoto(file, "routeur_install");
            const annBtn = document.querySelector('[data-annotate="routeur_install"]');
            if (annBtn) annBtn.disabled = false;
            if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
        });
    }

    // Picker du plan d'évacuation en mode TRAVAUX (Antenne / Routeur / Mesures après installation)
    refreshEvacTravauxPicker();

    // Application initiale du layout selon le mode courant
    const initialMode = (document.getElementById("modeIntervention")?.value) || "audit";
    document.body.setAttribute("data-mode", initialMode);
    applyTravauxLayout(initialMode);

    // Synchroniser l'image du plan d'évacuation avec sa version annotée après chaque
    // passage dans l'éditeur. L'éditeur met à jour photoStore['evac_plan'].dataUrl
    // mais ne sait pas que l'image du formulaire s'appelle 'evacBgImage' (et non
    // 'preview_evac_plan'), donc on s'en charge ici.
    //
    // Le HTML appelle window.saveAnnotation() et window.closeEditor() (et non
    // directement window.Editor.save/close), donc on enveloppe ces deux entrées.
    if (typeof window.saveAnnotation === 'function' && !window.saveAnnotation.__evacWrapped) {
        const _origSave = window.saveAnnotation;
        window.saveAnnotation = function() {
            const ret = _origSave.apply(this, arguments);
            // Le save de l'éditeur est async ; on attend un micro-délai pour laisser
            // photoStore['evac_plan'].dataUrl se mettre à jour, puis on synchronise.
            setTimeout(syncEvacBgImage, 50);
            setTimeout(syncEvacBgImage, 250);
            return ret;
        };
        window.saveAnnotation.__evacWrapped = true;
    }
    if (typeof window.closeEditor === 'function' && !window.closeEditor.__evacWrapped) {
        const _origClose = window.closeEditor;
        window.closeEditor = function() {
            const ret = _origClose.apply(this, arguments);
            setTimeout(syncEvacBgImage, 50);
            return ret;
        };
        window.closeEditor.__evacWrapped = true;
    }
    // Synchronisation initiale (au cas où l'éditeur aurait déjà été utilisé avant chargement)
    syncEvacBgImage();

    // ----- Case "Aucun plan d'évacuation disponible" -----
    const noEvac = document.getElementById("noEvacPlan");
    const noEvacComment = document.getElementById("noEvacPlanComment");
    if (noEvac) {
        noEvac.addEventListener("change", () => {
            if (noEvacComment) noEvacComment.style.display = noEvac.checked ? "block" : "none";
            updateGenerateButtonState();
        });
    }

    // ----- Recalculer l'état des boutons à chaque interaction pertinente -----
    // Capture en bouillon : tout changement de fichier ou de texte recalcule.
    document.body.addEventListener("change", (e) => {
        // input[type=file] couvre l'upload de toutes les photos (lieux, écrans, plan évac)
        // Les autres changements n'ont pas d'effet sur la validation mais le coût est négligeable.
        updateGenerateButtonState();
    });

    // État initial du bandeau / des boutons
    updateGenerateButtonState();

    console.log("✅ Audit 4G/5G chargé avec succès");
});

// ---------- CLIC GLOBAL (Annoter / Effacer / Supprimer) ----------
function handleGlobalClick(e) {
    const annBtn = e.target.closest("[data-annotate]");
    if (annBtn) {
        const key = annBtn.dataset.annotate;
        if (!photoStore[key]) {
            alert("Importez d'abord une photo.");
            return;
        }
        if (typeof window.Editor !== 'undefined' && window.Editor.open) {
            window.Editor.open(key, "Photo " + key);
        } else {
            alert("L'éditeur d'annotation n'est pas chargé.");
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
        // Recalcul de l'état des boutons (photo supprimée → peut bloquer la génération)
        if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
        return;
    }

    const delMP = e.target.closest("[data-del-measure]");
    if (delMP) {
        const group = delMP.closest('.measure-point-group');
        if (group && confirm("Supprimer ce point de mesure ?")) {
            const pid = group.dataset.pointId;
            // Supprimer les photos associées
            delete photoStore[`mesure_lieu_${pid}`];
            delete photoStore[`mesure_screen_${pid}`];
            // Supprimer aussi le point sur le plan évac s'il y est placé
            const dot = document.querySelector(`.evac-point[data-pid="${pid}"]`);
            if (dot) dot.remove();
            evacPoints = evacPoints.filter(p => p.pointId !== pid);
            group.remove();
            // Recalculer numérotation interne (header) et picker
            renumberMeasurePoints();
            refreshEvacPicker();
            if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
        }
        return;
    }

    const delChem = e.target.closest("[data-del-chem]");
    if (delChem) {
        const item = delChem.closest('.cheminement-item');
        if (item && confirm("Supprimer ce cheminement ?")) {
            const idx = item.dataset.idx;
            delete photoStore[`cheminement_${idx}`];
            item.remove();
        }
        return;
    }

    // Suppression d'un point sur le plan d'évacuation
    const delEvac = e.target.closest("[data-del-evac]");
    if (delEvac) {
        const pid = delEvac.dataset.delEvac; // string id type "4g-1" ou "travaux-antenne"
        const dot = document.querySelector(`.evac-point[data-pid="${pid}"]`);
        if (dot) dot.remove();
        evacPoints = evacPoints.filter(p => p.pointId !== pid);
        // Le point redevient disponible dans les pickers
        refreshEvacPicker();
        refreshEvacTravauxPicker();
        if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
        return;
    }
}

// ---------- TRAITEMENT PHOTO (centralisé) ----------
async function processPhoto(file, key) {
    if (!file) return;
    try {
        const buf = await file.arrayBuffer();
        const u8 = new Uint8Array(buf);
        const type = file.type.toLowerCase().includes("png") ? "png" : "jpg";
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = ev => resolve(ev.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        // Récupérer les dimensions réelles
        const img = new Image();
        img.src = dataUrl;
        await new Promise(resolve => { img.onload = resolve; });
        const { width: naturalWidth, height: naturalHeight } = img;
        photoStore[key] = {
            data: u8,
            type: type,
            dataUrl: dataUrl,
            naturalWidth: naturalWidth,
            naturalHeight: naturalHeight,
            originalDataUrl: null,
            annotations: null,
            annotated: false
        };
        const preview = document.getElementById("preview_" + key);
        if (preview) {
            preview.src = dataUrl;
            preview.classList.add("shown");
        }
        // Une photo a été ajoutée : recalcule l'état de validation
        if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
    } catch (err) {
        console.error("Erreur photo :", err);
        alert("Impossible de lire cette image.");
    }
}

// ============================================================
//  MATRICE D'INTERPRÉTATION OFFICIELLE (RSRP × SNR)
//  Selon grille fournie par le client.
// ============================================================
const QUALITY_MATRIX = {
    excellent: { // RSRP >= -85 dBm
        ">15":  { label: "Optimal",      color: "#16a34a" },
        "5-15": { label: "Très bon",     color: "#16a34a" },
        "0-5":  { label: "Correct",      color: "#f59e0b" },
        "<0":   { label: "Dégradé",      color: "#6b7280" }
    },
    bon: {       // -85 à -100 dBm
        ">15":  { label: "Très bon",     color: "#16a34a" },
        "5-15": { label: "Bon",          color: "#16a34a" },
        "0-5":  { label: "Acceptable",   color: "#f59e0b" },
        "<0":   { label: "Problématique",color: "#6b7280" }
    },
    faible: {    // -100 à -115 dBm
        ">15":  { label: "Bon",          color: "#16a34a" },
        "5-15": { label: "Acceptable",   color: "#f59e0b" },
        "0-5":  { label: "Limite",       color: "#6b7280" },
        "<0":   { label: "Très dégradé", color: "#dc2626" }
    },
    critique: {  // < -115 dBm
        ">15":  { label: "Utilisable",   color: "#6b7280" },
        "5-15": { label: "Limite",       color: "#6b7280" },
        "0-5":  { label: "Critique",     color: "#dc2626" },
        "<0":   { label: "Inutilisable", color: "#dc2626" }
    }
};

function classifyRSRP(rsrp) {
    if (isNaN(rsrp)) return null;
    if (rsrp >= -85)  return "excellent";
    if (rsrp >= -100) return "bon";
    if (rsrp >= -115) return "faible";
    return "critique";
}

function classifySNR(snr) {
    if (isNaN(snr)) return null;
    if (snr > 15) return ">15";
    if (snr >= 5) return "5-15";
    if (snr >= 0) return "0-5";
    return "<0";
}

function evaluateQuality(rsrp, snr) {
    const r = classifyRSRP(rsrp);
    const s = classifySNR(snr);
    if (!r || !s) return null;
    return QUALITY_MATRIX[r][s];
}

// ---------- ANALYSE AUTOMATIQUE D'UN POINT ----------
function analyzePoint(group) {
    const rsrp = parseFloat(group.querySelector('.measure-rsrp').value);
    const snr  = parseFloat(group.querySelector('.measure-sinr').value); // SINR = SNR ici
    const resultSpan = group.querySelector('.analysis-result');
    if (!resultSpan) return;

    const q = evaluateQuality(rsrp, snr);
    if (!q) {
        resultSpan.textContent = "En attente de données (RSRP + SNR requis)";
        resultSpan.style.background = "#e5e7eb";
        resultSpan.style.color = "#374151";
        group.dataset.analysisLabel = "";
        group.dataset.analysisColor = "";
        // Rafraîchir picker (couleur du dot peut changer)
        if (typeof refreshEvacPicker === "function") refreshEvacPicker();
        if (typeof refreshAllEvacPointColors === "function") refreshAllEvacPointColors();
        return;
    }
    resultSpan.textContent = q.label;
    resultSpan.style.background = q.color;
    resultSpan.style.color = "#ffffff";
    group.dataset.analysisLabel = q.label;
    group.dataset.analysisColor = q.color;

    // Synchroniser la couleur du point évac correspondant
    if (typeof refreshAllEvacPointColors === "function") {
        refreshAllEvacPointColors();
    }
    if (typeof refreshEvacPicker === "function") {
        refreshEvacPicker();
    }
}

// ---------- POINTS DE MESURE DYNAMIQUES (par techno : 4G / 5G) ----------
function initMeasurePoints() {
    const c4 = document.getElementById("measurePointsContainer4G");
    const c5 = document.getElementById("measurePointsContainer5G");
    if (c4 && c4.children.length === 0) {
        for (let i = 1; i <= 3; i++) addMeasurePoint("4g");
    }
    if (c5 && c5.children.length === 0) {
        for (let i = 1; i <= 3; i++) addMeasurePoint("5g");
    }
}

// tech : "4g" | "5g"
function addMeasurePoint(tech) {
    if (tech !== "4g" && tech !== "5g") tech = "4g";
    const containerId = tech === "4g" ? "measurePointsContainer4G" : "measurePointsContainer5G";
    const container = document.getElementById(containerId);
    if (!container) return;

    let count;
    if (tech === "4g") {
        measureCounter4G++;
        count = measureCounter4G;
    } else {
        measureCounter5G++;
        count = measureCounter5G;
    }

    // pointId stable utilisé partout (DOM, photoStore, evacPoints) : "4g-1", "5g-2"
    const pid = `${tech}-${count}`;
    const techLabel = tech === "4g" ? "4G" : "5G";

    const div = document.createElement("div");
    div.className = "measure-point-group";
    div.dataset.point = count;
    div.dataset.tech = tech;
    div.dataset.pointId = pid;
    div.innerHTML = `
        <div class="mp-header">
            <h4>📍 Point de mesure ${techLabel} ${count}</h4>
            <button class="btn-delete" data-del-measure title="Supprimer ce point">🗑</button>
        </div>
        <input type="text" class="point-lieu mp-field" placeholder="Lieu / Pièce (ex: Bureau Direction, Local Technique RDC...)">

        <div class="mp-photos">
            <div class="mp-photo-block">
                <label class="mp-photo-label">📷 Photo du lieu</label>
                <input type="file" accept="image/*" data-photo-type="lieu">
                <img id="preview_mesure_lieu_${pid}" class="photo-preview">
                <div class="mp-photo-actions">
                    <button class="annotate-btn" data-annotate="mesure_lieu_${pid}" disabled>✏ Annoter</button>
                    <button class="clear-btn" data-clear="mesure_lieu_${pid}">🗑 Effacer</button>
                </div>
            </div>
            <div class="mp-photo-block">
                <label class="mp-photo-label">📱 Copie écran mesure</label>
                <input type="file" accept="image/*" data-photo-type="screen">
                <img id="preview_mesure_screen_${pid}" class="photo-preview">
                <div class="mp-photo-actions">
                    <button class="annotate-btn" data-annotate="mesure_screen_${pid}" disabled>✏ Annoter</button>
                    <button class="clear-btn" data-clear="mesure_screen_${pid}">🗑 Effacer</button>
                </div>
            </div>
        </div>

        <div class="mp-measures">
            <div class="mp-measure-cell">
                <label>RSRP <span class="unit">(dBm)</span></label>
                <input type="number" step="0.1" class="measure-rsrp" placeholder="ex: -82">
            </div>
            <div class="mp-measure-cell">
                <label>RSRQ <span class="unit">(dB)</span></label>
                <input type="number" step="0.1" class="measure-rsrq" placeholder="ex: -10">
            </div>
            <div class="mp-measure-cell">
                <label>SNR / SINR <span class="unit">(dB)</span></label>
                <input type="number" step="0.1" class="measure-sinr" placeholder="ex: 18">
            </div>
            <div class="mp-measure-cell">
                <label>↓ Débit desc. <span class="unit">(Mbps)</span></label>
                <input type="number" step="0.1" class="measure-down" placeholder="ex: 120">
            </div>
            <div class="mp-measure-cell">
                <label>↑ Débit mont. <span class="unit">(Mbps)</span></label>
                <input type="number" step="0.1" class="measure-up" placeholder="ex: 35">
            </div>
            <div class="mp-measure-cell">
                <label>Bande / Techno</label>
                <input type="text" class="measure-band" placeholder="${tech === '4g' ? 'ex: B7 4G+' : 'ex: n78 5G'}">
            </div>
        </div>

        <div class="mp-analysis">
            <strong>🎯 Qualité globale :</strong>
            <span class="analysis-result">En attente de données (RSRP + SNR requis)</span>
        </div>
    `;
    container.appendChild(div);

    div.querySelectorAll('input[type="file"]').forEach(inp => {
        inp.addEventListener("change", async (e) => {
            const type = e.target.dataset.photoType;
            const key = `mesure_${type}_${pid}`;
            await processPhoto(e.target.files[0], key);
            const annBtn = div.querySelector(`[data-annotate="${key}"]`);
            if (annBtn) annBtn.disabled = false;
        });
    });

    div.querySelectorAll('input.measure-rsrp, input.measure-sinr').forEach(inp => {
        inp.addEventListener('input', () => analyzePoint(div));
    });

    // Mettre à jour le label si l'utilisateur change le nom du lieu
    const lieuInput = div.querySelector('.point-lieu');
    if (lieuInput) {
        lieuInput.addEventListener('input', () => {
            // Mettre à jour le label affiché sur le plan évac (si placé)
            updateEvacPointLabel(pid);
            // Rafraîchir picker (le nom affiché change)
            refreshEvacPicker();
        });
    }

    // Si le plan d'évacuation est visible, mettre à jour la liste
    refreshEvacPicker();
    if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
}

// Renumérote l'affichage des en-têtes "Point de mesure 4G N" après suppression
function renumberMeasurePoints() {
    ["4g", "5g"].forEach(tech => {
        const cont = document.getElementById(tech === "4g" ? "measurePointsContainer4G" : "measurePointsContainer5G");
        if (!cont) return;
        const techLabel = tech === "4g" ? "4G" : "5G";
        let i = 0;
        cont.querySelectorAll('.measure-point-group').forEach(g => {
            i++;
            const h4 = g.querySelector('.mp-header h4');
            if (h4) h4.textContent = `📍 Point de mesure ${techLabel} ${i}`;
            // On NE change PAS dataset.pointId pour ne pas casser les associations
            // (photos, points évac déjà placés). On met juste à jour le label visuel.
            g.dataset.point = i;
        });
    });
}

// ---------- PLAN D'ÉVACUATION ----------
function handleEvacUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const dataUrl = ev.target.result;
        const buf = await file.arrayBuffer();
        photoStore['evac_plan'] = {
            data: new Uint8Array(buf),
            type: file.type.includes("png") ? "png" : "jpg",
            dataUrl: dataUrl
        };
        const stage = document.getElementById('evacStageContainer');
        const upArea = document.getElementById('evacUploadArea');
        const bgImg = document.getElementById('evacBgImage');
        if (stage) stage.style.display = 'block';
        if (bgImg) bgImg.src = dataUrl;
        if (upArea) upArea.style.display = 'none';
        // Afficher la liste des points disponibles
        refreshEvacPicker();
        refreshEvacTravauxPicker();
        if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
    };
    reader.readAsDataURL(file);
}

// Helpers : trouver le groupe DOM correspondant à un pointId ("4g-1", "5g-2"...)
function getMeasureGroupByPid(pid) {
    if (!pid) return null;
    return document.querySelector(`.measure-point-group[data-point-id="${pid}"]`);
}

// Récupérer tous les points existants dans l'ordre 4G puis 5G
function getAllMeasurePoints() {
    const all = [];
    ["4g", "5g"].forEach(tech => {
        const cont = document.getElementById(tech === "4g" ? "measurePointsContainer4G" : "measurePointsContainer5G");
        if (!cont) return;
        cont.querySelectorAll('.measure-point-group').forEach(g => {
            all.push(g);
        });
    });
    return all;
}

// Donne le nom à afficher pour un point (lieu ou fallback)
// Donne le nom à afficher pour un point (avec préfixe 4G/5G)
function getPointDisplayName(group) {
    if (!group) return "Point non nommé";

    // Détermination du préfixe techno
    const tech = (group.dataset.tech === "5g") ? "5G" : "4G";

    const lieuInput = group.querySelector('.point-lieu');
    const lieu = lieuInput ? lieuInput.value.trim() : "";

    if (lieu) {
        return `${tech} - ${lieu}`;
    } else {
        const pointNum = group.dataset.point || "X";
        return `${tech} - Point ${pointNum}`;
    }
}

// Construit / met à jour la liste des points disponibles à placer sur le plan
function refreshEvacPicker() {
    const wrap = document.getElementById('evacPointsPickerWrap');
    const picker = document.getElementById('evacPointsPicker');
    if (!wrap || !picker) return;

    // La liste n'est visible qu'une fois le plan importé
    const planLoaded = !!photoStore['evac_plan'];
    wrap.style.display = planLoaded ? 'block' : 'none';
    if (!planLoaded) return;

    const placedIds = new Set(evacPoints.map(p => p.pointId));
    const groups = getAllMeasurePoints();

    picker.innerHTML = "";
    if (groups.length === 0) {
        picker.innerHTML = `<span class="evac-pp-empty">Aucun point de mesure défini. Ajoutez-en dans la section 3.</span>`;
        return;
    }

    groups.forEach(g => {
        const pid = g.dataset.pointId;
        const tech = g.dataset.tech || "4g";
        const name = getPointDisplayName(g);
        const placed = placedIds.has(pid);

        const item = document.createElement('div');
        item.className = `evac-pp-item${placed ? " placed" : ""}`;
        item.dataset.pid = pid;
        item.dataset.tech = tech;
        item.innerHTML = `<span class="pp-tech-dot tech-${tech}"></span><span class="pp-name">${escapeHtml(name)}</span><span class="pp-tech-tag">(${tech.toUpperCase()})</span>`;
        if (!placed) {
            item.addEventListener('click', () => placeEvacPoint(pid));
        } else {
            // Item déjà placé → clic affiche la popup (impossible de re-ajouter)
            item.addEventListener('click', () => {
                showEvacPopup("Ce point est déjà placé sur le plan. Supprimez-le d'abord pour le replacer.");
            });
        }
        picker.appendChild(item);
    });

    // Si TOUS les points existants sont placés, afficher un état "complet"
    const allPlaced = groups.length > 0 && placedIds.size >= groups.length;
    if (allPlaced) {
        const info = document.createElement('div');
        info.className = 'evac-pp-empty';
        info.style.marginTop = '8px';
        info.textContent = "Tous les points existants sont déjà placés sur le plan.";
        picker.appendChild(info);
    }
}

// Petit helper d'échappement HTML pour le nom du point
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Place un point existant (par pid) sur le plan d'évacuation
function placeEvacPoint(pid) {
    const wrap = document.getElementById('evacStageWrap');
    const bgImg = document.getElementById('evacBgImage');
    if (!wrap || !bgImg || !bgImg.src) {
        showEvacPopup("Importez d'abord un plan d'évacuation.");
        return;
    }
    // Déjà placé ?
    if (evacPoints.some(p => p.pointId === pid)) return;

    // Vérifier que le point existe encore
    const group = getMeasureGroupByPid(pid);
    if (!group) {
        showEvacPopup("Ce point n'existe plus dans le formulaire.");
        refreshEvacPicker();
        return;
    }

    const pointState = {
        pointId: pid,
        leftPct: 50,
        topPct: 50,
        size: 60   // diamètre du halo en px
    };
    evacPoints.push(pointState);
    renderEvacPoint(pointState);
    refreshAllEvacPointColors();
    refreshEvacPicker();
    if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();

    // Si tous les points sont maintenant placés, popup info (sans bloquer)
    const total = getAllMeasurePoints().length;
    if (evacPoints.length >= total && total > 0) {
        // pas obligatoire ici — affichage seulement si l'utilisateur tente d'en ajouter encore
    }
}

// Popup helpers
function showEvacPopup(msg) {
    const txt = document.getElementById('evacPopupText');
    const overlay = document.getElementById('evacPopup');
    if (txt) txt.textContent = msg;
    if (overlay) overlay.classList.add('shown');
}
function closeEvacPopup() {
    const overlay = document.getElementById('evacPopup');
    if (overlay) overlay.classList.remove('shown');
}
window.closeEvacPopup = closeEvacPopup;

// (Re)dessiner un point sur le plan d'évacuation à partir de son état
function renderEvacPoint(state) {
    const wrap = document.getElementById('evacStageWrap');
    if (!wrap) return;
    const old = wrap.querySelector(`.evac-point[data-pid="${state.pointId}"]`);
    if (old) old.remove();

    const group = getMeasureGroupByPid(state.pointId);
    const tech = (group && group.dataset.tech) || (String(state.pointId).startsWith("5g") ? "5g" : "4g");
    const name = getPointDisplayName(group);

    const dot = document.createElement('div');
    dot.className = 'evac-point';
    dot.dataset.pid = state.pointId;
    dot.dataset.tech = tech;
    dot.style.left = state.leftPct + '%';
    dot.style.top = state.topPct + '%';
    dot.style.width  = state.size + 'px';
    dot.style.height = state.size + 'px';
    dot.innerHTML = `
        <div class="evac-halo"></div>
        <div class="evac-core"></div>
        <div class="evac-pin"><span class="pin-tech tech-${tech}"></span><span class="pin-name">${escapeHtml(name)}</span></div>
        <div class="evac-resize" title="Étirer pour agrandir le halo">⤢</div>
        <div class="evac-del" data-del-evac="${state.pointId}" title="Supprimer">✕</div>
    `;
    wrap.appendChild(dot);
    makeEvacInteractive(dot, state, wrap);
}

// Mettre à jour le label affiché d'un point évac (quand on change le nom du lieu)
function updateEvacPointLabel(pid) {
    const dot = document.querySelector(`.evac-point[data-pid="${pid}"]`);
    if (!dot) return;
    const group = getMeasureGroupByPid(pid);
    const name = getPointDisplayName(group);
    const nameSpan = dot.querySelector('.evac-pin .pin-name');
    if (nameSpan) nameSpan.textContent = name;
}

// Drag + Resize sur un point d'évacuation (souris + tactile)
function makeEvacInteractive(el, state, container) {
    const halo = el.querySelector('.evac-halo');
    const core = el.querySelector('.evac-core');
    const handle = el.querySelector('.evac-resize');

    let mode = null; // 'drag' ou 'resize'
    let startX = 0, startY = 0, startSize = state.size;

    const getPoint = (e) => {
        if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    };

    const onDown = (e) => {
        const target = e.target;
        if (target.classList.contains('evac-del')) return;
        if (target.classList.contains('evac-resize')) {
            mode = 'resize';
            startSize = state.size;
        } else {
            mode = 'drag';
        }
        const pt = getPoint(e);
        startX = pt.x; startY = pt.y;
        e.preventDefault();
        e.stopPropagation();
    };

    const onMove = (e) => {
        if (!mode) return;
        const pt = getPoint(e);
        const dx = pt.x - startX;
        const dy = pt.y - startY;

        if (mode === 'drag') {
            const rect = container.getBoundingClientRect();
            // position actuelle en px → convertir + ajouter le delta → reconvertir en %
            const curX = (state.leftPct / 100) * rect.width;
            const curY = (state.topPct  / 100) * rect.height;
            const newX = Math.max(0, Math.min(rect.width,  curX + dx));
            const newY = Math.max(0, Math.min(rect.height, curY + dy));
            state.leftPct = (newX / rect.width)  * 100;
            state.topPct  = (newY / rect.height) * 100;
            el.style.left = state.leftPct + '%';
            el.style.top  = state.topPct  + '%';
            startX = pt.x; startY = pt.y;
        } else if (mode === 'resize') {
            // Le delta diagonal donne la nouvelle taille
            const delta = Math.max(dx, dy);
            const newSize = Math.max(20, Math.min(400, startSize + delta));
            state.size = newSize;
            el.style.width  = newSize + 'px';
            el.style.height = newSize + 'px';
        }
    };

    const onUp = () => { mode = null; };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchend', onUp);
}

// Met à jour les couleurs de tous les points évac selon les points de mesure correspondants
function refreshAllEvacPointColors() {
    evacPoints.forEach((state) => {
        const grp = getMeasureGroupByPid(state.pointId);
        const colorHex = (grp && grp.dataset.analysisColor)
            ? grp.dataset.analysisColor
            : "#dc2626"; // rouge par défaut si pas de mesure correspondante
        applyEvacPointColor(state.pointId, colorHex);
    });
}

function applyEvacPointColor(pid, colorHex) {
    const el = document.querySelector(`.evac-point[data-pid="${pid}"]`);
    if (!el) return;
    const hex = colorHex.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const halo = el.querySelector('.evac-halo');
    const core = el.querySelector('.evac-core');
    if (halo) {
        halo.style.background = `radial-gradient(circle, rgba(${r},${g},${b},0.55) 0%, rgba(${r},${g},${b},0.25) 40%, rgba(${r},${g},${b},0) 75%)`;
    }
    if (core) {
        core.style.background = colorHex;
    }
    el.dataset.color = colorHex;
}

// ============================================================
//  MODE TRAVAUX — BASCULE DYNAMIQUE
// ============================================================

// Repères fixes du plan d'évacuation en mode TRAVAUX
const EVAC_TRAVAUX_MARKERS = [
    { id: "antenne",        label: "Antenne",                       color: "#dc2626", tech: "4g" },
    { id: "routeur",        label: "Routeur",                       color: "#1f3864", tech: "4g" },
    { id: "mesure_4g_post", label: "Mesure 4G après installation",  color: "#2e75b6", tech: "4g" },
    { id: "mesure_5g_post", label: "Mesure 5G après installation",  color: "#16a34a", tech: "5g" }
];

// Adapte dynamiquement la section 3 (mesures) au mode actif :
// - en TRAVAUX : ne conserver qu'un seul bloc 4G et un seul bloc 5G (les autres sont masqués mais conservés)
// - en AUDIT   : réafficher tous les blocs
function applyTravauxLayout(mode) {
    ["4g", "5g"].forEach(tech => {
        const cont = document.getElementById(tech === "4g"
            ? "measurePointsContainer4G"
            : "measurePointsContainer5G");
        if (!cont) return;
        const groups = cont.querySelectorAll('.measure-point-group');
        groups.forEach((g, idx) => {
            if (mode === "travaux") {
                // On ne montre que le premier bloc en travaux
                g.style.display = (idx === 0) ? "" : "none";
            } else {
                // En audit on réaffiche tout
                g.style.display = "";
            }
        });
        // S'il n'existe encore aucun bloc et qu'on est en travaux, en créer un seul
        if (mode === "travaux" && groups.length === 0) {
            addMeasurePoint(tech);
        }
    });

    // Rafraîchir les pickers car la visibilité influence ce qui est plaçable
    refreshEvacPicker();
    refreshEvacTravauxPicker();

    // Recalculer la validation : les règles métier sont différentes selon le mode
    if (typeof updateGenerateButtonState === "function") {
        updateGenerateButtonState();
    }
}
window.applyTravauxLayout = applyTravauxLayout;

// Rafraîchit le picker spécifique au mode TRAVAUX (4 repères fixes)
function refreshEvacTravauxPicker() {
    const wrap = document.getElementById('evacTravauxPickerWrap');
    const picker = document.getElementById('evacTravauxPicker');
    if (!wrap || !picker) return;

    const planLoaded = !!photoStore['evac_plan'];
    wrap.style.display = planLoaded ? 'block' : 'none';
    if (!planLoaded) return;

    const placedIds = new Set(evacPoints.map(p => p.pointId));

    picker.innerHTML = "";
    EVAC_TRAVAUX_MARKERS.forEach(m => {
        const pid = `travaux-${m.id}`;
        const placed = placedIds.has(pid);
        const item = document.createElement('div');
        item.className = `evac-pp-item${placed ? " placed" : ""}`;
        item.dataset.pid = pid;
        item.dataset.tech = m.tech;
        item.innerHTML = `<span class="pp-tech-dot tech-${m.tech}"></span><span class="pp-name">${escapeHtml(m.label)}</span>`;
        if (!placed) {
            item.addEventListener('click', () => placeEvacTravauxMarker(m));
        } else {
            item.addEventListener('click', () => {
                showEvacPopup("Ce repère est déjà placé sur le plan. Supprimez-le d'abord pour le replacer.");
            });
        }
        picker.appendChild(item);
    });
}

// Place un repère "travaux" sur le plan d'évacuation
function placeEvacTravauxMarker(marker) {
    const wrap = document.getElementById('evacStageWrap');
    const bgImg = document.getElementById('evacBgImage');
    if (!wrap || !bgImg || !bgImg.src) {
        showEvacPopup("Importez d'abord un plan d'évacuation.");
        return;
    }
    const pid = `travaux-${marker.id}`;
    if (evacPoints.some(p => p.pointId === pid)) return;

    const pointState = {
        pointId: pid,
        leftPct: 50,
        topPct: 50,
        size: 60,
        travauxLabel: marker.label,
        travauxColor: marker.color,
        travauxTech: marker.tech
    };
    evacPoints.push(pointState);
    renderEvacTravauxPoint(pointState);
    refreshEvacTravauxPicker();
    if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
}

// Rend un repère "travaux" sur le plan (forme similaire aux points 4G/5G classiques)
function renderEvacTravauxPoint(state) {
    const wrap = document.getElementById('evacStageWrap');
    if (!wrap) return;
    const old = wrap.querySelector(`.evac-point[data-pid="${state.pointId}"]`);
    if (old) old.remove();

    const tech = state.travauxTech || "4g";
    const label = state.travauxLabel || "Repère";

    const dot = document.createElement('div');
    dot.className = 'evac-point';
    dot.dataset.pid = state.pointId;
    dot.dataset.tech = tech;
    dot.dataset.travaux = "1";
    dot.style.left = state.leftPct + '%';
    dot.style.top  = state.topPct  + '%';
    dot.style.width  = state.size + 'px';
    dot.style.height = state.size + 'px';
    dot.innerHTML = `
        <div class="evac-halo"></div>
        <div class="evac-core"></div>
        <div class="evac-pin"><span class="pin-tech tech-${tech}"></span><span class="pin-name">${escapeHtml(label)}</span></div>
        <div class="evac-resize" title="Étirer pour agrandir le halo">⤢</div>
        <div class="evac-del" data-del-evac="${state.pointId}" title="Supprimer">✕</div>
    `;
    wrap.appendChild(dot);

    // Appliquer la couleur fixe du repère (pas de calcul depuis une mesure)
    const colorHex = state.travauxColor || "#dc2626";
    applyEvacPointColor(state.pointId, colorHex);

    makeEvacInteractive(dot, state, wrap);
}

// Met à jour l'image affichée du plan d'évacuation à partir du photoStore.
// Utilisé après chaque fermeture de l'éditeur pour que les annotations
// (flèches, cercles, textes, tracés) apparaissent directement dans le formulaire.
function syncEvacBgImage() {
    const photo = photoStore && photoStore['evac_plan'];
    if (!photo || !photo.dataUrl) return;
    const bg = document.getElementById('evacBgImage');
    if (bg && bg.src !== photo.dataUrl) {
        bg.src = photo.dataUrl;
    }
}

// Supprime entièrement le plan d'évacuation (photo + points placés) et restaure
// la zone d'upload. Permet au technicien de repartir d'une nouvelle photo
// s'il s'est trompé sans devoir recommencer tout le formulaire.
function deleteEvacPlan() {
    if (!photoStore['evac_plan'] && evacPoints.length === 0) {
        // Rien à supprimer
        return;
    }
    if (!confirm("Supprimer le plan d'évacuation actuel ? Cette action retire aussi tous les points et repères déjà placés. Les autres données du formulaire sont conservées.")) {
        return;
    }

    // 1) Effacer la photo du store
    delete photoStore['evac_plan'];

    // 2) Vider l'état des points placés et retirer leur rendu DOM
    evacPoints = [];
    const wrap = document.getElementById('evacStageWrap');
    if (wrap) {
        wrap.querySelectorAll('.evac-point').forEach(el => el.remove());
    }

    // 3) Vider l'image affichée
    const bgImg = document.getElementById('evacBgImage');
    if (bgImg) bgImg.src = "";

    // 4) Cacher le stage, ré-afficher la zone d'upload
    const stage = document.getElementById('evacStageContainer');
    const upArea = document.getElementById('evacUploadArea');
    if (stage) stage.style.display = 'none';
    if (upArea) upArea.style.display = '';

    // 5) Vider l'input file pour permettre de re-sélectionner même fichier
    const fileInput = document.getElementById('evacFileInput');
    if (fileInput) fileInput.value = "";

    // 6) Rafraîchir les deux pickers (ils se cachent automatiquement si pas de plan)
    refreshEvacPicker();
    refreshEvacTravauxPicker();

    // 7) Recalculer la validation (le plan manquant peut bloquer la génération)
    if (typeof updateGenerateButtonState === "function") updateGenerateButtonState();
}

// ============================================================
// CHEMINEMENT
// ============================================================
function addCheminementItem() {
    const container = document.getElementById('cheminementContainer');
    if (!container) return;
    cheminementCounter++;
    const idx = cheminementCounter;
    const div = document.createElement('div');
    div.className = 'cheminement-item';
    div.dataset.idx = idx;
    div.innerHTML = `
        <div class="chem-header">
            <strong>📷 Photo Cheminement ${idx}</strong>
            <button class="btn-delete" data-del-chem title="Supprimer">🗑</button>
        </div>
        <input type="file" accept="image/*">
        <img class="photo-preview" id="preview_cheminement_${idx}">
        <div class="chem-actions">
            <button class="annotate-btn" data-annotate="cheminement_${idx}" disabled>✏ Annoter</button>
            <button class="clear-btn" data-clear="cheminement_${idx}">🗑 Effacer</button>
        </div>
        <textarea class="cheminement-comment" placeholder="Description du cheminement (point de pénétration, longueur estimée, type de support, étanchéité...)"></textarea>
    `;
    container.appendChild(div);
    div.querySelector('input[type="file"]').addEventListener('change', async (e) => {
        await processPhoto(e.target.files[0], `cheminement_${idx}`);
        const annBtn = div.querySelector('.annotate-btn');
        if (annBtn) annBtn.disabled = false;
    });
}

// ---------- COMPOSER LE PLAN D'ÉVACUATION + POINTS POUR LE WORD ----------
async function composeEvacPlanWithPoints() {
    const photo = photoStore['evac_plan'];
    if (!photo) return null;
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // Récupérer la taille du conteneur d'affichage pour convertir size px → coord image
            const wrap = document.getElementById('evacStageWrap');
            const wrapRect = wrap ? wrap.getBoundingClientRect() : { width: img.naturalWidth, height: img.naturalHeight };
            const scaleX = img.naturalWidth  / Math.max(1, wrapRect.width);
            const scaleY = img.naturalHeight / Math.max(1, wrapRect.height);

            evacPoints.forEach((state) => {
                const isTravaux = !!state.travauxLabel;
                const grp = isTravaux ? null : getMeasureGroupByPid(state.pointId);
                let colorHex;
                if (isTravaux) {
                    colorHex = state.travauxColor || "#dc2626";
                } else {
                    colorHex = (grp && grp.dataset.analysisColor) ? grp.dataset.analysisColor : "#dc2626";
                }
                const hex = colorHex.replace("#","");
                const r = parseInt(hex.substring(0,2),16);
                const g = parseInt(hex.substring(2,4),16);
                const b = parseInt(hex.substring(4,6),16);

                // Position en px image
                const cx = (state.leftPct / 100) * img.naturalWidth;
                const cy = (state.topPct  / 100) * img.naturalHeight;
                // Taille du halo en px image
                const haloR = (state.size / 2) * Math.max(scaleX, scaleY);

                // Halo (gradient radial)
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, haloR);
                grad.addColorStop(0,    `rgba(${r},${g},${b},0.55)`);
                grad.addColorStop(0.4,  `rgba(${r},${g},${b},0.25)`);
                grad.addColorStop(0.75, `rgba(${r},${g},${b},0)`);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
                ctx.fill();

                // Dot central (compact)
                const coreR = Math.max(6, 7 * Math.max(scaleX, scaleY));
                ctx.fillStyle = "white";
                ctx.beginPath();
                ctx.arc(cx, cy, coreR + 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = colorHex;
                ctx.beginPath();
                ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
                ctx.fill();

                // Label = nom réel du point, à proximité du centre (pas du bord du halo)
                const labelTxt = isTravaux ? state.travauxLabel : getPointDisplayName(grp);
                const fontSize = Math.max(14, 14 * Math.max(scaleX, scaleY));
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                const metrics = ctx.measureText(labelTxt);
                const padX = 8, padY = 4;
                const labelW = metrics.width + padX * 2;
                const labelH = fontSize + padY * 2;
                // Positionnement légèrement au-dessus et à droite du centre du cercle
                // Distance fixe par rapport au dot, NE dépend PAS de la taille du halo
                const offsetX = coreR + 6;
                const offsetY = -(coreR + labelH + 6);
                const labelX = cx + offsetX;
                const labelY = cy + offsetY;
                // bg blanc avec bordure bleue
                ctx.fillStyle = "white";
                ctx.strokeStyle = "#1F4E79";
                ctx.lineWidth = 1.5;
                roundRect(ctx, labelX, labelY, labelW, labelH, 4, true, true);
                ctx.fillStyle = "#1F4E79";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(labelTxt, labelX + labelW / 2, labelY + labelH / 2);
            });

            // Convertir le canvas en Uint8Array PNG
            canvas.toBlob(async (blob) => {
                if (!blob) return resolve(null);
                const buf = await blob.arrayBuffer();
                const u8 = new Uint8Array(buf);
                // Calculer dimensions d'affichage (max 500 de large)
                const ratio = img.naturalHeight / img.naturalWidth;
                const dispW = 500;
                const dispH = Math.round(dispW * ratio);
                resolve({ data: u8, dispW: dispW, dispH: dispH });
            }, 'image/png');
        };
        img.onerror = () => resolve(null);
        img.src = photo.dataUrl;
    });
}

// Helper : rectangle arrondi
function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === 'undefined') r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
}

// ============================================================
//  GÉNÉRATION WORD — STYLE STARLINK
// ============================================================
// ---------- VALIDATION ----------
// Règles métier différentes selon le mode :
//   AUDIT :
//     1. Au moins 3 points 4G et 3 points 5G doivent exister.
//     2. Chaque point doit avoir SES DEUX photos (lieu + écran) → min 12 photos.
//     3. Tous les points doivent être placés sur le plan d'évacuation,
//        SAUF si "Aucun plan d'évacuation disponible" est cochée.
//   TRAVAUX :
//     1. Une mesure 4G + une mesure 5G renseignées (RSRP + SNR au minimum).
//     2. Chaque mesure (visible) doit avoir ses 2 photos (lieu + écran).
//     3. Photo de l'installation du routeur 4G présente.
//     4. Plan d'évacuation présent avec au moins les repères Antenne ET Routeur
//        placés (sauf si "Aucun plan d'évacuation disponible" est cochée).
function validateMeasurementPoints() {
    const mode = (document.getElementById("modeIntervention")?.value) || "audit";
    const errors = [];

    // Points existants (on itère sur le DOM, pas sur des pointId hardcodés)
    const container4G = document.getElementById("measurePointsContainer4G");
    const container5G = document.getElementById("measurePointsContainer5G");
    let points4G = container4G ? Array.from(container4G.querySelectorAll(".measure-point-group")) : [];
    let points5G = container5G ? Array.from(container5G.querySelectorAll(".measure-point-group")) : [];

    // En mode TRAVAUX, on ne valide que les blocs réellement visibles (les autres
    // sont conservés en DOM mais display:none).
    if (mode === "travaux") {
        const visible = (el) => el && el.offsetParent !== null && el.style.display !== "none";
        points4G = points4G.filter(visible);
        points5G = points5G.filter(visible);
    }

    // ----- Quota minimum de points par techno -----
    const minPoints = (mode === "travaux") ? 1 : 3;
    if (points4G.length < minPoints) {
        errors.push(`Il faut au moins ${minPoints} mesure${minPoints>1?"s":""} 4G (actuellement : ${points4G.length}).`);
    }
    if (points5G.length < minPoints) {
        errors.push(`Il faut au moins ${minPoints} mesure${minPoints>1?"s":""} 5G (actuellement : ${points5G.length}).`);
    }

    // ----- Photos lieu + écran pour chaque point visible -----
    let photoCount = 0;
    const missingPhotos = [];
    const allPoints = [...points4G, ...points5G];
    allPoints.forEach((group, idx) => {
        const pid = group.dataset.pointId;
        if (!pid) return;
        const hasLieu = !!photoStore[`mesure_lieu_${pid}`];
        const hasScreen = !!photoStore[`mesure_screen_${pid}`];
        if (hasLieu) photoCount++;
        if (hasScreen) photoCount++;
        if (!hasLieu || !hasScreen) {
            const tech = (group.dataset.tech || "4g").toUpperCase();
            const num = group.dataset.point || (idx + 1);
            const missingParts = [];
            if (!hasLieu) missingParts.push("photo du lieu");
            if (!hasScreen) missingParts.push("copie d'écran");
            missingPhotos.push(`Mesure ${tech} ${num} : ${missingParts.join(" + ")} manquante(s)`);
        }
    });

    // Quota minimum de photos : 2 photos par point visible
    const minPhotos = allPoints.length * 2;
    if (photoCount < minPhotos) {
        if (mode === "travaux") {
            errors.push(`Il faut ${minPhotos} photos dans la section 3 — Mesures radio 4G/5G (actuellement : ${photoCount}/${minPhotos}). Chaque mesure doit avoir sa photo du lieu ET sa copie d'écran.`);
        } else {
            errors.push(`Il faut au moins 12 photos dans la section 3 — Mesures radio 4G/5G (actuellement : ${photoCount}/12). Chaque point doit avoir sa photo du lieu ET sa copie d'écran.`);
        }
        missingPhotos.slice(0, 6).forEach(m => errors.push("• " + m));
    }

    // ----- En mode TRAVAUX : photo de l'installation du routeur 4G obligatoire -----
    if (mode === "travaux") {
        if (!photoStore["routeur_install"]) {
            errors.push("Importez la photo de l'installation du routeur 4G (section 3).");
        }
    }

    // ----- Plan d'évacuation -----
    const noPlanCheckbox = document.getElementById("noEvacPlan");
    const noPlan = !!(noPlanCheckbox && noPlanCheckbox.checked);

    if (!noPlan) {
        const planLoaded = !!photoStore['evac_plan'];
        if (!planLoaded) {
            errors.push("Importez le plan d'évacuation dans la section 4 (ou cochez « Aucun plan d'évacuation disponible » si le site n'en dispose pas).");
        } else {
            const placedIds = new Set(evacPoints.map(p => p.pointId));
            if (mode === "travaux") {
                // En TRAVAUX : les repères Antenne et Routeur sont obligatoires sur le plan.
                if (!placedIds.has("travaux-antenne")) {
                    errors.push("Placez le repère « Antenne » sur le plan d'évacuation.");
                }
                if (!placedIds.has("travaux-routeur")) {
                    errors.push("Placez le repère « Routeur » sur le plan d'évacuation.");
                }
            } else {
                // En AUDIT : tous les points 4G/5G existants doivent être placés.
                const notPlaced = allPoints.filter(g => !placedIds.has(g.dataset.pointId));
                if (notPlaced.length > 0) {
                    errors.push(`${notPlaced.length} point(s) de mesure n'est/ne sont pas positionné(s) sur le plan d'évacuation :`);
                    notPlaced.slice(0, 6).forEach(g => {
                        const tech = (g.dataset.tech || "4g").toUpperCase();
                        const num = g.dataset.point || "?";
                        errors.push(`• Point ${tech} ${num}`);
                    });
                }
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors,
        photoCount: photoCount,
        points4GCount: points4G.length,
        points5GCount: points5G.length,
        noPlan: noPlan,
        mode: mode
    };
}

// ---------- ÉTAT TEMPS RÉEL DES BOUTONS Export JSON / Générer Word ----------
// Met à jour l'apparence des boutons et le bandeau d'avertissement selon la validation.
function updateGenerateButtonState() {
    const v = validateMeasurementPoints();
    const btnWord = document.getElementById("btnGenerateWord");
    const btnJson = document.getElementById("btnExportJSON");
    const banner = document.getElementById("validationBanner");

    if (btnWord) btnWord.disabled = !v.valid;
    if (btnJson) btnJson.disabled = !v.valid;

    if (!banner) return;

    if (v.valid) {
        banner.className = "banner-ok";
        banner.style.display = "block";
        const _titre = (v.mode === "travaux")
            ? "✅ Travaux complets — Génération autorisée"
            : "✅ Audit complet — Génération autorisée";
        banner.innerHTML = `
            <div class="vb-title">${_titre}</div>
            <div style="font-size:0.9em;">${v.photoCount} photos relevées${v.noPlan ? " — site sans plan d'évacuation (déclaré par le technicien)" : (v.mode === "travaux" ? " — antenne et routeur positionnés sur le plan" : " — tous les points sont positionnés sur le plan")}.</div>
        `;
    } else {
        banner.className = "banner-error";
        banner.style.display = "block";
        const items = v.errors.map(e => `<li>${escapeHtml(e)}</li>`).join("");
        banner.innerHTML = `
            <div class="vb-title">🔒 Génération bloquée — Éléments manquants :</div>
            <ul>${items}</ul>
        `;
    }
}
window.updateGenerateButtonState = updateGenerateButtonState;

async function generateDocument() {
    // Valider l'ensemble des règles avant de générer
    const validation = validateMeasurementPoints();
    if (!validation.valid) {
        const detail = validation.errors.join("\n");
        alert("🔒 Génération bloquée — éléments manquants :\n\n" + detail +
              "\n\nComplétez les éléments ci-dessus pour pouvoir générer le rapport.");
        // Rafraîchit le bandeau au cas où l'utilisateur clique malgré le bouton grisé
        updateGenerateButtonState();
        return;
    }

    const {
        Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        ImageRun, Header, Footer, AlignmentType, WidthType, BorderStyle,
        VerticalAlign, ShadingType, HeightRule
    } = window.docx;

    const b64 = (s) => {
        const bin = atob(s);
        const res = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) res[i] = bin.charCodeAt(i);
        return res;
    };

    const val = (id) => {
        const el = document.getElementById(id);
        return el && el.value ? el.value : "";
    };

    // ---------- helpers de style ----------

    // Bordure grise standard
    const stdBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
    const stdBorders = {
        top: stdBorder, bottom: stdBorder, left: stdBorder, right: stdBorder,
        insideHorizontal: stdBorder, insideVertical: stdBorder
    };
    const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
    const noBorders = {
        top: noBorder, bottom: noBorder, left: noBorder, right: noBorder,
        insideHorizontal: noBorder, insideVertical: noBorder
    };

    // Paragraphe simple
    const P = (txt, opts = {}) => new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: opts.spacing || { before: 60, after: 60 },
        children: [new TextRun({
            text: txt || "",
            bold: opts.bold || false,
            italics: opts.italics || false,
            size: opts.size || 20,
            color: opts.color || "000000",
            font: "Calibri"
        })]
    });

    // Titre de section "1. Titre" avec ligne dessous
    const sectionTitle = (num, txt) => new Paragraph({
        spacing: { before: 360, after: 120 },
        keepNext: true,
        keepLines: true,
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 12, color: COLOR_TITLE, space: 4 }
        },
        children: [
            new TextRun({ text: `${num}.   `, bold: true, size: 28, color: COLOR_TITLE, font: "Calibri" }),
            new TextRun({ text: txt, bold: true, size: 28, color: COLOR_TITLE, font: "Calibri" })
        ]
    });

    // Sous-titre "2.1 - Texte"
    const subTitle = (num, txt) => new Paragraph({
        spacing: { before: 240, after: 80 },
        keepNext: true,
        keepLines: true,
        children: [
            new TextRun({ text: `${num} - ${txt}`, italics: true, bold: true, size: 22, color: COLOR_SUBTITLE, font: "Calibri" })
        ]
    });

    // Cellule "libellé" (gris clair, gras)
    const labelCell = (txt, width) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        shading: { fill: COLOR_TABLE_LABEL, type: ShadingType.CLEAR, color: "auto" },
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: stdBorders,
        children: [new Paragraph({
            children: [new TextRun({ text: txt, bold: true, size: 20, font: "Calibri" })]
        })]
    });

    // Cellule "valeur" (fond blanc)
    const valueCell = (txt, width, opts = {}) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: stdBorders,
        children: [new Paragraph({
            children: [new TextRun({
                text: txt || "",
                size: 20,
                font: "Calibri",
                color: opts.color || "000000",
                bold: opts.bold || false
            })]
        })]
    });

    // Cellule contenant un Paragraph déjà construit (pour ImageRun, etc.)
    const customCell = (children, width, opts = {}) => new TableCell({
        width: { size: width, type: WidthType.DXA },
        verticalAlign: opts.valign || VerticalAlign.CENTER,
        margins: opts.margins || { top: 100, bottom: 100, left: 140, right: 140 },
        borders: opts.borders || stdBorders,
        shading: opts.shading,
        columnSpan: opts.columnSpan,
        children: children
    });

    // Tableau simple à 2 colonnes (libellé / valeur) — style Starlink
    const kvTable = (rows) => new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 6240],
        rows: rows.map(r => new TableRow({
            children: [labelCell(r[0], 3120), valueCell(r[1], 6240)]
        }))
    });

    // Bandeau photo (titre bleu pâle + image centrée)
    const photoBanner = (title, photoKey, opts = {}) => {
        const w = opts.width || 8400;
        const photo = photoStore[photoKey];
        const titleCell = new TableCell({
            width: { size: w, type: WidthType.DXA },
            shading: { fill: COLOR_PHOTO_BG, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 100, bottom: 100, left: 200, right: 200 },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
            },
            children: [new Paragraph({
                children: [new TextRun({ text: `📷 ${title}`, bold: true, size: 22, color: COLOR_TITLE, font: "Calibri" })]
            })]
        });
        const photoCell = new TableCell({
            width: { size: w, type: WidthType.DXA },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
                top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
            },
            children: photo ? [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                        data: photo.data,
                        transformation: { width: opts.imgW || 380, height: opts.imgH || 280 },
                        type: photo.type
                    })]
                })
            ] : [
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 600, after: 600 },
                    children: [new TextRun({ text: "(Photo non fournie)", italics: true, size: 18, color: "999999", font: "Calibri" })]
                })
            ]
        });
        return new Table({
            width: { size: w, type: WidthType.DXA },
            columnWidths: [w],
            rows: [
                new TableRow({ children: [titleCell] }),
                new TableRow({ children: [photoCell] })
            ]
        });
    };

    // ---------- CONSTRUCTION DU DOCUMENT ----------
    const children = [];

    // === BANDEAU TITRE PRINCIPAL ===
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({
            children: [new TableCell({
                width: { size: 9360, type: WidthType.DXA },
                shading: { fill: COLOR_TITLE, type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 240, bottom: 80, left: 200, right: 200 },
                borders: stdBorders,
                children: [
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [new TextRun({
                            text: ((document.getElementById("modeIntervention")?.value) === "travaux"
                                ? "RAPPORT DE TRAVAUX - INSTALLATION ANTENNE 4G/5G"
                                : "RAPPORT D'AUDIT - INSTALLATION ANTENNE 4G/5G"),
                            bold: true, size: 32, color: COLOR_WHITE, font: "Calibri"
                        })]
                    }),
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        spacing: { before: 60, after: 240 },
                        children: [new TextRun({
                            text: "Bouygues Telecom │ IPKONEKT",
                            size: 22, color: COLOR_WHITE, font: "Calibri"
                        })]
                    })
                ]
            })]
        })]
    }));
    children.push(P("", { spacing: { before: 60, after: 60 } }));

    // === TABLEAU RÉFÉRENCE / AUDITEUR / DATE (3 colonnes) ===
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 3120, 3120],
        rows: [
            new TableRow({
                children: [
                    labelCell("Référence commande", 3120),
                    labelCell("Auditeur / Intervenant", 3120),
                    labelCell("Date d'audit", 3120)
                ]
            }),
            new TableRow({
                children: [
                    valueCell(val("ref_commande"), 3120),
                    valueCell(val("auditeur"), 3120),
                    valueCell(val("date_audit"), 3120)
                ]
            })
        ]
    }));

    // === SECTION 1 : INFOS ADMIN ===
    children.push(sectionTitle(1, "Informations administratives du client"));

    const cp = val("code_postal");
    const ville = val("ville");
    const tel = val("contact_tel");
    const mail = val("contact_mail");

    // Cellule "valeur" qui couvre 3 colonnes (utilisée pour fusionner avec la ligne CP/Ville)
    const wideValueCell = (txt) => new TableCell({
        width: { size: 6240, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        columnSpan: 3,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: stdBorders,
        children: [new Paragraph({
            children: [new TextRun({ text: txt || "", size: 20, font: "Calibri" })]
        })]
    });

    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [3120, 1560, 1560, 3120],
        rows: [
            new TableRow({ children: [labelCell("Raison sociale du site audité", 3120), wideValueCell(val("raison_sociale"))] }),
            new TableRow({ children: [labelCell("Adresse", 3120), wideValueCell(val("adresse"))] }),
            new TableRow({ children: [
                labelCell("Code postal", 3120),
                valueCell("CP : " + cp, 1560),
                labelCell("Ville", 1560),
                valueCell(ville, 3120)
            ]}),
            new TableRow({ children: [labelCell("Horaire d'ouverture du site", 3120), wideValueCell(val("horaire"))] }),
            new TableRow({ children: [labelCell("Procédure d'accès", 3120), wideValueCell(val("procedure_acces"))] }),
            new TableRow({ children: [labelCell("Téléphone site", 3120), wideValueCell(val("tel_site"))] }),
            new TableRow({ children: [labelCell("Nom du contact client sur site", 3120), wideValueCell(val("contact_nom"))] }),
            new TableRow({ children: [labelCell("Fonction", 3120), wideValueCell(val("contact_fonction"))] }),
            new TableRow({ children: [
                labelCell("Téléphone / Mail contact", 3120),
                valueCell(tel, 1560),
                labelCell("Mail", 1560),
                valueCell(mail, 3120)
            ]})
        ]
    }));

    // === SECTION 2 : INFOS TECHNIQUES BAIE ===
    children.push(sectionTitle(2, "Informations techniques – Baie / Local technique"));
    const _modeS2 = (document.getElementById("modeIntervention")?.value) || "audit";
    const s2Rows = [
        ["Localisation de la baie", val("localisation_baie")]
    ];
    if (_modeS2 !== "travaux") {
        s2Rows.push(["Nombre de prises électriques disponibles", val("nb_prises")]);
    }
    children.push(kvTable(s2Rows));

    // === SECTION 3 : MESURES RADIO 4G/5G ===
    children.push(sectionTitle(3, "Mesures radio 4G/5G – Points relevés"));

    // Légende matrice
    children.push(P("Grille de lecture officielle appliquée automatiquement :", { italics: true, color: "555555", spacing: { before: 60, after: 100 } }));
    children.push(buildMatrixTable(window.docx));
    children.push(P("", { spacing: { before: 120, after: 60 } }));

    // ---------- Helper bloc d'un point (section insécable) ----------
    // Construit un bloc complet pour un point de mesure (titre + tableau + analyse + photos)
    // et l'enveloppe dans un Table à 1 cellule avec cantSplit=true → la section ne sera
    // jamais coupée entre 2 pages. Si elle ne tient pas, Word fera un saut avant.
    function buildMeasureSectionBlock(group, sectionNum, subNum) {
        const pid = group.dataset.pointId;
        const tech = group.dataset.tech || "4g";
        const techLabel = tech === "4g" ? "4G" : "5G";
        const keyLieu = `mesure_lieu_${pid}`;
        const keyScreen = `mesure_screen_${pid}`;
        const lieuTxt = (group.querySelector('.point-lieu')?.value || "").trim() || "Point non nommé";

        const blockChildren = [];

        // Sous-titre (3.x.y)
        blockChildren.push(new Paragraph({
            spacing: { before: 200, after: 80 },
            keepNext: true,
            keepLines: true,
            children: [
                new TextRun({
                    text: `${sectionNum}.${subNum} - ${techLabel} – Point ${subNum} – ${lieuTxt}`,
                    italics: true, bold: true, size: 22, color: COLOR_SUBTITLE, font: "Calibri"
                })
            ]
        }));

        // Tableau de valeurs
        const rsrp = group.querySelector('.measure-rsrp')?.value || "—";
        const rsrq = group.querySelector('.measure-rsrq')?.value || "—";
        const sinr = group.querySelector('.measure-sinr')?.value || "—";
        const down = group.querySelector('.measure-down')?.value || "—";
        const up   = group.querySelector('.measure-up')?.value   || "—";
        const band = group.querySelector('.measure-band')?.value || "—";

        blockChildren.push(new Table({
            width: { size: 9120, type: WidthType.DXA },
            columnWidths: [1520, 1520, 1520, 1520, 1520, 1520],
            rows: [
                new TableRow({
                    cantSplit: true,
                    children: [
                        labelCell("RSRP (dBm)", 1520),
                        labelCell("RSRQ (dB)", 1520),
                        labelCell("SNR (dB)", 1520),
                        labelCell("↓ Desc. (Mbps)", 1520),
                        labelCell("↑ Mont. (Mbps)", 1520),
                        labelCell("Bande / Techno", 1520)
                    ]
                }),
                new TableRow({
                    cantSplit: true,
                    children: [
                        valueCell(rsrp, 1520),
                        valueCell(rsrq, 1520),
                        valueCell(sinr, 1520),
                        valueCell(down, 1520),
                        valueCell(up, 1520),
                        valueCell(band, 1520)
                    ]
                })
            ]
        }));

        // Analyse colorée
        const labelTxt = group.dataset.analysisLabel || "";
        const colorHex = (group.dataset.analysisColor || "#6b7280").replace("#","");
        if (labelTxt) {
            blockChildren.push(P("", { spacing: { before: 80, after: 0 } }));
            blockChildren.push(new Table({
                width: { size: 9120, type: WidthType.DXA },
                columnWidths: [3040, 6080],
                rows: [new TableRow({
                    cantSplit: true,
                    children: [
                        labelCell("🎯 Qualité globale (matrice RSRP × SNR)", 3040),
                        new TableCell({
                            width: { size: 6080, type: WidthType.DXA },
                            verticalAlign: VerticalAlign.CENTER,
                            shading: { fill: colorHex.toUpperCase(), type: ShadingType.CLEAR, color: "auto" },
                            margins: { top: 100, bottom: 100, left: 140, right: 140 },
                            borders: stdBorders,
                            children: [new Paragraph({
                                children: [new TextRun({ text: labelTxt, bold: true, size: 22, color: "FFFFFF", font: "Calibri" })]
                            })]
                        })
                    ]
                })]
            }));
        }

        // Photos côte à côte
        const hasL = !!photoStore[keyLieu];
        const hasS = !!photoStore[keyScreen];
        if (hasL || hasS) {
            blockChildren.push(P("", { spacing: { before: 120, after: 60 } }));
            blockChildren.push(new Table({
                width: { size: 9120, type: WidthType.DXA },
                columnWidths: [4560, 4560],
                borders: noBorders,
                rows: [new TableRow({
                    cantSplit: true,
                    children: [
                        new TableCell({
                            width: { size: 4560, type: WidthType.DXA },
                            margins: { top: 0, bottom: 0, left: 60, right: 60 },
                            borders: noBorders,
                            children: [hasL ? photoBannerInner("Photo du lieu", keyLieu, 4440) : P("(Pas de photo lieu)", { italics: true, color: "999999" })]
                        }),
                        new TableCell({
                            width: { size: 4560, type: WidthType.DXA },
                            margins: { top: 0, bottom: 0, left: 60, right: 60 },
                            borders: noBorders,
                            children: [hasS ? photoBannerInner("Copie écran mesure", keyScreen, 4440) : P("(Pas de copie écran)", { italics: true, color: "999999" })]
                        })
                    ]
                })]
            }));
        }

        // Enveloppe TOUT le bloc dans un Table à 1 ligne / 1 cellule avec cantSplit
        // → Word ne coupera JAMAIS le bloc entre 2 pages. Si pas assez de place, saut auto avant.
        return new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [9360],
            borders: noBorders,
            rows: [new TableRow({
                cantSplit: true,
                children: [new TableCell({
                    width: { size: 9360, type: WidthType.DXA },
                    margins: { top: 80, bottom: 80, left: 0, right: 0 },
                    borders: noBorders,
                    children: blockChildren
                })]
            })]
        });
    }

    // ---------- Helper : sous-titre techno (3.A 4G — 3.B 5G) ----------
    const techSubTitle = (label, accentColor) => new Paragraph({
        spacing: { before: 280, after: 120 },
        keepNext: true,
        keepLines: true,
        border: {
            bottom: { style: BorderStyle.SINGLE, size: 8, color: accentColor, space: 4 }
        },
        children: [
            new TextRun({ text: label, bold: true, size: 24, color: accentColor, font: "Calibri" })
        ]
    });

   // ---------- 3.A — 4G ----------
const _modeS3 = (document.getElementById("modeIntervention")?.value) || "audit";
// En mode TRAVAUX, ne conserver que les blocs visibles (un seul 4G + un seul 5G).
const _isVisible = (el) => {
    if (_modeS3 !== "travaux") return true;
    if (!el) return false;
    return el.offsetParent !== null && el.style.display !== "none";
};
const groups4G = Array.from(document.querySelectorAll('#measurePointsContainer4G .measure-point-group')).filter(_isVisible);
if (groups4G.length > 0) {
    const _titre4G = (_modeS3 === "travaux") ? "3.A — Mesure 4G" : "3.A — Mesures 4G";
    children.push(techSubTitle(_titre4G, TECH_COLOR_4G));
    groups4G.forEach((group, idx) => {
        children.push(buildMeasureSectionBlock(group, "3.A", idx + 1));
        children.push(P("", { spacing: { before: 10, after: 10 } })); // espace réduit
    });
}

// ---------- 3.B — 5G ----------
const groups5G = Array.from(document.querySelectorAll('#measurePointsContainer5G .measure-point-group')).filter(_isVisible);
if (groups5G.length > 0) {
    const _titre5G = (_modeS3 === "travaux") ? "3.B — Mesure 5G" : "3.B — Mesures 5G";
    children.push(techSubTitle(_titre5G, TECH_COLOR_5G));
    groups5G.forEach((group, idx) => {
        children.push(buildMeasureSectionBlock(group, "3.B", idx + 1));
        children.push(P("", { spacing: { before: 10, after: 10 } })); // espace réduit
    });
}

if (groups4G.length === 0 && groups5G.length === 0) {
    children.push(P("(Aucun point de mesure renseigné)", { italics: true, color: "999999" }));
}

// ---------- 3.C — Photo de l'installation du routeur (mode TRAVAUX uniquement) ----------
if (_modeS3 === "travaux" && photoStore['routeur_install']) {
    children.push(techSubTitle("3.C — Photo de l'installation du routeur 4G", TECH_COLOR_4G));
    const _routeurPhoto = photoStore['routeur_install'];
    // Calcul de dimensions raisonnables (max 480 px de large)
    let _rw = _routeurPhoto.naturalWidth || 800;
    let _rh = _routeurPhoto.naturalHeight || 600;
    const _maxW = 480;
    if (_rw > _maxW) {
        const _ratio = _maxW / _rw;
        _rw = _maxW;
        _rh = Math.round(_rh * _ratio);
    }
    children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 100, after: 120 },
        keepNext: true,
        keepLines: true,
        children: [new ImageRun({
            data: _routeurPhoto.data,
            transformation: { width: _rw, height: _rh },
            type: _routeurPhoto.type === "png" ? "png" : "jpg"
        })]
    }));
}

    // Helper : bandeau photo "intérieur" (utilisé pour côte à côte)
   function photoBannerInner(title, key, maxWidthTwips) {
    const photo = photoStore[key];
    if (!photo) return new Paragraph({ text: "(Photo non fournie)", italics: true, color: "999999" });

    // Convertir la largeur max de twips en pixels approximatifs (1 pixel ≈ 15 twips)
    // La largeur max en pixels sera limitée à 400 pour éviter des images énormes
    let maxWidthPx = Math.min(400, maxWidthTwips / 15);
    // Largeur réelle de l'image (ne peut pas dépasser maxWidthPx)
    const width = Math.min(maxWidthPx, photo.naturalWidth);
    // Hauteur proportionnelle
    const height = (width / photo.naturalWidth) * photo.naturalHeight;

    return new Table({
        width: { size: maxWidthTwips, type: WidthType.DXA },
        columnWidths: [maxWidthTwips],
        rows: [
            new TableRow({ children: [new TableCell({
                width: { size: maxWidthTwips, type: WidthType.DXA },
                shading: { fill: COLOR_PHOTO_BG, type: ShadingType.CLEAR, color: "auto" },
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                    left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                    right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
                },
                children: [new Paragraph({
                    children: [new TextRun({ text: `📷 ${title}`, bold: true, size: 20, color: COLOR_TITLE, font: "Calibri" })]
                })]
            })]}),
            new TableRow({ children: [new TableCell({
                width: { size: maxWidthTwips, type: WidthType.DXA },
                margins: { top: 120, bottom: 120, left: 120, right: 120 },
                verticalAlign: VerticalAlign.CENTER,
                borders: {
                    top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                    bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                    left: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER },
                    right: { style: BorderStyle.SINGLE, size: 6, color: COLOR_PHOTO_BORDER }
                },
                children: [new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new ImageRun({
                        data: photo.data,
                        transformation: { width: width, height: height },
                        type: photo.type
                    })]
                })]
            })]})
        ]
    });
}

     // === SECTION 4 : PLAN D'ÉVACUATION (version optimisée pour une seule page) ===
    const _modeS4 = (document.getElementById("modeIntervention")?.value) || "audit";
    const _titreS4 = (_modeS4 === "travaux")
        ? "Plan d'évacuation – Cheminement Antenne → Routeur"
        : "Plan d'évacuation – Localisation des points de mesure";
    children.push(sectionTitle(4, _titreS4));

    if (photoStore['evac_plan']) {
        const composed = await composeEvacPlanWithPoints();
        const planData = composed ? composed.data : photoStore['evac_plan'].data;

        // Taille encore plus contrôlée pour tenir sur une page avec légende
        const MAX_WIDTH_PX = 420;   // Réduit pour laisser de la place

        let displayWidth = MAX_WIDTH_PX;
        let displayHeight = 0;

        if (composed && composed.dispW > 0) {
            const ratio = composed.dispH / composed.dispW;
            displayHeight = Math.round(MAX_WIDTH_PX * ratio);
        } else {
            const ratio = (photoStore['evac_plan'].naturalHeight || 700) / 
                         (photoStore['evac_plan'].naturalWidth || 1000);
            displayHeight = Math.round(MAX_WIDTH_PX * ratio);
        }

        // Paragraphe avec forte contrainte pour rester groupé
        const planParagraph = new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 120 },
            keepNext: true,
            keepLines: true,
            children: [new ImageRun({
                data: planData,
                transformation: { 
                    width: displayWidth, 
                    height: displayHeight 
                },
                type: "png"
            })]
        });

        children.push(planParagraph);

        // Légende juste après
        if (evacPoints.length > 0) {
            const legendRows = evacPoints.map(p => {
                if (p.travauxLabel) {
                    // Repère mode TRAVAUX
                    return {
                        lieu: p.travauxLabel,
                        label: "—",
                        tech: p.travauxTech || "4g",
                        color: (p.travauxColor || "#6b7280").replace("#","").toUpperCase()
                    };
                }
                const grp = getMeasureGroupByPid(p.pointId);
                const label = grp ? (grp.dataset.analysisLabel || "—") : "—";
                const lieu  = grp ? getPointDisplayName(grp) : "Point non nommé";
                const tech  = grp ? (grp.dataset.tech || "4g") : "4g";
                const colorHex = grp ? (grp.dataset.analysisColor || "#6b7280") : "#6b7280";
                return { lieu, label, tech, color: colorHex.replace("#","").toUpperCase() };
            });

            const _legendeTitre = (_modeS4 === "travaux") ? "Légende des repères :" : "Légende des points :";
            children.push(P(_legendeTitre, { 
                italics: true, 
                color: "555555", 
                spacing: { before: 60, after: 40 } 
            }));

            children.push(new Table({
                width: { size: 9360, type: WidthType.DXA },
                columnWidths: [820, 1040, 3640, 3860],
                rows: [
                    new TableRow({ cantSplit: true, children: [
                        labelCell("Couleur", 820),
                        labelCell("Techno", 1040),
                        labelCell("Lieu / Nom du point", 3640),
                        labelCell("Qualité", 3860)
                    ]}),
                    ...legendRows.map(r => new TableRow({
                        cantSplit: true,
                        children: [
                            new TableCell({ width: { size: 820, type: WidthType.DXA }, shading: { fill: r.color }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: " ", size: 20, color: "FFFFFF" })] })] }),
                            new TableCell({ 
                                width: { size: 1040, type: WidthType.DXA }, 
                                shading: { fill: r.tech === "4g" ? TECH_COLOR_4G : TECH_COLOR_5G },
                                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: r.tech.toUpperCase(), bold: true, size: 20, color: "FFFFFF" })] })] 
                            }),
                            valueCell(r.lieu, 3640),
                            valueCell(r.label, 3860)
                        ]
                    }))
                ]
            }));
        }
    } else {
        // Pas de plan importé : si le technicien a coché "aucun plan d'évacuation
        // disponible", on l'indique explicitement dans le Word (avec commentaire éventuel).
        const noEvacChk = document.getElementById("noEvacPlan");
        const noEvacCom = document.getElementById("noEvacPlanComment");
        if (noEvacChk && noEvacChk.checked) {
            children.push(P("Site sans plan d'évacuation — déclaré par le technicien.", {
                italics: true, color: "666666"
            }));
            const com = (noEvacCom && noEvacCom.value || "").trim();
            if (com) {
                children.push(P("Motif : " + com, { italics: true, color: "666666", size: 20 }));
            }
        } else {
            children.push(P("(Aucun plan d'évacuation fourni)", { italics: true, color: "999999" }));
        }
    }
    // === SECTION 5 : CHEMINEMENT (2 par ligne) ===
    children.push(sectionTitle(5, "Cheminement câble & installation"));
    const chemItems = Array.from(document.querySelectorAll('.cheminement-item'));
    if (chemItems.length === 0) {
        children.push(P("(Aucun cheminement renseigné)", { italics: true, color: "999999" }));
    }
    // On groupe par paires
    for (let i = 0; i < chemItems.length; i += 2) {
        const left = chemItems[i];
        const right = chemItems[i + 1] || null;

        const buildChemCell = (item) => {
            if (!item) {
                return [P("", {})]; // cellule vide
            }
            const idx = item.dataset.idx;
            const key = `cheminement_${idx}`;
            const comm = item.querySelector('.cheminement-comment')?.value || "";
            const blocks = [];
            if (photoStore[key]) {
                blocks.push(photoBannerInner(`Cheminement ${idx}`, key, 4560));
            } else {
                blocks.push(P(`(Cheminement ${idx} - pas de photo)`, { italics: true, color: "999999" }));
            }
            if (comm) {
                blocks.push(P(`Commentaire : ${comm}`, { italics: true, size: 18, spacing: { before: 80, after: 80 } }));
            }
            return blocks;
        };

        children.push(P("", { spacing: { before: 200, after: 60 } }));
        children.push(new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [4680, 4680],
            borders: noBorders,
            rows: [new TableRow({
                cantSplit: true,
                children: [
                    new TableCell({
                        width: { size: 4680, type: WidthType.DXA },
                        margins: { top: 0, bottom: 0, left: 60, right: 60 },
                        borders: noBorders,
                        children: buildChemCell(left)
                    }),
                    new TableCell({
                        width: { size: 4680, type: WidthType.DXA },
                        margins: { top: 0, bottom: 0, left: 60, right: 60 },
                        borders: noBorders,
                        children: buildChemCell(right)
                    })
                ]
            })]
        }));
    }

    // === SECTION 6 : SYNTHÈSE ===
    children.push(sectionTitle(6, "Synthèse de l'intervention"));
    const _modeS6 = (document.getElementById("modeIntervention")?.value) || "audit";
    const _radioVal = (name) => {
        const r = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
        return r ? r.value : "";
    };
    const _dureeLabel = (_modeS6 === "travaux") ? "Durée des travaux réalisés" : "Durée totale à prévoir";
    const s6Rows = [
        ["Heure de début d'intervention", val("heure_debut")],
        ["Heure de fin d'intervention", val("heure_fin")],
        [_dureeLabel, val("duree_totale")],
        ["Nombre de techniciens", val("nb_techniciens")]
    ];
    if (_modeS6 === "travaux") {
        s6Rows.push(["Nacelle utilisée ?", _radioVal("nacelle_prevoir")]);
        s6Rows.push(["Échelle / échafaudage ?", _radioVal("echelle_prevoir")]);
    }
    children.push(kvTable(s6Rows));

    children.push(P("", { spacing: { before: 200, after: 80 } }));

    // === COMPTE RENDU PRINCIPAL (structuré) ===
    const mode = (document.getElementById("modeIntervention")?.value) || "audit";
    const titreCR = (mode === "audit")
        ? "Compte rendu — Préconisations / Points à prévoir"
        : "Compte rendu — Travaux réalisés / Mise en œuvre";

    const crText = (document.getElementById("compteRenduPreview")?.value || "").trim();
    const blocks = (window.CompteRendu && crText) ? window.CompteRendu.parseText(crText) : [];

    // Bandeau d'en-tête
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [new TableRow({ cantSplit: true, children: [labelCell(titreCR, 9360)] })]
    }));

    // Contenu rendu sous forme de paragraphes hiérarchisés (sans cases à cocher !)
    if (blocks.length === 0) {
        children.push(P("(Aucun élément renseigné dans le compte rendu principal.)",
            { italics: true, color: "888888", spacing: { before: 120, after: 80 } }));
    } else {
        const crChildren = [];
        blocks.forEach(b => {
            switch (b.type) {
                case 'spacer':
                    crChildren.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        children: [new TextRun({ text: "" })]
                    }));
                    break;
                case 'h1':
                    // déjà dans le titre du tableau, on saute pour ne pas dupliquer
                    break;
                case 'h2':
                    crChildren.push(new Paragraph({
                        spacing: { before: 200, after: 80 },
                        children: [new TextRun({
                            text: b.text,
                            bold: true,
                            size: 22,
                            color: COLOR_TITLE,
                            font: "Calibri"
                        })]
                    }));
                    break;
                case 'h3':
                    crChildren.push(new Paragraph({
                        spacing: { before: 140, after: 60 },
                        indent: { left: 200 },
                        children: [new TextRun({
                            text: b.text,
                            bold: true,
                            italics: true,
                            size: 20,
                            color: COLOR_SUBTITLE,
                            font: "Calibri"
                        })]
                    }));
                    break;
                case 'bullet':
                    crChildren.push(new Paragraph({
                        spacing: { before: 40, after: 40 },
                        indent: { left: 600, hanging: 200 },
                        children: [
                            new TextRun({ text: "• ", bold: true, size: 20, color: COLOR_TITLE, font: "Calibri" }),
                            new TextRun({ text: b.text, size: 20, font: "Calibri" })
                        ]
                    }));
                    break;
                case 'p':
                default:
                    crChildren.push(new Paragraph({
                        spacing: { before: 60, after: 60 },
                        children: [new TextRun({ text: b.text, size: 20, font: "Calibri" })]
                    }));
                    break;
            }
        });

        // Cellule unique contenant tout le compte rendu rendu joliment
        children.push(new Table({
            width: { size: 9360, type: WidthType.DXA },
            columnWidths: [9360],
            rows: [
                new TableRow({
                    cantSplit: false,
                    children: [new TableCell({
                        width: { size: 9360, type: WidthType.DXA },
                        margins: { top: 160, bottom: 160, left: 200, right: 200 },
                        borders: stdBorders,
                        children: crChildren
                    })]
                })
            ]
        }));
    }

    // Zone "Observations complémentaires" (champ libre)
    children.push(P("", { spacing: { before: 160, after: 60 } }));
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
            new TableRow({ cantSplit: true, children: [labelCell("Observations / Commentaires complémentaires", 9360)] }),
            new TableRow({ cantSplit: true, children: [valueCell(val("observations") || "—", 9360)] })
        ]
    }));

    // === SIGNATURE ===
    children.push(P("", { spacing: { before: 240, after: 60 } }));
    children.push(new Table({
        width: { size: 9360, type: WidthType.DXA },
        columnWidths: [9360],
        rows: [
            new TableRow({ cantSplit: true, children: [labelCell("Signature technicien / auditeur", 9360)] }),
            new TableRow({ cantSplit: true, children: [valueCell(
                `Nom : ${val("signataire_nom") || "_______________________________"}      Date : ${val("signataire_date")}`,
                9360
            )] })
        ]
    }));

    // ---------- DOCUMENT FINAL ----------
    const doc = new Document({
        styles: {
            default: { document: { run: { font: "Calibri", size: 20 } } }
        },
        sections: [{
            properties: {
                page: {
                    size: { width: 12240, height: 15840 },
                    margin: { top: 1440, right: 1440, bottom: 1080, left: 1440 }
                }
            },
            headers: {
                default: new Header({
                    children: [new Table({
                        width: { size: 9360, type: WidthType.DXA },
                        columnWidths: [3120, 3120, 3120],
                        borders: noBorders,
                        rows: [new TableRow({
                            children: [
                                new TableCell({
                                    width: { size: 3120, type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    borders: noBorders,
                                    children: [new Paragraph({
                                        children: [new ImageRun({
                                            data: b64(LOGO_IPKONEKT_B64),
                                            transformation: { width: 60, height: 54 }
                                        })]
                                    })]
                                }),
                                new TableCell({
                                    width: { size: 3120, type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    borders: noBorders,
                                    children: [new Paragraph({
                                        alignment: AlignmentType.CENTER,
                                        children: []
                                    })]
                                }),
                                new TableCell({
                                    width: { size: 3120, type: WidthType.DXA },
                                    verticalAlign: VerticalAlign.CENTER,
                                    borders: noBorders,
                                    children: [new Paragraph({
                                        alignment: AlignmentType.RIGHT,
                                        children: [new ImageRun({
                                            data: b64(LOGO_BOUYGUES_B64),
                                            transformation: { width: 60, height: 60 }
                                        })]
                                    })]
                                })
                            ]
                        })]
                    })]
                })
            },
            footers: {
                default: new Footer({
                    children: [new Paragraph({
                        alignment: AlignmentType.LEFT,
                        children: [new TextRun({
                            text: "Document confidentiel — Usage interne IPKONEKT / Bouygues Telecom",
                            italics: true, size: 16, color: COLOR_FOOTER, font: "Calibri"
                        })]
                    })]
                })
            },
            children: children
        }]
    });

    Packer.toBlob(doc).then(blob => {
        const safeName = (val("raison_sociale") || "Site").replace(/[^a-zA-Z0-9_-]/g, "_");
        const prefix = ((document.getElementById("modeIntervention")?.value) === "travaux") ? "Travaux" : "Audit";
        saveAs(blob, `${prefix}_4G5G_${safeName}_${val("date_audit")}.docx`);
    });
}

// ---------- TABLEAU MATRICE D'INTERPRÉTATION (dans le Word) ----------
function buildMatrixTable(docxLib) {
    const { Table, TableRow, TableCell, Paragraph, TextRun, WidthType, BorderStyle, ShadingType, VerticalAlign } = docxLib;

    const stdBorder = { style: BorderStyle.SINGLE, size: 4, color: COLOR_BORDER };
    const stdBorders = {
        top: stdBorder, bottom: stdBorder, left: stdBorder, right: stdBorder,
        insideHorizontal: stdBorder, insideVertical: stdBorder
    };

    // Cell helper
    const mc = (txt, w, opts = {}) => new TableCell({
        width: { size: w, type: WidthType.DXA },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        borders: stdBorders,
        shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
        children: [new Paragraph({
            alignment: opts.align || "center",
            children: [new TextRun({
                text: txt,
                size: opts.size || 18,
                bold: opts.bold || false,
                color: opts.color || "000000",
                font: "Calibri"
            })]
        })]
    });

    const rsrpRows = [
        { label: "≥ −85 dBm (Excellent)",   k: "excellent" },
        { label: "−85 à −100 dBm (Bon)",    k: "bon" },
        { label: "−100 à −115 dBm (Faible)", k: "faible" },
        { label: "< −115 dBm (Critique)",   k: "critique" }
    ];
    const snrCols = [
        { label: "SNR > 15", k: ">15" },
        { label: "SNR 5 à 15", k: "5-15" },
        { label: "SNR 0 à 5", k: "0-5" },
        { label: "SNR < 0", k: "<0" }
    ];

    const W_LABEL = 3000;
    const W_COL = 1590;
    const TOTAL = W_LABEL + W_COL * 4; // 9360

    // Header row
    const headerCells = [
        mc("RSRP (Puissance)", W_LABEL, { fill: COLOR_TITLE, color: "FFFFFF", bold: true })
    ];
    snrCols.forEach(c => headerCells.push(mc(c.label, W_COL, { fill: COLOR_TITLE, color: "FFFFFF", bold: true })));
    const rows = [new TableRow({ children: headerCells })];

    // Body rows
    rsrpRows.forEach(r => {
        const cells = [mc(r.label, W_LABEL, { fill: COLOR_TABLE_LABEL, bold: true, align: "left" })];
        snrCols.forEach(c => {
            const q = QUALITY_MATRIX[r.k][c.k];
            const fill = q.color.replace("#", "").toUpperCase();
            cells.push(mc(q.label, W_COL, { fill: fill, color: "FFFFFF", bold: true }));
        });
        rows.push(new TableRow({ children: cells }));
    });

    return new Table({
        width: { size: TOTAL, type: WidthType.DXA },
        columnWidths: [W_LABEL, W_COL, W_COL, W_COL, W_COL],
        rows: rows
    });
}

// ---------- EXPOSITION GLOBALE ----------
window.closeEditor = () => window.Editor?.close();
window.saveAnnotation = () => window.Editor?.save();
window.generateDocument = generateDocument;
window.resetForm = () => { if (confirm("Réinitialiser tout le formulaire ?")) location.reload(); };

// ---------- EXPORT / IMPORT JSON ----------
function collectFormData() {
    const data = {
        version: "audit-4g5g-v1",
        exportedAt: new Date().toISOString(),
        fields: {},
        radios: {},      // boutons radio (name -> value)
        measurePoints: [],
        cheminements: [],
        evacPoints: evacPoints,
        noEvacPlan: !!(document.getElementById("noEvacPlan") && document.getElementById("noEvacPlan").checked),
        noEvacPlanComment: (document.getElementById("noEvacPlanComment") || {}).value || "",
        photos: {}       // dataUrl pour pouvoir restaurer (optionnel et lourd)
    };

    // Tous les inputs / textareas / selects avec un id
    document.querySelectorAll("input[id], textarea[id], select[id]").forEach(el => {
        if (el.type === "file") return; // les fichiers ne s'exportent pas comme texte
        if (el.type === "radio" || el.type === "checkbox") return;
        data.fields[el.id] = el.value;
    });

    // Radios groupés par name
    document.querySelectorAll('input[type="radio"]:checked').forEach(el => {
        if (el.name) data.radios[el.name] = el.value;
    });

    // Points de mesure
    document.querySelectorAll('.measure-point-group').forEach(group => {
        data.measurePoints.push({
            num: group.dataset.point,
            tech: group.dataset.tech || "4g",
            pointId: group.dataset.pointId || "",
            lieu: group.querySelector('.point-lieu')?.value || "",
            rsrp: group.querySelector('.measure-rsrp')?.value || "",
            rsrq: group.querySelector('.measure-rsrq')?.value || "",
            sinr: group.querySelector('.measure-sinr')?.value || "",
            down: group.querySelector('.measure-down')?.value || "",
            up:   group.querySelector('.measure-up')?.value   || "",
            band: group.querySelector('.measure-band')?.value || "",
            analysisLabel: group.dataset.analysisLabel || "",
            analysisColor: group.dataset.analysisColor || ""
        });
    });

    // Cheminements
    document.querySelectorAll('.cheminement-item').forEach(item => {
        data.cheminements.push({
            idx: item.dataset.idx,
            comment: item.querySelector('.cheminement-comment')?.value || ""
        });
    });

    // Photos (dataUrl en base64, plus annotations re-éditables si présentes)
    Object.keys(photoStore).forEach(k => {
        const p = photoStore[k];
        data.photos[k] = {
            type: p.type,
            dataUrl: p.dataUrl,
            originalDataUrl: p.originalDataUrl || null,
            annotations: p.annotations || null,
            annotated: !!p.annotated
        };
    });

    // État du compte rendu principal (cases cochées, quantités, état, localisation)
    if (window.CompteRendu && typeof window.CompteRendu.getState === "function") {
        data.compteRendu = window.CompteRendu.getState();
    }

    return data;
}

window.exportJSON = function() {
    try {
        // Même règle métier que pour la génération Word : on ne sort un JSON
        // que si l'audit est complet (au moins 12 photos + points placés ou pas de plan).
        const validation = validateMeasurementPoints();
        if (!validation.valid) {
            const detail = validation.errors.join("\n");
            alert("🔒 Export JSON bloqué — éléments manquants :\n\n" + detail +
                  "\n\nComplétez les éléments ci-dessus pour pouvoir exporter.");
            updateGenerateButtonState();
            return;
        }
        const data = collectFormData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const safeName = (document.getElementById("raison_sociale")?.value || "Audit").replace(/[^a-zA-Z0-9_-]/g, "_");
        const date = document.getElementById("date_audit")?.value || new Date().toISOString().slice(0,10);
        if (typeof saveAs !== "undefined") {
            saveAs(blob, `Audit_4G5G_${safeName}_${date}.json`);
        } else {
            // fallback : créer un lien et cliquer
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Audit_4G5G_${safeName}_${date}.json`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
        }
    } catch (err) {
        console.error("Erreur export JSON :", err);
        alert("Impossible d'exporter le formulaire.");
    }
};

window.importJSON = function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            applyFormData(data);
            alert("✅ Données importées avec succès.");
        } catch (err) {
            console.error("Erreur import JSON :", err);
            alert("Le fichier n'est pas un export valide.");
        } finally {
            event.target.value = ""; // permet de réimporter le même fichier ensuite
        }
    };
    reader.readAsText(file);
};

function applyFormData(data) {
    if (!data || typeof data !== "object") return;

    // Champs simples
    if (data.fields) {
        Object.keys(data.fields).forEach(id => {
            const el = document.getElementById(id);
            if (el && el.type !== "file") el.value = data.fields[id];
        });
    }

    // Radios
    if (data.radios) {
        Object.keys(data.radios).forEach(name => {
            const v = data.radios[name];
            const el = document.querySelector(`input[type="radio"][name="${name}"][value="${v}"]`);
            if (el) el.checked = true;
        });
    }

    // Photos (restauration depuis dataUrl + annotations re-éditables)
    if (data.photos) {
        Object.keys(data.photos).forEach(k => {
            const p = data.photos[k];
            if (!p || !p.dataUrl) return;
            const u8 = dataUrlToUint8Array(p.dataUrl);
            photoStore[k] = {
                data: u8,
                type: p.type || "jpg",
                dataUrl: p.dataUrl,
                originalDataUrl: p.originalDataUrl || null,
                annotations: p.annotations || null,
                annotated: !!p.annotated
            };
            const preview = document.getElementById("preview_" + k);
            if (preview) {
                preview.src = p.dataUrl;
                preview.classList.add("shown");
            }
            // Activer le bouton annoter si présent
            const ann = document.querySelector(`[data-annotate="${k}"]`);
            if (ann) ann.disabled = false;
        });
    }

    // Points de mesure : on vide les 2 conteneurs (4G / 5G) puis on recrée
    const mp4 = document.getElementById("measurePointsContainer4G");
    const mp5 = document.getElementById("measurePointsContainer5G");
    if ((mp4 || mp5) && data.measurePoints) {
        if (mp4) mp4.innerHTML = "";
        if (mp5) mp5.innerHTML = "";
        measureCounter4G = 0;
        measureCounter5G = 0;

        // Compatibilité ascendante : ancien export sans tech ni pointId
        // → on suppose que tous les points étaient "4G" et numérotés 1..N
        // (c'est le cas le plus probable de l'ancienne version)
        const isLegacy = !data.measurePoints.some(mp => mp.tech || mp.pointId);

        data.measurePoints.forEach((mp, i) => {
            const tech = isLegacy ? "4g" : (mp.tech === "5g" ? "5g" : "4g");

            // Migration des photos legacy : ancienne clé `mesure_lieu_<num>` (entier)
            // → nouvelle clé `mesure_lieu_4g-<num>`
            if (isLegacy) {
                const oldNum = mp.num != null ? String(mp.num) : String(i + 1);
                ["lieu", "screen"].forEach(t => {
                    const oldKey = `mesure_${t}_${oldNum}`;
                    const newKey = `mesure_${t}_${tech}-${i + 1}`; // pid sera 4g-(i+1)
                    if (photoStore[oldKey] && !photoStore[newKey]) {
                        photoStore[newKey] = photoStore[oldKey];
                        delete photoStore[oldKey];
                    }
                });
            }

            // Crée le point dans le bon conteneur (incrémente measureCounter4G/5G)
            addMeasurePoint(tech);

            // Récupère le dernier groupe créé pour CE techno
            const cont = tech === "4g" ? mp4 : mp5;
            const groups = cont ? cont.querySelectorAll('.measure-point-group') : [];
            const grp = groups[groups.length - 1];
            if (!grp) return;

            const pid = grp.dataset.pointId;

            // Remplir les champs
            if (mp.lieu)  grp.querySelector('.point-lieu').value = mp.lieu;
            if (mp.rsrp)  grp.querySelector('.measure-rsrp').value = mp.rsrp;
            if (mp.rsrq)  grp.querySelector('.measure-rsrq').value = mp.rsrq;
            if (mp.sinr)  grp.querySelector('.measure-sinr').value = mp.sinr;
            if (mp.down)  grp.querySelector('.measure-down').value = mp.down;
            if (mp.up)    grp.querySelector('.measure-up').value   = mp.up;
            if (mp.band)  grp.querySelector('.measure-band').value = mp.band;
            analyzePoint(grp);

            // Activer les boutons annoter pour les photos restaurées
            ['lieu', 'screen'].forEach(t => {
                const key = `mesure_${t}_${pid}`;
                if (photoStore[key]) {
                    const ann = grp.querySelector(`[data-annotate="${key}"]`);
                    if (ann) ann.disabled = false;
                    const prev = document.getElementById(`preview_${key}`);
                    if (prev) {
                        prev.src = photoStore[key].dataUrl;
                        prev.classList.add("shown");
                    }
                }
            });
        });

        // Si l'export ne contenait aucun point, on remet les 3+3 par défaut
        if (data.measurePoints.length === 0) {
            initMeasurePoints();
        }
    }

    // Cheminements
    const chemContainer = document.getElementById("cheminementContainer");
    if (chemContainer && data.cheminements) {
        chemContainer.innerHTML = "";
        cheminementCounter = 0;
        data.cheminements.forEach(ch => {
            addCheminementItem();
            const items = chemContainer.querySelectorAll('.cheminement-item');
            const item = items[items.length - 1];
            if (item) {
                if (ch.comment) item.querySelector('.cheminement-comment').value = ch.comment;
                const idx = item.dataset.idx;
                const key = `cheminement_${idx}`;
                if (photoStore[key]) {
                    const ann = item.querySelector(`[data-annotate="${key}"]`);
                    if (ann) ann.disabled = false;
                    const prev = document.getElementById(`preview_${key}`);
                    if (prev) {
                        prev.src = photoStore[key].dataUrl;
                        prev.classList.add("shown");
                    }
                }
            }
        });
    }

    // Plan d'évacuation
    if (photoStore['evac_plan']) {
        const stage = document.getElementById('evacStageContainer');
        const upArea = document.getElementById('evacUploadArea');
        const bgImg = document.getElementById('evacBgImage');
        if (stage) stage.style.display = 'block';
        if (bgImg) bgImg.src = photoStore['evac_plan'].dataUrl;
        if (upArea) upArea.style.display = 'none';
    }

    // Restaurer les points sur le plan d'évacuation
    if (Array.isArray(data.evacPoints) && data.evacPoints.length > 0) {
        // Vider d'abord
        const wrap = document.getElementById('evacStageWrap');
        if (wrap) {
            wrap.querySelectorAll('.evac-point').forEach(el => el.remove());
        }
        evacPoints = [];

        // Attendre que l'image soit chargée pour avoir les bonnes dimensions
        const bgImg = document.getElementById('evacBgImage');
        const onReady = () => {
            data.evacPoints.forEach(p => {
                // Cas 1 : repère "travaux" (Antenne / Routeur / Mesure post-installation)
                if (p.travauxLabel || (typeof p.pointId === 'string' && p.pointId.startsWith('travaux-'))) {
                    const state = {
                        pointId: p.pointId,
                        leftPct: typeof p.leftPct === 'number' ? p.leftPct : 50,
                        topPct:  typeof p.topPct  === 'number' ? p.topPct  : 50,
                        size:    typeof p.size    === 'number' ? p.size    : 60,
                        travauxLabel: p.travauxLabel || "Repère",
                        travauxColor: p.travauxColor || "#dc2626",
                        travauxTech:  p.travauxTech  || "4g"
                    };
                    evacPoints.push(state);
                    renderEvacTravauxPoint(state);
                    return;
                }
                // Cas 2 : point 4G / 5G classique
                // Compatibilité ascendante : ancien format avec pointId numérique
                // → on suppose qu'il faisait référence au Nème point 4G
                let pid = p.pointId;
                if (typeof pid === 'number') {
                    pid = `4g-${pid}`;
                }
                // On ne place que si le point existe encore dans le formulaire
                if (!getMeasureGroupByPid(pid)) {
                    return;
                }
                const state = {
                    pointId: pid,
                    leftPct: typeof p.leftPct === 'number' ? p.leftPct : 50,
                    topPct:  typeof p.topPct  === 'number' ? p.topPct  : 50,
                    size:    typeof p.size    === 'number' ? p.size    : 60
                };
                evacPoints.push(state);
                renderEvacPoint(state);
            });
            refreshAllEvacPointColors();
            refreshEvacPicker();
            refreshEvacTravauxPicker();
        };
        if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
            onReady();
        } else if (bgImg) {
            bgImg.addEventListener('load', onReady, { once: true });
        }
    } else {
        // Pas de points évac dans l'export → s'assurer que les pickers sont à jour
        refreshEvacPicker();
        refreshEvacTravauxPicker();
    }

    // Restaurer l'état du compte rendu principal (cases, quantités, etc.)
    if (data.compteRendu && window.CompteRendu && typeof window.CompteRendu.setState === "function") {
        // setTimeout pour laisser le DOM se reconstruire si besoin
        setTimeout(() => window.CompteRendu.setState(data.compteRendu), 0);
    }

    // Restaurer la case "Aucun plan d'évacuation" et son commentaire
    const noEvac = document.getElementById("noEvacPlan");
    const noEvacComment = document.getElementById("noEvacPlanComment");
    if (noEvac) {
        noEvac.checked = !!data.noEvacPlan;
        if (noEvacComment) {
            noEvacComment.value = data.noEvacPlanComment || "";
            noEvacComment.style.display = noEvac.checked ? "block" : "none";
        }
    }

    // Recalculer l'état des boutons après import complet
    if (typeof updateGenerateButtonState === "function") {
        // setTimeout pour laisser les éventuels chargements d'images se faire
        setTimeout(() => updateGenerateButtonState(), 50);
    }
}

// Helper : dataUrl → Uint8Array
function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1] || "";
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
