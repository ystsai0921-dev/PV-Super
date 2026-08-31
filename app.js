/**
 * 繪製多邊形完成後之 (確定保留 / 刪除) 浮動確認對話框
 * @param {string} typeName - 物件類型名稱 (如 '案場邊界', '排除區域', '障礙物')
 * @param {Function} onKeep - 確定保留點擊回呼
 * @param {Function} onDiscard - 刪除點擊回呼
 */
function promptPolygonKeepOrDiscard(typeName, onKeep, onDiscard, polygon) {
    const oldModal = document.getElementById('polygon-confirm-modal');
    if (oldModal) oldModal.remove();
    const oldBackdrop = document.getElementById('polygon-confirm-backdrop');
    if (oldBackdrop) oldBackdrop.remove();

    // 1. Create semi-transparent blocking backdrop to lock rest of UI until resolved
    const backdrop = document.createElement('div');
    backdrop.id = 'polygon-confirm-backdrop';
    backdrop.style.cssText = 'position: fixed; inset: 0; z-index: 1040; background: rgba(15, 23, 42, 0.2); backdrop-filter: blur(1px); pointer-events: auto;';
    document.body.appendChild(backdrop);

    // 2. Create Floating Modal (Ultra-compact horizontal pill)
    const container = map ? map.getContainer() : document.body;
    const modal = document.createElement('div');
    modal.id = 'polygon-confirm-modal';
    modal.className = 'floating-confirm-modal';
    modal.style.cssText = 'position: absolute; z-index: 1050; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(12px); border: 1.5px solid rgba(56, 189, 248, 1); border-radius: 6px; padding: 3px 5px; box-shadow: 0 4px 16px rgba(0,0,0,0.6), 0 0 10px rgba(56, 189, 248, 0.35); color: #ffffff; font-family: var(--font-ui); pointer-events: auto; display: flex; align-items: center; gap: 4px; white-space: nowrap; width: fit-content; height: auto; bottom: auto; transform: translate(-50%, -100%); transition: top 0.1s ease, left 0.1s ease;';

    modal.innerHTML = `
        <button id="btn-modal-keep" style="padding: 4px 10px; background: linear-gradient(135deg, #10b981, #059669); border: none; border-radius: 4px; color: #ffffff; font-size: 0.75rem; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.4); transition: all 0.2s;">確定保留</button>
        <button id="btn-modal-discard" style="padding: 4px 8px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 4px; color: #fca5a5; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">刪除</button>
    `;

    container.appendChild(modal);

    // Calculate position close to the polygon without occluding it
    function updatePosition() {
        if (!map || !modal) return;
        if (polygon && typeof polygon.getBounds === 'function') {
            const bounds = polygon.getBounds();
            const northCenter = L.latLng(bounds.getNorth(), (bounds.getWest() + bounds.getEast()) / 2);
            const pt = map.latLngToContainerPoint(northCenter);
            
            if (pt.y > 60) {
                // Place just above the polygon top edge
                modal.style.transform = 'translate(-50%, -100%)';
                modal.style.top = `${pt.y - 8}px`;
            } else {
                // If too close to top border, place below polygon bottom edge
                const southCenter = L.latLng(bounds.getSouth(), (bounds.getWest() + bounds.getEast()) / 2);
                const southPt = map.latLngToContainerPoint(southCenter);
                modal.style.transform = 'translate(-50%, 0%)';
                modal.style.top = `${southPt.y + 8}px`;
            }
            
            const containerW = container.clientWidth || 800;
            const clampedX = Math.max(70, Math.min(containerW - 70, pt.x));
            modal.style.left = `${clampedX}px`;
        } else {
            modal.style.transform = 'translateX(-50%)';
            modal.style.bottom = '65px';
            modal.style.left = '50%';
            modal.style.top = 'auto';
        }
    }

    updatePosition();
    if (map) {
        map.on('move', updatePosition);
        map.on('zoom', updatePosition);
    }

    const cleanup = () => {
        if (map) {
            map.off('move', updatePosition);
            map.off('zoom', updatePosition);
        }
        if (modal && modal.parentElement) modal.remove();
        if (backdrop && backdrop.parentElement) backdrop.remove();
    };

    const btnKeep = modal.querySelector('#btn-modal-keep');
    const btnDiscard = modal.querySelector('#btn-modal-discard');

    btnKeep.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup();
        if (typeof onKeep === 'function') onKeep();
    });

    btnDiscard.addEventListener('click', (e) => {
        e.stopPropagation();
        cleanup();
        if (typeof onDiscard === 'function') onDiscard();
    });
}


/* ==========================================================================
   1. ??????????????(Global Variables & State Initialization)
   ========================================================================== */

// ==========================================
// 1. LEAFLET MAP MODULE
// ==========================================
let map = null;
let marker = null;
let coveragePolygon = null;
let actualModulesLayerGroup = null;
let isRightAngleSnapActive = false;
let isRightAngleSnapBypassed = false;
let isRectangleSnapActive = false;
let lastMouseMoveEvent = null;
let selectedEdgeHighlightLine = null;
let activeSelectedEdgeIndex = -1;
let activeSelectedPolygonPopup = null;
let rightAngleIndicatorPolyline = null;
let directionArrow = null;
let directionShaft = null;
let directionHeadForward = null;
let directionHeadBackward = null;
let arrowHandleMarker = null;
let isDraggingArrow = false;
let isMapMeasureMode = false;
let mapMeasureStartLatLng = null;
let mapMeasureTempLine = null;
let mapMeasureTempMarker = null;
let mapMeasureLines = [];
let isExclusionDrawMode = false;
let exclusionPoints = [];
let exclusionTempLine = null;
let exclusionRubberband = null;
let exclusionPolygons = [];
let exclusionSnappers = [];
let mapSnapMarker = null;
let throttled3DTimeout = null;
let last3DUpdateTime = 0;

// Exclusion primitives variables
let currentExclusionTool = 'polygon';
let exclusionPathwayStart = null;
let exclusionWalkwayStart = null;
let exclusionPreviewPolygon = null;
let exclusionTempMarker = null;
let substationRotationMarker = null;
let substationCenterMarker = null;
let substationConnectLine = null;
let activeSubstationPoly = null;

// Obstacle variables
let isObstacleDrawMode = false;
let obstaclePoints = [];
let obstacleTempLine = null;
let obstaclePolygons = [];
let obstacleGroup = null;

// Site Boundary variables
let customSiteBoundary = null;
let isSiteBoundaryDrawMode = false;
let siteBoundaryPoints = [];
let siteBoundaryTempLine = null;
let siteBoundarySnappers = [];

// Planning mode states: 'locked' or 'edit'
let siteBoundaryState = 'locked';
let exclusionState = 'locked';
let obstacleState = 'locked';

// Selected polygon for editing toolbox
let activeSelectedPolygon = null;


const EARTH_RADIUS = 6378137;

/**
 * Initialize Leaflet Map with Esri World Imagery (Satellite)
 */
/* ==========================================================================
   2. Leaflet 地圖模組與控制器 (Leaflet Map Initialization & Controls)
   ========================================================================== */
/**
 * 初始化 Leaflet 地圖模組
 * @param {number} lat - 緯度
 * @param {number} lng - 經度
 * @param {Function} onMarkerDrag - 拖曳標記回呼函式
 */
function initMap(lat, lng, onMarkerDrag) {
    // 1. Initialize Map (disable default zoomControl to prevent layout overlap)
    map = L.map('leaflet-map', {
        zoomControl: false,
        minZoom: 2,
        maxZoom: 24,
        preferCanvas: true
    }).setView([lat, lng], 18);

    actualModulesLayerGroup = L.layerGroup().addTo(map);
    prefetchReverseGeocode(lat, lng);

    // Add zoomControl to the bottom-right corner instead
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 2. Define multiple map sources for user choice
    // Google Satellite Hybrid (Satellite + Labels) - Very high resolution globally
    const googleHybrid = L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
        attribution: '&copy; Google Maps',
        maxNativeZoom: 20,
        maxZoom: 24,
        crossOrigin: 'anonymous'
    });

    // Taiwan NLSC Orthophoto (Taiwan local sub-meter aerial survey - ultra high resolution locally)
    const nlscPhoto = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/{z}/{y}/{x}', {
        attribution: '&copy; 內政部國土測繪中心',
        maxNativeZoom: 20,
        maxZoom: 24,
        crossOrigin: 'anonymous'
    });

    // Esri Satellite Map
    const esriSatellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxNativeZoom: 19,
        maxZoom: 24,
        crossOrigin: 'anonymous'
    });
    // OSM Map Labels Overlay
    const esriLabels = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 24,
        crossOrigin: 'anonymous'
    });
    const esriGroup = L.layerGroup([esriSatellite, esriLabels]);

    // NLSC Electronic Map (Taiwan Local Street Map)
    const nlscEmap = L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}', {
        attribution: '&copy; 內政部國土測繪中心',
        maxNativeZoom: 20,
        maxZoom: 24,
        crossOrigin: 'anonymous'
    });

    // OpenStreetMap standard road map
    const osmRoad = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 24,
        crossOrigin: 'anonymous'
    });

    // 3. Add default layer (Google Hybrid is recommended for clarity)
    googleHybrid.addTo(map);

    // 4. Register Base Layers and add Layer Control to top-right
    const baseLayers = {
        "Google 衛星混合圖 (推薦)": googleHybrid,
        "國土測繪航照圖 (超高解析度)": nlscPhoto,
        "Esri 衛星地圖": esriGroup,
        "國土測繪電子地圖": nlscEmap,
        "OpenStreetMap 道路圖": osmRoad
    };
    L.control.layers(baseLayers, null, { position: 'bottomright' }).addTo(map);

    // 5. Create Draggable Marker
    marker = L.marker([lat, lng], {
        draggable: true,
        title: "案場中心位置"
    }).addTo(map);

    // 6. Handle Drag Event
    marker.on('dragend', () => {
        const position = marker.getLatLng();
        onMarkerDrag(position.lat, position.lng);
    });

    // 7. Map click to reposition marker
    map.on('click', (event) => {
        if (isMapMeasureMode) {
            handleMapMeasureClick(event.latlng);
            return;
        }
        if (isSiteBoundaryDrawMode) {
            handleSiteBoundaryMapClick(event.latlng);
            return;
        }
        if (isExclusionDrawMode) {
            handleExclusionMapClick(event.latlng);
            return;
        }
        if (isObstacleDrawMode) {
            handleObstacleMapClick(event.latlng);
            return;
        }
        if (isPegmanMode) {
            showStreetView(event.latlng.lat, event.latlng.lng);
            isPegmanMode = false;
            if (elements.btnMapPegman) elements.btnMapPegman.classList.remove('active');
            if (map.getContainer()) map.getContainer().style.cursor = '';
            return;
        }
        
        // Clear active selection and substation edit handles when clicking map
        clearActivePolygonSelection();

        // reposition marker if in edit mode and no custom boundary exists
        if (siteBoundaryState === 'edit' && !customSiteBoundary) {
            const position = event.latlng;
            marker.setLatLng(position);
            onMarkerDrag(position.lat, position.lng);
        }
    });

    // 8. Keydown event for Esc key on map (in case map has keyboard focus)
    map.on('keydown', (e) => {
        const key = e.originalEvent.key;
        if (key === 'Escape' || key === 'Esc') {
            if (isRightAngleSnapActive || isRectangleSnapActive) {
                isRightAngleSnapBypassed = true;
                isRightAngleSnapActive = false;
                isRectangleSnapActive = false;
                clearRightAngleIndicator();
                if (lastMouseMoveEvent) {
                    if (isSiteBoundaryDrawMode) handleSiteBoundaryMouseMove(lastMouseMoveEvent);
                    else if (isObstacleDrawMode) handleObstacleMouseMove(lastMouseMoveEvent);
                    else if (isExclusionDrawMode && currentExclusionTool === 'polygon') handleExclusionMouseMove(lastMouseMoveEvent);
                }
                return;
            }
            if (isMapMeasureMode) {
                exitMapMeasureMode();
            }
            if (isSiteBoundaryDrawMode) {
                clearSiteBoundaryDrawingState();
                updateSiteBoundaryDrawState();
            }
            if (isExclusionDrawMode) {
                clearExclusionDrawingState();
                exitExclusionDrawMode();
            }
            if (isObstacleDrawMode) {
                clearObstacleDrawingState();
                exitObstacleDrawMode();
            }
            if (isPegmanMode || pegmanMarker) {
                removePegmanMarker();
            }
        }
    });
    // Prevent click propagation to Leaflet map for all custom floating panels and search boxes
    const customControls = [
        document.getElementById('exclusion-tool-panel'),
        document.getElementById('obstacle-tool-panel'),
        document.getElementById('btn-add-exclusion-trigger'),
        document.getElementById('btn-add-obstacle-trigger'),
        document.querySelector('.map-search-box')
    ];
    customControls.forEach(el => {
        if (el) L.DomEvent.disableClickPropagation(el);
    });
    
    // 地圖右鍵點擊事件（若在繪製中則取消吸附／顯示選單）
    map.on('contextmenu', (e) => {
        if (e.originalEvent) {
            e.originalEvent.preventDefault();
            
            // 若正處於直角吸附中，右鍵點擊可取消吸附並切換為自由線段
            if (isRightAngleSnapActive || isRectangleSnapActive) {
                isRightAngleSnapBypassed = true;
                isRightAngleSnapActive = false;
                isRectangleSnapActive = false;
                clearRightAngleIndicator();
                if (lastMouseMoveEvent) {
                    if (isSiteBoundaryDrawMode) handleSiteBoundaryMouseMove(lastMouseMoveEvent);
                    else if (isObstacleDrawMode) handleObstacleMouseMove(lastMouseMoveEvent);
                    else if (isExclusionDrawMode && currentExclusionTool === 'polygon') handleExclusionMouseMove(lastMouseMoveEvent);
                }
                return;
            }
            
            showMapContextMenu(e.originalEvent.clientX, e.originalEvent.clientY);
        }
    });

    map.on('zoomend', keepToolboxPopupInViewport);
    map.on('moveend', keepToolboxPopupInViewport);
    map.on('resize', keepToolboxPopupInViewport);
    map.on('viewreset', keepToolboxPopupInViewport);

    updateMarkerDragStates();
    initPegmanControl();
}

// ==========================================
// Street View Pegman (街景小人) Management
// ==========================================
let pegmanMarker = null;
let isPegmanMode = false;
let pegmanGhostEl = null;

function removePegmanMarker() {
    if (pegmanMarker && map) {
        map.removeLayer(pegmanMarker);
        pegmanMarker = null;
    }
    if (elements.btnMapPegman) {
        elements.btnMapPegman.classList.remove('active');
    }
    isPegmanMode = false;
    if (map && map.getContainer()) {
        map.getContainer().style.cursor = '';
    }
}

function showStreetView(lat, lng) {
    if (!map) return;
    
    // Create pegman icon with SVG and pulsing radar ring
    const pegmanIcon = L.divIcon({
        className: 'pegman-map-marker',
        html: `
            <div class="pegman-marker-pulse"></div>
            <div class="pegman-marker-icon" title="拖曳以更換街景位置">
                <img src="images/man.svg" />
            </div>
        `,
        iconSize: [36, 44],
        iconAnchor: [18, 38],
        popupAnchor: [0, -38]
    });

    if (!pegmanMarker) {
        pegmanMarker = L.marker([lat, lng], {
            icon: pegmanIcon,
            draggable: true,
            zIndexOffset: 10000
        }).addTo(map);

        pegmanMarker.on('dragend', (e) => {
            const newPos = e.target.getLatLng();
            updateStreetViewPopup(newPos.lat, newPos.lng);
        });

        pegmanMarker.on('popupclose', () => {
            removePegmanMarker();
        });
    } else {
        pegmanMarker.setLatLng([lat, lng]);
    }

    updateStreetViewPopup(lat, lng);
}

let streetViewPopupW = 380;
let streetViewPopupH = 290;
let isInteractingWithStreetView = false;

function updateStreetViewPopup(lat, lng) {
    if (!pegmanMarker) return;

    const popupHtml = `
        <div class="streetview-popup-box" style="width: ${streetViewPopupW}px; height: ${streetViewPopupH}px;">
            <div class="streetview-popup-bar" title="按住可拖曳移動視窗位置">
                <div class="streetview-bar-title">
                    <span class="streetview-drag-handle-dots">⋮⋮</span>
                    <img src="images/man.svg" class="streetview-bar-icon" />
                    <span>360° 實景街景</span>
                </div>
                <a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lng.toFixed(6)}" target="_blank" rel="noopener noreferrer" class="streetview-external-link" title="在 Google Maps 開啟全螢幕街景">
                    <span>另開全螢幕 ↗</span>
                </a>
            </div>
            <div class="streetview-iframe-container">
                <iframe 
                    src="https://maps.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}&layer=c&cbll=${lat.toFixed(6)},${lng.toFixed(6)}&cbp=12,0,0,0,0&output=svembed" 
                    allowfullscreen 
                    loading="lazy">
                </iframe>
            </div>
            <div class="streetview-popup-info">
                <div class="streetview-coords">
                    <img src="images/positioning.svg" class="streetview-coords-icon" />
                    <span>${lat.toFixed(6)}, ${lng.toFixed(6)}</span>
                </div>
                <div class="streetview-footer-actions">
                    <button type="button" class="streetview-remove-btn" onclick="removePegmanMarker()">關閉街景</button>
                    <div class="streetview-resize-handle" title="按住拖曳等比例縮放視窗">
                        <svg viewBox="0 0 12 12" width="12" height="12">
                            <path d="M10 2 L2 10 M11 6 L6 11 M11 10 L10 11" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round"/>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    `;

    pegmanMarker.bindPopup(popupHtml, {
        maxWidth: 2000,
        minWidth: 260,
        className: 'streetview-custom-popup',
        autoPan: false,
        closeOnClick: false,
        autoClose: false,
        closeOnEscapeKey: true,
        closeButton: true
    }).openPopup();

    setTimeout(() => {
        const popupEl = document.querySelector('.leaflet-popup.streetview-custom-popup');
        if (popupEl) {
            L.DomEvent.disableClickPropagation(popupEl);
            L.DomEvent.disableScrollPropagation(popupEl);
            clampStreetViewPopupInBounds(popupEl);
            setupStreetViewResize(popupEl);
            setupStreetViewMove(popupEl);
        }
    }, 50);
}

function clampStreetViewPopupInBounds(popupEl) {
    if (!popupEl || !map) return;
    const mapEl = map.getContainer();
    if (!mapEl) return;

    const mapRect = mapEl.getBoundingClientRect();
    const parentEl = popupEl.offsetParent || document.body;
    const parentRect = parentEl.getBoundingClientRect();
    const popupRect = popupEl.getBoundingClientRect();

    const minTop = mapRect.top + 45; // 避開地圖頂部標題列
    const maxBottom = mapRect.bottom - 10;
    const minLeft = mapRect.left + 10;
    const maxRight = mapRect.right - 10;

    let curLeft = popupRect.left;
    let curTop = popupRect.top;

    if (curTop < minTop) curTop = minTop;
    if (curTop + popupRect.height > maxBottom) {
        curTop = Math.max(minTop, maxBottom - popupRect.height);
    }
    if (curLeft < minLeft) curLeft = minLeft;
    if (curLeft + popupRect.width > maxRight) {
        curLeft = Math.max(minLeft, maxRight - popupRect.width);
    }

    popupEl.style.transform = 'none';
    popupEl.style.left = `${curLeft - parentRect.left}px`;
    popupEl.style.top = `${curTop - parentRect.top}px`;
}

function setupStreetViewMove(popupEl) {
    const titleBar = popupEl.querySelector('.streetview-popup-bar');
    const iframe = popupEl.querySelector('.streetview-iframe-container iframe');
    if (!titleBar || !map) return;

    let isMoving = false;
    let startX = 0;
    let startY = 0;
    let initialLeft = 0;
    let initialTop = 0;
    let popupW = 0;
    let popupH = 0;
    let parentRect = { left: 0, top: 0 };

    const onPointerMove = (e) => {
        if (!isMoving) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;

        const mapEl = map.getContainer();
        const mapRect = mapEl.getBoundingClientRect();

        const minTop = mapRect.top + 45 - parentRect.top;
        const maxTop = Math.max(minTop, mapRect.bottom - popupH - 10 - parentRect.top);
        const minLeft = mapRect.left + 10 - parentRect.left;
        const maxLeft = Math.max(minLeft, mapRect.right - popupW - 10 - parentRect.left);

        const nextLeft = Math.max(minLeft, Math.min(maxLeft, initialLeft + dx));
        const nextTop = Math.max(minTop, Math.min(maxTop, initialTop + dy));

        popupEl.style.left = `${nextLeft}px`;
        popupEl.style.top = `${nextTop}px`;

        if (e.cancelable) e.preventDefault();
    };

    const onPointerUp = () => {
        if (!isMoving) return;
        isMoving = false;
        isInteractingWithStreetView = false;
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('touchmove', onPointerMove);
        if (iframe) iframe.style.pointerEvents = 'auto';
        if (map && map.dragging) map.dragging.enable();

        const absorbClick = (evt) => {
            evt.stopPropagation();
            evt.preventDefault();
        };
        window.addEventListener('click', absorbClick, { capture: true, once: true });
    };

    const onPointerDown = (e) => {
        if (e.target.closest('.streetview-external-link') || e.target.closest('.leaflet-popup-close-button')) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();

        isMoving = true;
        isInteractingWithStreetView = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;

        const rect = popupEl.getBoundingClientRect();
        popupW = rect.width;
        popupH = rect.height;

        const parentEl = popupEl.offsetParent || document.body;
        parentRect = parentEl.getBoundingClientRect();
        initialLeft = rect.left - parentRect.left;
        initialTop = rect.top - parentRect.top;

        popupEl.style.transform = 'none';
        popupEl.style.left = `${initialLeft}px`;
        popupEl.style.top = `${initialTop}px`;

        if (iframe) iframe.style.pointerEvents = 'none';
        if (map && map.dragging) map.dragging.disable();

        window.addEventListener('mousemove', onPointerMove, { passive: false });
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp, { once: true });
        window.addEventListener('touchend', onPointerUp, { once: true });
    };

    titleBar.addEventListener('mousedown', onPointerDown);
    titleBar.addEventListener('touchstart', onPointerDown, { passive: false });
}

function setupStreetViewResize(popupEl) {
    const handle = popupEl.querySelector('.streetview-resize-handle');
    const box = popupEl.querySelector('.streetview-popup-box');
    const iframe = popupEl.querySelector('.streetview-iframe-container iframe');
    if (!handle || !box || !map) return;

    let startX = 0;
    let startW = 0;
    let currentPopupLeft = 0;
    let currentPopupTop = 0;
    const aspectRatio = 380 / 290;

    const onPointerMove = (e) => {
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const deltaX = clientX - startX;

        const mapEl = map.getContainer();
        const mapRect = mapEl.getBoundingClientRect();

        // 確保視窗右側與底側不會超出地圖可見邊界
        const maxWByRight = mapRect.right - currentPopupLeft - 15;
        const maxWByBottom = (mapRect.bottom - currentPopupTop - 15) * aspectRatio;
        const maxLimit = Math.max(260, Math.min(window.innerWidth * 0.92, maxWByRight, maxWByBottom));

        let newW = Math.max(260, Math.min(maxLimit, startW + deltaX));
        let newH = Math.round(newW / aspectRatio);

        streetViewPopupW = Math.round(newW);
        streetViewPopupH = newH;

        box.style.width = `${newW}px`;
        box.style.height = `${newH}px`;

        const contentEl = popupEl.querySelector('.leaflet-popup-content');
        if (contentEl) {
            contentEl.style.width = `${newW}px`;
        }

        if (e.cancelable) e.preventDefault();
    };

    const onPointerUp = () => {
        isInteractingWithStreetView = false;
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('touchmove', onPointerMove);
        if (iframe) iframe.style.pointerEvents = 'auto';
        if (map && map.dragging) map.dragging.enable();

        const absorbClick = (evt) => {
            evt.stopPropagation();
            evt.preventDefault();
        };
        window.addEventListener('click', absorbClick, { capture: true, once: true });
    };

    const onPointerDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        isInteractingWithStreetView = true;

        // 鎖定左上角座標：將 Leaflet 的 transform 轉換為絕對 left 與 top 定位，確保左上角完全固定不動
        const rect = popupEl.getBoundingClientRect();
        currentPopupLeft = rect.left;
        currentPopupTop = rect.top;

        const parentEl = popupEl.offsetParent || document.body;
        const parentRect = parentEl.getBoundingClientRect();
        const fixedLeft = rect.left - parentRect.left;
        const fixedTop = rect.top - parentRect.top;

        popupEl.style.transform = 'none';
        popupEl.style.left = `${fixedLeft}px`;
        popupEl.style.top = `${fixedTop}px`;

        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startW = box.getBoundingClientRect().width;

        if (iframe) iframe.style.pointerEvents = 'none';
        if (map && map.dragging) map.dragging.disable();

        window.addEventListener('mousemove', onPointerMove, { passive: false });
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp, { once: true });
        window.addEventListener('touchend', onPointerUp, { once: true });
    };

    handle.addEventListener('mousedown', onPointerDown);
    handle.addEventListener('touchstart', onPointerDown, { passive: false });
}

function initPegmanControl() {
    const btn = document.getElementById('btn-map-pegman');
    if (!btn || !map) return;

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let didMove = false;

    const onPointerDown = (e) => {
        isDragging = true;
        didMove = false;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartX = clientX;
        dragStartY = clientY;

        // Create ghost avatar
        if (!pegmanGhostEl) {
            pegmanGhostEl = document.createElement('div');
            pegmanGhostEl.className = 'pegman-drag-ghost';
            pegmanGhostEl.innerHTML = '<img src="images/man.svg" />';
            pegmanGhostEl.style.left = `${clientX}px`;
            pegmanGhostEl.style.top = `${clientY}px`;
            pegmanGhostEl.style.display = 'none';
            document.body.appendChild(pegmanGhostEl);
        }

        window.addEventListener('mousemove', onPointerMove, { passive: false });
        window.addEventListener('touchmove', onPointerMove, { passive: false });
        window.addEventListener('mouseup', onPointerUp, { once: true });
        window.addEventListener('touchend', onPointerUp, { once: true });
    };

    const onPointerMove = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dist = Math.hypot(clientX - dragStartX, clientY - dragStartY);
        if (dist > 8) {
            didMove = true;
            if (pegmanGhostEl) {
                pegmanGhostEl.style.display = 'block';
                pegmanGhostEl.style.left = `${clientX}px`;
                pegmanGhostEl.style.top = `${clientY}px`;
            }
            if (e.cancelable) e.preventDefault();
        }
    };

    const onPointerUp = (e) => {
        window.removeEventListener('mousemove', onPointerMove);
        window.removeEventListener('touchmove', onPointerMove);
        isDragging = false;

        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

        if (pegmanGhostEl) {
            pegmanGhostEl.remove();
            pegmanGhostEl = null;
        }

        if (didMove) {
            // Drop on map check
            const mapEl = map.getContainer();
            const rect = mapEl.getBoundingClientRect();
            if (
                clientX >= rect.left &&
                clientX <= rect.right &&
                clientY >= rect.top &&
                clientY <= rect.bottom
            ) {
                const pt = L.point(clientX - rect.left, clientY - rect.top);
                const latlng = map.containerPointToLatLng(pt);
                showStreetView(latlng.lat, latlng.lng);
            }
        } else {
            // Toggle placement click mode
            isPegmanMode = !isPegmanMode;
            btn.classList.toggle('active', isPegmanMode);
            if (map.getContainer()) {
                map.getContainer().style.cursor = isPegmanMode ? 'crosshair' : '';
            }
        }
    };

    btn.addEventListener('mousedown', onPointerDown);
    btn.addEventListener('touchstart', onPointerDown, { passive: true });
}

function updateMarker(lat, lng) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    }
}

function centerMap(lat, lng) {
    if (map) {
        map.setView([lat, lng], 18);
    }
}

function updateArrowVisualsOnly(cLat, cLng, aLen, wLen, az, pStyle) {
    const metersPerLatDegree = 111320;
    const latRad = (cLat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const aRad = (az * Math.PI) / 180;
    const C = [cLat, cLng];
    
    const dLat = (aLen * Math.cos(aRad)) / metersPerLatDegree;
    const dLng = (aLen * Math.sin(aRad)) / metersPerLngDegree;
    const P = [cLat + dLat, cLng + dLng];
    
    const ang1 = aRad + (145 * Math.PI) / 180;
    const P1 = [P[0] + (wLen * Math.cos(ang1)) / metersPerLatDegree, P[1] + (wLen * Math.sin(ang1)) / metersPerLngDegree];
    const ang2 = aRad - (145 * Math.PI) / 180;
    const P2 = [P[0] + (wLen * Math.cos(ang2)) / metersPerLatDegree, P[1] + (wLen * Math.sin(ang2)) / metersPerLngDegree];
    
    let P_back = C;
    let P_back1 = C, P_back2 = C;
    const isDoublePitch = (pStyle === 'double' || pStyle === 'double-v');
    if (isDoublePitch) {
        P_back = [cLat - dLat, cLng - dLng];
        const ang3 = (aRad + Math.PI) + (145 * Math.PI) / 180;
        P_back1 = [P_back[0] + (wLen * Math.cos(ang3)) / metersPerLatDegree, P_back[1] + (wLen * Math.sin(ang3)) / metersPerLngDegree];
        const ang4 = (aRad + Math.PI) - (145 * Math.PI) / 180;
        P_back2 = [P_back[0] + (wLen * Math.cos(ang4)) / metersPerLatDegree, P_back[1] + (wLen * Math.sin(ang4)) / metersPerLngDegree];
    }
    
    const shaftCoords = isDoublePitch ? [P_back, P] : [C, P];
    if (directionShaft) {
        directionShaft.setLatLngs(shaftCoords);
    } else if (map) {
        directionShaft = L.polyline(shaftCoords, {
            color: 'rgba(0, 170, 255, 1)',
            weight: 3.0,
            opacity: 0.9,
            interactive: false
        }).addTo(map);
    }
    
    const forwardCoords = [P1, P, P2];
    if (directionHeadForward) {
        directionHeadForward.setLatLngs(forwardCoords);
    } else if (map) {
        directionHeadForward = L.polyline(forwardCoords, {
            color: 'rgba(0, 170, 255, 1)',
            weight: 5.0,
            opacity: 0.9,
            interactive: false
        }).addTo(map);
    }
    
    if (isDoublePitch) {
        const backwardCoords = [P_back1, P_back, P_back2];
        if (directionHeadBackward) {
            directionHeadBackward.setLatLngs(backwardCoords);
        }
    }
    
    return P;
}

function updateCoverage(centerLat, centerLng, width, length, azimuth, pitchStyle) {
    if (!map) return;

    const halfW = width / 2;
    const halfL = length / 2;
    
    const cornersOffset = [
        { dx: -halfW, dy: halfL },  // Top-Left
        { dx: halfW, dy: halfL },   // Top-Right
        { dx: halfW, dy: -halfL },  // Bottom-Right
        { dx: -halfW, dy: -halfL }  // Bottom-Left
    ];

    const thetaRad = (-azimuth * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);

    const rotatedCorners = cornersOffset.map(c => {
        const rx = c.dx * cosTheta - c.dy * sinTheta;
        const ry = c.dx * sinTheta + c.dy * cosTheta;
        return { x: rx, y: ry };
    });

    const metersPerLatDegree = 111320;
    const latRad = (centerLat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);

    const cornerLatLngs = rotatedCorners.map(c => {
        const dLat = c.y / metersPerLatDegree;
        const dLng = c.x / metersPerLngDegree;
        return [centerLat + dLat, centerLng + dLng];
    });

    if (customSiteBoundary) {
        if (coveragePolygon) {
            map.removeLayer(coveragePolygon);
            coveragePolygon = null;
        }
    } else {
        if (coveragePolygon) {
            coveragePolygon.setLatLngs(cornerLatLngs);
            coveragePolygon.setStyle({
                color: 'rgba(148, 163, 184, 0.85)',
                weight: 1.8,
                dashArray: '5, 5',
                fill: false,
                fillOpacity: 0
            });
        } else {
            coveragePolygon = L.polygon(cornerLatLngs, {
                color: 'rgba(148, 163, 184, 0.85)',
                fill: false,
                fillOpacity: 0,
                weight: 1.8,
                dashArray: '5, 5',
                interactive: false
            }).addTo(map);
        }
    }
    
    // ------------------------------------------
    // Draw / Update Azimuth Direction Arrow
    // ------------------------------------------
    const arrowLen = Math.max(7.0, Math.min(22.0, Math.max(width, length) * 0.42));
    const wingLen = arrowLen * 0.35;
    
    const P = updateArrowVisualsOnly(centerLat, centerLng, arrowLen, wingLen, azimuth, pitchStyle);
    const isDoublePitch = (pitchStyle === 'double' || pitchStyle === 'double-v');
    
    if (isDoublePitch) {
        if (!directionHeadBackward) {
            directionHeadBackward = L.polyline([], {
                color: 'rgba(0, 170, 255, 1)',
                weight: 3.5,
                opacity: 0.95,
                interactive: false
            }).addTo(map);
            updateArrowVisualsOnly(centerLat, centerLng, arrowLen, wingLen, azimuth, pitchStyle);
        }
    } else {
        if (directionHeadBackward) {
            map.removeLayer(directionHeadBackward);
            directionHeadBackward = null;
        }
    }
    
    const handleIcon = L.divIcon({
        className: 'arrow-handle',
        html: '<div style="background: radial-gradient(circle, #38bdf8 0%, #0284c7 100%); width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid #ffffff; box-shadow: 0 0 10px rgba(56, 189, 248, 0.8), 0 2px 6px rgba(0,0,0,0.5); cursor: grab; margin: 2px auto; transition: transform 0.15s ease;"></div>',
        iconSize: [26, 26],
        iconAnchor: [13, 13]
    });
    
    if (arrowHandleMarker) {
        if (!isDraggingArrow) {
            arrowHandleMarker.setLatLng(P);
        }
    } else {
        arrowHandleMarker = L.marker(P, {
            icon: handleIcon,
            draggable: true,
            zIndexOffset: 1200
        }).addTo(map);
        
        arrowHandleMarker.on('dragstart', () => {
            isDraggingArrow = true;
        });
        
        arrowHandleMarker.on('drag', (e) => {
            const curCenterLat = state.lat;
            const curCenterLng = state.lng;
            const metersPerLatDegree = 111320;
            const latRad = (curCenterLat * Math.PI) / 180;
            const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
            
            const newLatLng = e.target.getLatLng();
            const dLat = newLatLng.lat - curCenterLat;
            const dLng = newLatLng.lng - curCenterLng;
            const dy = dLat * metersPerLatDegree;
            const dx = dLng * metersPerLngDegree;
            let angleRad = Math.atan2(dx, dy);
            let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
            
            // Smart cardinal snapping (0/360, 90, 180, 270 within 3.5 deg, 45/135/225/315 within 2 deg)
            const cardinals = [0, 90, 180, 270, 360];
            let snappedAngle = angleDeg;
            for (const card of cardinals) {
                let diff = Math.abs(angleDeg - card);
                if (diff > 180) diff = 360 - diff;
                if (diff <= 3.5) {
                    snappedAngle = card % 360;
                    break;
                }
            }
            if (snappedAngle === angleDeg) {
                const octants = [45, 135, 225, 315];
                for (const oct of octants) {
                    let diff = Math.abs(angleDeg - oct);
                    if (diff > 180) diff = 360 - diff;
                    if (diff <= 2.0) {
                        snappedAngle = oct;
                        break;
                    }
                }
            }
            if (snappedAngle === angleDeg) {
                snappedAngle = (Math.round(angleDeg * 2) / 2) % 360;
            }
            
            state.azimuth = snappedAngle;
            if (elements.azimuth) elements.azimuth.value = snappedAngle;
            if (elements.azimuthSlider) elements.azimuthSlider.value = snappedAngle;
            
            const curW = parseFloat(state.dimW) || width || 20;
            const curL = parseFloat(state.dimH) || length || 20;
            const curArrowLen = Math.max(7.0, Math.min(22.0, Math.max(curW, curL) * 0.42));
            const curWingLen = curArrowLen * 0.35;
            
            // Fast 2D arrow updates strictly from current site center
            updateArrowVisualsOnly(curCenterLat, curCenterLng, curArrowLen, curWingLen, snappedAngle, state.pitchStyle || pitchStyle);
        });
        
        arrowHandleMarker.on('dragend', () => {
            isDraggingArrow = false;
            calculateOutputs();
            updateAllVisuals(true);
        });
    }
    updateSiteArea();
}

function updateSiteArea() {
    if (!elements.siteArea) return;
    
    let areaValue = 0;
    
    if (customSiteBoundary && typeof customSiteBoundary.toGeoJSON === 'function' && window.turf) {
        try {
            areaValue = turf.area(customSiteBoundary.toGeoJSON());
        } catch (e) {
            console.error("Error calculating customSiteBoundary area: ", e);
        }
    } else if (coveragePolygon && typeof coveragePolygon.toGeoJSON === 'function' && window.turf) {
        try {
            areaValue = turf.area(coveragePolygon.toGeoJSON());
        } catch (e) {
            console.error("Error calculating coveragePolygon area: ", e);
        }
    } else {
        const w = parseFloat(state.dimW) || 0;
        const h = parseFloat(state.dimH) || 0;
        areaValue = w * h;
    }
    
    elements.siteArea.value = areaValue.toFixed(2);
}

// ==========================================
// 2. THREE.JS 3D PREVIEW MODULE
// ==========================================
let scene = null;
let camera = null;
let renderer = null;
let controls = null;
let pvGroup = null;
let ground = null;
let gridHelper = null;
let roofPlane = null;
let materials = {};
let sunLight = null;
let ambientLight = null;
let avgModuleWorldY = 1.5;
let compassGroup = null;
let lastFileHandle = null;

// Measurement Tape variables
let isMeasureMode = false;
let measurePoints = [];
let measureLines = [];
let activeMeasureLine = null;
let activeMeasureLabel = null;
let snapIndicator = null;
let snapIndicatorOuter = null;
let measureStartMarker = null;
let measureStartOuter = null;
let snappedPoint = null;
let isNormalMode = false;

/* ==========================================================================
   3. Three.js 3D 視圖與太陽光影模擬模組 (Three.js 3D Scene & Sun Simulation)
   ========================================================================== */
/**
 * 初始化 Three.js 3D 視圖與日照模擬
 */
function initViewer(canvasId) {
    const canvas = document.getElementById(canvasId);
    const container = canvas.parentElement;
    
    scene = new THREE.Scene();
    
    camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.02, 4000);
    camera.position.set(15, 12, 20);
    
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Set transparent clear color to reveal the CSS blue sky background
    renderer.setClearColor(0x000000, 0);
    
    // Using UMD OrbitControls from THREE namespace
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.minDistance = 0.05;
    controls.maxDistance = 4000;
    controls.enableZoom = false; // Disable default zoom to implement custom zoom-to-cursor
    controls.target.set(0, 1.5, 0);
    
    // Map mouse controls: Left button rotates, Middle/Right buttons pan
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.PAN,
        RIGHT: THREE.MOUSE.PAN
    };
    
    // Softened ambient light to keep scene well-lit
    ambientLight = new THREE.AmbientLight(0xffffff, 0.70);
    scene.add(ambientLight);
    
    // Balanced sunlight to reduce glare
    sunLight = new THREE.DirectionalLight(0xfffdf0, 0.85);
    sunLight.position.set(40, 60, 30);
    sunLight.castShadow = true;
    
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1500;
    
    const d = 120;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.03;
    scene.add(sunLight);
    scene.add(sunLight.target);

    // Light-blue fill light for clean blueish shadows
    const fillLight = new THREE.DirectionalLight(0xbde0ff, 0.2);
    fillLight.position.set(-30, 20, -30);
    scene.add(fillLight);
    
    // Light gray grid helper
    gridHelper = new THREE.GridHelper(5000, 500, 0x14b8a6, 0xe2e8f0);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);
    
    // Light-gray concrete floor expanded for massive utility-scale plants
    const groundGeo = new THREE.PlaneGeometry(5000, 5000);
    const groundMat = new THREE.MeshStandardMaterial({
        color: 0x7ea070, // Grass green color for ground
        roughness: 0.95,
        metalness: 0.0
    });
    ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    pvGroup = new THREE.Group();
    scene.add(pvGroup);
    
    obstacleGroup = new THREE.Group();
    scene.add(obstacleGroup);
    
    // ------------------------------------------
    // 3D Compass & North Arrow (HUD 羅盤，固定於視窗左上方)
    // ------------------------------------------
    compassGroup = new THREE.Group();
    compassGroup.scale.set(0.15, 0.15, 0.15); // 縮放羅盤 HUD 尺寸
    scene.add(camera); // 將相機加入場景中以容納 HUD 子物件
    camera.add(compassGroup); // 綁定至相機
    
    // 1. Compass Flat Ring (羅盤外環圓盤)
    const ringGeo = new THREE.RingGeometry(1.8, 2.0, 32);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x475569, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    compassGroup.add(ring);
    
    // 2. North Pointer (紅色北向指針)
    const coneNorthGeo = new THREE.ConeGeometry(0.3, 1.6, 4);
    const coneNorthMat = new THREE.MeshStandardMaterial({ color: 0xef4444, depthTest: false, depthWrite: false });
    const coneNorth = new THREE.Mesh(coneNorthGeo, coneNorthMat);
    coneNorth.rotation.x = -Math.PI / 2;
    coneNorth.position.set(0, 0.08, -0.8);
    compassGroup.add(coneNorth);
    
    // 3. South Pointer (白色南向指針)
    const coneSouthGeo = new THREE.ConeGeometry(0.3, 1.6, 4);
    const coneSouthMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, depthTest: false, depthWrite: false });
    const coneSouth = new THREE.Mesh(coneSouthGeo, coneSouthMat);
    coneSouth.rotation.x = Math.PI / 2;
    coneSouth.position.set(0, 0.08, 0.8);
    compassGroup.add(coneSouth);
    
    // 4. 立體北向文字 "N" (朝向北方)
    const nLetterGroup = new THREE.Group();
    nLetterGroup.position.set(0, 0.08, -2.6);
    compassGroup.add(nLetterGroup);
    
    const nMat = new THREE.MeshStandardMaterial({ color: 0xef4444, depthTest: false, depthWrite: false });
    
    // Left vertical bar of "N"
    const leftBarGeo = new THREE.BoxGeometry(0.1, 0.16, 0.7);
    const leftBar = new THREE.Mesh(leftBarGeo, nMat);
    leftBar.position.set(-0.25, 0, 0);
    nLetterGroup.add(leftBar);
    
    // Right vertical bar of "N"
    const rightBarGeo = new THREE.BoxGeometry(0.1, 0.16, 0.7);
    const rightBar = new THREE.Mesh(rightBarGeo, nMat);
    rightBar.position.set(0.25, 0, 0);
    nLetterGroup.add(rightBar);
    
    // Diagonal bar of "N"
    const diagBarGeo = new THREE.BoxGeometry(0.1, 0.16, 0.85);
    const diagBar = new THREE.Mesh(diagBarGeo, nMat);
    diagBar.rotation.y = 0.65; // Tilt to form diagonal of N (corrected orientation)
    diagBar.position.set(0, 0, 0);
    nLetterGroup.add(diagBar);

    // 強制設定所有 HUD 網格之渲染順序 (RenderOrder)，讓其永遠顯示在最上層
    compassGroup.traverse((child) => {
        if (child.isMesh) {
            child.renderOrder = 9999;
        }
    });
    
    // Snapping indicator box (直角吸附半透明綠色 Box + 邊線 outline)
    const indicatorGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);
    const indicatorMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.65,
        depthTest: false
    });
    snapIndicator = new THREE.Mesh(indicatorGeo, indicatorMat);
    snapIndicator.renderOrder = 999;
    
    const outerIndicatorGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
    const outerIndicatorMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        wireframe: true,
        transparent: true,
        opacity: 0.8,
        depthTest: false
    });
    snapIndicatorOuter = new THREE.Mesh(outerIndicatorGeo, outerIndicatorMat);
    snapIndicatorOuter.renderOrder = 1000;
    snapIndicator.add(snapIndicatorOuter);
    
    snapIndicator.visible = false;
    scene.add(snapIndicator);
    scene.add(snapIndicator);
    
    initMaterials();
    
    window.addEventListener('resize', onWindowResize);
    
    animate();

    // Setup Context Menu for 3D Viewer right-click
    let rightClickStart = { x: 0, y: 0 };
    let rightClickTime = 0;

    canvas.addEventListener('pointerdown', (e) => {
        if (e.button === 2) { // Right click
            rightClickStart.x = e.clientX;
            rightClickStart.y = e.clientY;
            rightClickTime = Date.now();
        }
    }, true);

    canvas.addEventListener('pointerup', (e) => {
        if (e.button === 2) { // Right click
            const dist = Math.hypot(e.clientX - rightClickStart.x, e.clientY - rightClickStart.y);
            const duration = Date.now() - rightClickTime;
            if (dist <= 5 && duration < 500) { // Click within 0.5s, drag distance <= 5px
                showContextMenu(e.clientX, e.clientY);
            }
        }
    }, true);

    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault(); // Always block standard browser menu on the canvas
    }, true);
}

function showContextMenu(x, y) {
    let menu = document.getElementById('custom-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'custom-context-menu';
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" id="menu-capture-3d">
                <span class="menu-icon">📷</span>
                <span class="menu-text">擷取3D圖片 (PNG)</span>
            </div>
            <div class="context-menu-item" id="menu-export-svg">
                <span class="menu-icon">📐</span>
                <span class="menu-text">匯出向量圖 (SVG)</span>
            </div>
        `;
        document.body.appendChild(menu);
        
        menu.querySelector('#menu-capture-3d').addEventListener('click', () => {
            capture3DImage();
            menu.style.display = 'none';
        });

        menu.querySelector('#menu-export-svg').addEventListener('click', () => {
            exportSVG();
            menu.style.display = 'none';
        });
        
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
        
        document.addEventListener('contextmenu', (e) => {
            const container = document.getElementById('three-canvas') ? document.getElementById('three-canvas').parentElement : null;
            if (!container || !container.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }
    
    // Position menu and show it
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}

// IndexedDB persistence for last export directory handle
const IDB_EXPORT_DB = 'PVSuperStorage';
const IDB_EXPORT_STORE = 'ExportHandles';
const IDB_EXPORT_KEY = 'lastExportDir';

async function getStoredExportDir() {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(IDB_EXPORT_DB, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_EXPORT_STORE)) {
                    db.createObjectStore(IDB_EXPORT_STORE);
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                try {
                    const tx = db.transaction(IDB_EXPORT_STORE, 'readonly');
                    const store = tx.objectStore(IDB_EXPORT_STORE);
                    const getReq = store.get(IDB_EXPORT_KEY);
                    getReq.onsuccess = () => resolve(getReq.result || null);
                    getReq.onerror = () => resolve(null);
                } catch (txErr) {
                    resolve(null);
                }
            };
            req.onerror = () => resolve(null);
        } catch (err) {
            resolve(null);
        }
    });
}

async function setStoredExportDir(handle) {
    return new Promise((resolve) => {
        try {
            const req = indexedDB.open(IDB_EXPORT_DB, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_EXPORT_STORE)) {
                    db.createObjectStore(IDB_EXPORT_STORE);
                }
            };
            req.onsuccess = (e) => {
                const db = e.target.result;
                try {
                    const tx = db.transaction(IDB_EXPORT_STORE, 'readwrite');
                    const store = tx.objectStore(IDB_EXPORT_STORE);
                    store.put(handle, IDB_EXPORT_KEY);
                    tx.oncomplete = () => resolve(true);
                    tx.onerror = () => resolve(false);
                } catch (txErr) {
                    resolve(false);
                }
            };
            req.onerror = () => resolve(false);
        } catch (err) {
            resolve(false);
        }
    });
}

async function saveFileWithPicker(content, defaultFilename, mimeType) {
    const isBlob = content instanceof Blob;
    const blob = isBlob ? content : new Blob([content], { type: mimeType });

    if (window.showSaveFilePicker) {
        try {
            const pickerOptions = {
                suggestedName: defaultFilename,
                id: 'pv-super-export-dir', // 目錄記憶 ID，讓使用者在匯出 PDF、JSON、圖片時記住同一資料夾路徑
                types: []
            };
            
            if (mimeType === 'application/json') {
                pickerOptions.types.push({
                    description: 'JSON 專案資料檔 (*.json)',
                    accept: { 'application/json': ['.json'] }
                });
            } else if (mimeType === 'application/pdf') {
                pickerOptions.types.push({
                    description: 'PDF 專案報告書 (*.pdf)',
                    accept: { 'application/pdf': ['.pdf'] }
                });
            } else if (mimeType === 'image/png') {
                pickerOptions.types.push({
                    description: 'PNG 影像圖檔 (*.png)',
                    accept: { 'image/png': ['.png'] }
                });
            } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                pickerOptions.types.push({
                    description: 'JPEG 影像圖檔 (*.jpg, *.jpeg)',
                    accept: { 'image/jpeg': ['.jpg', '.jpeg'] }
                });
            } else if (mimeType === 'image/svg+xml') {
                pickerOptions.types.push({
                    description: 'SVG 向量圖檔 (*.svg)',
                    accept: { 'image/svg+xml': ['.svg'] }
                });
            }
            
            // 從 IndexedDB 讀取上次選擇的目錄
            await setStoredExportDir(handle);
            
            const writable = await handle.createWritable();
            await writable.write(blob);
            await writable.close();
            return 'success';
        } catch (err) {
            if (err.name === 'AbortError') {
                return 'aborted';
            }
            console.warn('showSaveFilePicker 失敗，切換為傳統下載方式', err);
        }
    }

    // 傳統相容模式：透過 <a> 標籤下載
    const downloadAnchor = document.createElement('a');
    const url = isBlob ? URL.createObjectURL(blob) : `data:${mimeType};charset=utf-8,` + encodeURIComponent(content);
    downloadAnchor.href = url;
    downloadAnchor.setAttribute("download", defaultFilename);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    if (isBlob) {
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    return 'fallback';
}

async function capture3DImage() {
    if (!renderer || !scene || !camera) return;
    
    // 1. 記錄原始視窗大小與像素比
    const originalWidth = renderer.domElement.clientWidth;
    const originalHeight = renderer.domElement.clientHeight;
    const originalPixelRatio = renderer.getPixelRatio();
    
    // 2. 設定高解析度目標像素 (4K 寬度 3840px，輸出超清晰 PNG 圖片)
    const targetWidth = 3840;
    const targetHeight = Math.round(targetWidth * (originalHeight / originalWidth));
    
    // 3. 暫時調整渲染器與相機 aspect
    renderer.setSize(targetWidth, targetHeight, false);
    camera.aspect = targetWidth / targetHeight;
    camera.updateProjectionMatrix();
    
    // 4. 暫時調整 HUD 羅盤位置以符合高解析度長寬比 (位於 3D 預覽標題標籤下方，避免重疊)
    if (compassGroup) {
        const aspect = targetWidth / targetHeight;
        const distance = 5.0;
        const fovRad = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
        const visibleWidth = visibleHeight * aspect;
        compassGroup.position.set(
            -visibleWidth / 2 + 0.55,
            visibleHeight / 2 - 1.10,
            -distance
        );
    }
    
    // 5. 執行高解析度渲染
    renderer.render(scene, camera);
    
    // 6. 導出為 PNG 影像
    const dataUrl = renderer.domElement.toDataURL('image/png');
    
    // 7. 復原原始相機與渲染器設定
    renderer.setSize(originalWidth, originalHeight, false);
    renderer.setPixelRatio(originalPixelRatio);
    camera.aspect = originalWidth / originalHeight;
    camera.updateProjectionMatrix();
    if (compassGroup) {
        const aspect = originalWidth / originalHeight;
        const distance = 5.0;
        const fovRad = (camera.fov * Math.PI) / 180;
        const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
        const visibleWidth = visibleHeight * aspect;
        compassGroup.position.set(
            -visibleWidth / 2 + 0.55,
            visibleHeight / 2 - 1.10,
            -distance
        );
    }
    
    // 8. 建立預設檔案名稱
    const siteName = (state && state.siteName) ? state.siteName.trim() : '曜昇綠能 1號場';
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const hhmmss = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `${siteName}_${yyyymmdd}_${hhmmss}.png`;
    
    // 9. 儲存影像並交由使用者選擇路徑
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    await saveFileWithPicker(blob, fileName, 'image/png');
}

async function exportSVG() {
    if (!renderer || !scene || !camera) return;
    
    // 1920x1080 規格輸出
    const width = 1920;
    const height = 1080;
    const svgElements = [];
    
    const tempV = new THREE.Vector3();
    const tempV2 = new THREE.Vector3();
    
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    
    const ndcToSvg = (v) => {
        const x = ((v.x + 1) / 2) * width;
        const y = ((1 - v.y) / 2) * height;
        return { x, y };
    };
    
    scene.traverse((node) => {
        if (node.isMesh && node.visible) {
            if (node === ground) return;
            if (compassGroup && (node === compassGroup || node.parent === compassGroup || (node.parent && node.parent.parent === compassGroup))) return;
            
            const geometry = node.geometry;
            if (!geometry) return;
            
            const edges = new THREE.EdgesGeometry(geometry);
            const positionAttr = edges.attributes.position;
            if (!positionAttr) {
                edges.dispose();
                return;
            }
            
            let lineColor = 'rgba(0, 0, 0, 1)';
            let strokeWidth = '1.2';
            const mat = node.material;
            if (mat === materials.panelFace || mat === materials.frame) {
                lineColor = 'rgba(16, 185, 129, 1)';
                strokeWidth = '3.0';
            } else if (mat === materials.rack || mat === materials.aluminum || mat === materials.concrete) {
                lineColor = 'rgba(37, 99, 235, 1)';
                strokeWidth = '1.2';
            } else if (mat === materials.roofTile || mat === materials.building) {
                lineColor = 'rgba(51, 65, 85, 1)';
                strokeWidth = '1.2';
            }
            
            const matrixWorld = node.matrixWorld;
            
            const drawSegment = (i1, i2, worldMatrix, color) => {
                tempV.fromBufferAttribute(positionAttr, i1).applyMatrix4(worldMatrix);
                tempV2.fromBufferAttribute(positionAttr, i2).applyMatrix4(worldMatrix);
                
                const cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                const toStart = tempV.clone().sub(camera.position);
                const toEnd = tempV2.clone().sub(camera.position);
                if (toStart.dot(cameraDirection) < 0 && toEnd.dot(cameraDirection) < 0) {
                    return;
                }
                
                tempV.project(camera);
                tempV2.project(camera);
                
                if (Math.abs(tempV.z) > 1 || Math.abs(tempV2.z) > 1) return;
                
                const p1 = ndcToSvg(tempV);
                const p2 = ndcToSvg(tempV2);
                
                if (isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) return;
                
                svgElements.push(`<line x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" />`);
            };
            
            if (node.isInstancedMesh) {
                const count = node.count;
                const instanceMatrix = new THREE.Matrix4();
                const worldMatrix = new THREE.Matrix4();
                for (let i = 0; i < count; i++) {
                    node.getMatrixAt(i, instanceMatrix);
                    worldMatrix.multiplyMatrices(matrixWorld, instanceMatrix);
                    for (let j = 0; j < positionAttr.count; j += 2) {
                        drawSegment(j, j + 1, worldMatrix, lineColor);
                    }
                }
            } else {
                for (let j = 0; j < positionAttr.count; j += 2) {
                    drawSegment(j, j + 1, matrixWorld, lineColor);
                }
            }
            
            edges.dispose();
        }
    });
    
    if (svgElements.length === 0) {
        alert("目前 3D 視角中無可匯出的光電結構線條！");
        return;
    }
    
    const svgString = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" style="background-color: rgba(255, 255, 255, 1);">
    <g>
        ${svgElements.join('\n        ')}
    </g>
</svg>`;
    
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    
    const siteName = (state && state.siteName) ? state.siteName.trim() : '曜昇綠能 1號場';
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const hhmmss = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const fileName = `${siteName}_${yyyymmdd}_${hhmmss}.svg`;
    
    await saveFileWithPicker(blob, fileName, 'image/svg+xml');
}

function showMapContextMenu(x, y) {
    let menu = document.getElementById('map-context-menu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'map-context-menu';
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-item" id="menu-map-capture">
                <span class="menu-icon">📷</span>
                <span class="menu-text">截取地圖 (PNG)</span>
            </div>
        `;
        document.body.appendChild(menu);
        
        menu.querySelector('#menu-map-capture').addEventListener('click', () => {
            captureMapImage();
            menu.style.display = 'none';
        });
        
        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }
    
    // Position menu and show it
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.style.display = 'block';
}

async function captureMapImage() {
    const mapElement = document.getElementById('leaflet-map');
    if (!mapElement) return;
    
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'wait';
    
    try {
        const mapCanvas = await html2canvas(mapElement, {
            useCORS: true,
            logging: false,
            allowTaint: false,
            scale: 2
        });
        
        const dataUrl = mapCanvas.toDataURL('image/png');
        
        const siteName = (state && state.siteName) ? state.siteName.trim() : '曜昇綠能 1號場';
        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hhmmss = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const fileName = `${siteName}_地圖_${yyyymmdd}_${hhmmss}.png`;
        
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await saveFileWithPicker(blob, fileName, 'image/png');
    } catch (err) {
        alert("\u622a\u53d6\u5730\u5716\u5f71\u50cf\u5931\u6557\uff0c\u53ef\u80fd\u662f\u885b\u661f\u5716\u5716\u7816\u53d7\u5230\u8de8\u7db2\u57df (CORS) \u5b89\u5168\u6027\u9650\u5236\u3002");
        console.error(err);
    } finally {
        document.body.style.cursor = originalCursor;
    }
}
function updateSunPosition(lat, lng, month, hour) {
    if (!sunLight || !ambientLight) return;
    
    sunLight.castShadow = (state.showShadows !== undefined) ? state.showShadows : true;
    
    // Simplified solar path calculation
    // month: 1 ~ 12, hour: 0 ~ 24
    const latRad = (lat * Math.PI) / 180;
    
    // N is day of year (approximate from month)
    const monthDays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    const N = monthDays[month - 1] + 21; // 21st of the month
    
    // Declination angle delta (韏斤楝)
    const declination = 23.45 * Math.sin((360 / 365) * (284 + N) * Math.PI / 180);
    const decRad = (declination * Math.PI) / 180;
    
    // Hour angle H (時角)
    const hourAngle = (hour - 12) * 15;
    const hourAngleRad = (hourAngle * Math.PI) / 180;
    
    // Solar Altitude alpha (高度角)
    const sinAltitude = Math.sin(latRad) * Math.sin(decRad) + Math.cos(latRad) * Math.cos(decRad) * Math.cos(hourAngleRad);
    const altitudeRad = Math.asin(Math.max(-1.0, Math.min(1.0, sinAltitude)));
    
    // Solar Azimuth (太陽方位角)
    let cosAzimuth = (Math.sin(decRad) - Math.sin(latRad) * Math.sin(altitudeRad)) / (Math.cos(latRad) * Math.cos(altitudeRad));
    cosAzimuth = Math.max(-1.0, Math.min(1.0, cosAzimuth));
    let azimuthRad = Math.acos(cosAzimuth);
    
    if (hour > 12) {
        azimuthRad = 2 * Math.PI - azimuthRad;
    }
    
    const altitude = (altitudeRad * 180) / Math.PI;
    
    // Calculate center and size of the entire PV array structure + obstacles
    let cx = 0, cy = 0, cz = 0;
    let maxDim = 60;
    const box = new THREE.Box3();
    if (pvGroup) box.expandByObject(pvGroup);
    if (obstacleGroup) box.expandByObject(obstacleGroup);
    
    if (box.min.x !== Infinity && !isNaN(box.min.x)) {
        const center = new THREE.Vector3();
        box.getCenter(center);
        cx = center.x;
        cy = center.y;
        cz = center.z;
        
        const size = new THREE.Vector3();
        box.getSize(size);
        maxDim = Math.max(Math.hypot(size.x, size.z), size.y, 40);
    }
    
    // Make the directional light target follow the center of the array to center shadows
    sunLight.target.position.set(cx, cy, cz);
    sunLight.target.updateMatrixWorld();
    
    // Calculate shadow extension factor based on sun altitude (low angle = longer shadows)
    const shadowStretch = (altitude > 2 && altitude < 80) ? Math.min(3.0, 1.0 / Math.tan(altitudeRad)) : 1.2;
    // Generously expand shadow frustum so huge arrays + ground shadows are never clipped
    const d = Math.max(120, (maxDim * (1.2 + shadowStretch * 0.4)) + 50);
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    
    // Adjust ambient intensity based on sun presence
    ambientLight.intensity = altitude > 0 ? 0.70 : 0.20;
    
    if (altitude > 0) {
        // Sun is above horizon
        // Position light on a dome radius proportional to frustum size d
        const r = Math.max(250, d * 1.8);
        const y = cy + r * Math.sin(altitudeRad);
        
        // standard coordinate mapping:
        const x = cx + r * Math.cos(altitudeRad) * Math.sin(azimuthRad);
        const z = cz - r * Math.cos(altitudeRad) * Math.cos(azimuthRad);
        
        sunLight.position.set(x, y, z);
        sunLight.shadow.camera.near = 1;
        sunLight.shadow.camera.far = r * 2.5 + d * 2.0;
        sunLight.shadow.bias = -0.0002;
        sunLight.shadow.normalBias = 0.03;
        sunLight.shadow.camera.updateProjectionMatrix();
        sunLight.intensity = 0.85;
        sunLight.visible = true;
    } else {
        // Night time: hide sunLight
        sunLight.visible = false;
        sunLight.shadow.camera.updateProjectionMatrix();
    }
}

// ==========================================
// MEASUREMENT TAPE & SNAPPING SYSTEM
// ==========================================
function toScreenPosition(objVector, camera) {
    if (!renderer) return { x: 0, y: 0, z: 0 };
    const vector = objVector.clone();
    vector.project(camera);
    
    const canvas = renderer.domElement;
    const x = (vector.x * 0.5 + 0.5) * canvas.clientWidth;
    const y = (-(vector.y * 0.5) + 0.5) * canvas.clientHeight;
    
    return { x, y, z: vector.z };
}

function updateMeasureLabels() {
    if (measureLines.length === 0 && !activeMeasureLabel) return;
    
    measureLines.forEach(item => {
        const midPoint = new THREE.Vector3().addVectors(item.start, item.end).multiplyScalar(0.5);
        const pos = toScreenPosition(midPoint, camera);
        
        if (pos.z > 1) {
            item.labelDom.style.display = 'none';
        } else {
            item.labelDom.style.display = 'block';
            item.labelDom.style.left = `${pos.x}px`;
            item.labelDom.style.top = `${pos.y}px`;
        }
    });
    
    if (activeMeasureLabel && measurePoints.length === 1 && snappedPoint) {
        const midPoint = new THREE.Vector3().addVectors(measurePoints[0], snappedPoint).multiplyScalar(0.5);
        const pos = toScreenPosition(midPoint, camera);
        
        if (pos.z > 1) {
            activeMeasureLabel.style.display = 'none';
        } else {
            activeMeasureLabel.style.display = 'block';
            activeMeasureLabel.style.left = `${pos.x}px`;
            activeMeasureLabel.style.top = `${pos.y}px`;
        }
    }
}

function findSnapPoint(mouse) {
    try {
        if (!scene || !camera) return null;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        // We only snap to structural PV/racking/building meshes, excluding ground, guides, compass, indicator
        const targets = [];
        scene.traverse(node => {
            if (node.isMesh && node !== ground && node !== snapIndicator && (!node.name || !node.name.startsWith('measure')) && node.geometry) {
                targets.push(node);
            }
        });
        
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length === 0) return null;
        
        const intersect = intersects[0];
        const mesh = intersect.object;
        const geom = mesh.geometry;
        if (!geom) return { point: intersect.point, type: 'surface' };
        
        const isCylinder = geom.type === 'CylinderGeometry' || (geom.parameters && geom.parameters.radiusTop !== undefined);
        const isRing = geom.type === 'RingGeometry' || (geom.parameters && geom.parameters.innerRadius !== undefined);
        
        let bestPoint = null;
        let minDistance = Infinity;
        let snapType = 'surface';
        
        if (isCylinder && geom.parameters) {
            const height = geom.parameters.height || 1.0;
            const centers = [
                new THREE.Vector3(0, -height/2, 0),
                new THREE.Vector3(0, height/2, 0)
            ];
            
            centers.forEach(c => {
                const worldC = c.clone().applyMatrix4(mesh.matrixWorld);
                const d = intersect.point.distanceTo(worldC);
                if (d < minDistance) {
                    minDistance = d;
                    bestPoint = worldC;
                    snapType = 'center';
                }
            });
        } else if (isRing) {
            const worldC = new THREE.Vector3(0, 0, 0).applyMatrix4(mesh.matrixWorld);
            const d = intersect.point.distanceTo(worldC);
            if (d < minDistance) {
                minDistance = d;
                bestPoint = worldC;
                snapType = 'center';
            }
        }
        
        const posAttr = geom.attributes ? geom.attributes.position : null;
        if (posAttr) {
            const face = intersect.face;
            if (face) {
                const indices = [face.a, face.b, face.c];
                const faceVertices = [];
                
                indices.forEach(idx => {
                    if (idx < posAttr.count) {
                        const v = new THREE.Vector3(
                            posAttr.getX(idx),
                            posAttr.getY(idx),
                            posAttr.getZ(idx)
                        );
                        const worldV = v.clone().applyMatrix4(mesh.matrixWorld);
                        faceVertices.push(worldV);
                        
                        const d = intersect.point.distanceTo(worldV);
                        if (d < minDistance) {
                            minDistance = d;
                            bestPoint = worldV;
                            snapType = 'endpoint';
                        }
                    }
                });
                
                if (faceVertices.length === 3) {
                    const edges = [
                        [faceVertices[0], faceVertices[1]],
                        [faceVertices[1], faceVertices[2]],
                        [faceVertices[2], faceVertices[0]]
                    ];
                    
                    edges.forEach(edge => {
                        if (edge[0] && edge[1]) {
                            const mid = new THREE.Vector3().addVectors(edge[0], edge[1]).multiplyScalar(0.5);
                            const d = intersect.point.distanceTo(mid);
                            if (d < minDistance) {
                                minDistance = d;
                                bestPoint = mid;
                                snapType = 'midpoint';
                            }
                        }
                    });
                }
            }
        }
        
        // Snapping radius threshold (0.35m in 3D world space)
        const snapThreshold = 0.35;
        if (minDistance < snapThreshold && bestPoint) {
            return { point: bestPoint, type: snapType };
        }
        
        return { point: intersect.point, type: 'surface' };
    } catch (err) {
        console.error("Error in findSnapPoint:", err);
        return null;
    }
}

function getLockedEndPoint(start, current) {
    const chkX = document.getElementById('chk-lock-x');
    const chkY = document.getElementById('chk-lock-y');
    const chkZ = document.getElementById('chk-lock-z');
    
    let endPoint = current.clone();
    let distance = start.distanceTo(current);
    let labelText = `${distance.toFixed(2)} m`;
    
    if (chkX && chkX.checked) {
        endPoint.set(current.x, start.y, start.z);
        distance = Math.abs(current.x - start.x);
        labelText = `X: ${distance.toFixed(2)} m`;
    } else if (chkY && chkY.checked) {
        // Y-axis lock is mapped to 3D Z-coordinate (depth / longitudinal direction)
        endPoint.set(start.x, start.y, current.z);
        distance = Math.abs(current.z - start.z);
        labelText = `Y: ${distance.toFixed(2)} m`;
    } else if (chkZ && chkZ.checked) {
        // Z-axis lock is mapped to 3D Y-coordinate (height / vertical direction)
        endPoint.set(start.x, current.y, start.z);
        distance = Math.abs(current.y - start.y);
        labelText = `Z: ${distance.toFixed(2)} m`;
    }
    
    return { endPoint, distance, labelText };
}

function handleMeasureClick(point) {
    try {
        if (measurePoints.length === 0) {
            // Step 1: Set Start Point
            measurePoints.push(point.clone());
            
            // Create start point marker (red sphere + white wireframe border)
            const markerGeo = new THREE.SphereGeometry(0.18, 16, 16);
            const markerMat = new THREE.MeshBasicMaterial({
                color: 0xef4444, // Red
                transparent: true,
                opacity: 0.9,
                depthTest: false
            });
            measureStartMarker = new THREE.Mesh(markerGeo, markerMat);
            measureStartMarker.position.copy(point);
            measureStartMarker.renderOrder = 1001;
            scene.add(measureStartMarker);
            
            const outerGeo = new THREE.SphereGeometry(0.22, 12, 12);
            const outerMat = new THREE.MeshBasicMaterial({
                color: 0xffffff, // White border
                wireframe: true,
                transparent: true,
                opacity: 0.7,
                depthTest: false
            });
            measureStartOuter = new THREE.Mesh(outerGeo, outerMat);
            measureStartOuter.position.copy(point);
            measureStartOuter.renderOrder = 1001;
            scene.add(measureStartOuter);
            
            // Decide initial rubberband color based on locked axis
            let colorHex = 0xef4444; // Default red
            const chkX = document.getElementById('chk-lock-x');
            const chkY = document.getElementById('chk-lock-y');
            const chkZ = document.getElementById('chk-lock-z');
            if (chkX && chkX.checked) colorHex = 0xef4444; // Red
            else if (chkY && chkY.checked) colorHex = 0x22c55e; // Green
            else if (chkZ && chkZ.checked) colorHex = 0x3b82f6; // Blue

            // Create rubberband line & label
            const lineMat = new THREE.LineDashedMaterial({
                color: colorHex,
                dashSize: 0.3,
                gapSize: 0.15,
                depthTest: false
            });
            const lineGeo = new THREE.BufferGeometry();
            const positions = new Float32Array([
                point.x, point.y, point.z,
                point.x, point.y, point.z
            ]);
            lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            activeMeasureLine = new THREE.Line(lineGeo, lineMat);
            activeMeasureLine.computeLineDistances();
            activeMeasureLine.name = 'measure-rubberband';
            activeMeasureLine.renderOrder = 1000;
            scene.add(activeMeasureLine);
            
            // Create label DOM element
            activeMeasureLabel = document.createElement('div');
            activeMeasureLabel.className = 'measure-label';
            
            // Apply axis lock formatting to initial label
            const { labelText } = getLockedEndPoint(point, point);
            activeMeasureLabel.innerText = labelText;
            document.getElementById('measure-labels-overlay').appendChild(activeMeasureLabel);
        } else {
            // Step 2: Set End Point and save measurement
            const startPoint = measurePoints[0];
            
            // Compute projected endpoint and distance under axial constraints
            const { endPoint, distance, labelText } = getLockedEndPoint(startPoint, point);
            
            // Remove temporary rubberband line and temporary start markers
            if (activeMeasureLine) {
                scene.remove(activeMeasureLine);
                activeMeasureLine = null;
            }
            if (measureStartMarker) {
                scene.remove(measureStartMarker);
                measureStartMarker = null;
            }
            if (measureStartOuter) {
                scene.remove(measureStartOuter);
                measureStartOuter = null;
            }
            
            // Decide permanent line color based on locked axis
            let colorHex = 0xeab308; // Default yellow
            const chkX = document.getElementById('chk-lock-x');
            const chkY = document.getElementById('chk-lock-y');
            const chkZ = document.getElementById('chk-lock-z');
            if (chkX && chkX.checked) colorHex = 0xef4444; // Red
            else if (chkY && chkY.checked) colorHex = 0x22c55e; // Green
            else if (chkZ && chkZ.checked) colorHex = 0x3b82f6; // Blue
            
            // Create permanent dashed dimension line in 3D
            const lineMat = new THREE.LineDashedMaterial({
                color: colorHex,
                dashSize: 0.2,
                gapSize: 0.1,
                depthTest: false
            });
            const lineGeo = new THREE.BufferGeometry();
            const positions = new Float32Array([
                startPoint.x, startPoint.y, startPoint.z,
                endPoint.x, endPoint.y, endPoint.z
            ]);
            lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const permanentLine = new THREE.Line(lineGeo, lineMat);
            permanentLine.computeLineDistances();
            permanentLine.name = `measure-line-${measureLines.length}`;
            permanentLine.renderOrder = 1000;
            scene.add(permanentLine);
            
            // Create permanent label DOM element
            const labelDom = activeMeasureLabel || document.createElement('div');
            labelDom.className = 'measure-label';
            labelDom.innerText = labelText;
            if (!activeMeasureLabel) {
                document.getElementById('measure-labels-overlay').appendChild(labelDom);
            }
            activeMeasureLabel = null;
            
            // Store
            measureLines.push({
                lineMesh: permanentLine,
                start: startPoint,
                end: endPoint,
                labelDom: labelDom
            });
            
            // Clear points for next measurement
            measurePoints = [];
        }
    } catch (err) {
        console.error("Error in handleMeasureClick:", err);
    }
}

function updateRubberband(start, current) {
    try {
        if (!activeMeasureLine || !activeMeasureLabel) return;
        
        // Get locked endpoint, distance, and label text under axial constraints
        const { endPoint, labelText } = getLockedEndPoint(start, current);
        
        // Update line geometry points using buffer attributes directly (100% compatible & efficient)
        const posAttr = activeMeasureLine.geometry.attributes.position;
        if (posAttr) {
            posAttr.setXYZ(0, start.x, start.y, start.z);
            posAttr.setXYZ(1, endPoint.x, endPoint.y, endPoint.z);
            posAttr.needsUpdate = true;
        }
        
        // Update line material color dynamically based on active lock
        let colorHex = 0xef4444; // Default red
        const chkX = document.getElementById('chk-lock-x');
        const chkY = document.getElementById('chk-lock-y');
        const chkZ = document.getElementById('chk-lock-z');
        if (chkX && chkX.checked) colorHex = 0xef4444; // Red
        else if (chkY && chkY.checked) colorHex = 0x22c55e; // Green
        else if (chkZ && chkZ.checked) colorHex = 0x3b82f6; // Blue
        
        if (activeMeasureLine.material) {
            activeMeasureLine.material.color.setHex(colorHex);
        }
        
        activeMeasureLine.computeLineDistances();
        
        // Update label text
        activeMeasureLabel.innerText = labelText;
    } catch (err) {
        console.error("Error in updateRubberband:", err);
    }
}

function exitMeasureMode() {
    isMeasureMode = false;
    
    // De-activate UI Button
    const btn = document.getElementById('btn-measure');
    if (btn) btn.classList.remove('active');
    
    // Hide and reset axis lock panel
    const axisPanel = document.getElementById('measure-axis-panel');
    if (axisPanel) axisPanel.style.display = 'none';
    
    const chkX = document.getElementById('chk-lock-x');
    const chkY = document.getElementById('chk-lock-y');
    const chkZ = document.getElementById('chk-lock-z');
    if (chkX) chkX.checked = false;
    if (chkY) chkY.checked = false;
    if (chkZ) chkZ.checked = false;
    
    // Hide snapping indicator
    if (snapIndicator) snapIndicator.visible = false;
    snappedPoint = null;
    
    // Clean all points, rubberband, and permanent lines
    measurePoints = [];
    if (activeMeasureLine) {
        scene.remove(activeMeasureLine);
        activeMeasureLine = null;
    }
    
    // Clean temporary start markers
    if (measureStartMarker) {
        scene.remove(measureStartMarker);
        measureStartMarker = null;
    }
    if (measureStartOuter) {
        scene.remove(measureStartOuter);
        measureStartOuter = null;
    }
    
    measureLines.forEach(item => {
        scene.remove(item.lineMesh);
    });
    measureLines = [];
    
    // Clean all label DOMs
    const overlay = document.getElementById('measure-labels-overlay');
    if (overlay) overlay.innerHTML = '';
    activeMeasureLabel = null;
}

/* ==========================================================================
   8. 3D ??拆秘?謘??嚚???璆??(Measuring Tape Tool)
   ========================================================================== */
/**
 * ??? 3D ?秋□???謆??脰??
 */
function toggleMeasureMode() {
    const btn = document.getElementById('btn-measure');
    if (isMeasureMode) {
        exitMeasureMode();
    } else {
        exitNormalMode(); // Disable normal mode
        exitMapMeasureMode(); // Disable map measure mode
        clearExclusionDrawingState();
        exitExclusionDrawMode();
        isMeasureMode = true;
        if (btn) btn.classList.add('active');
        
        // Show axis lock panel
        const axisPanel = document.getElementById('measure-axis-panel');
        if (axisPanel) axisPanel.style.display = 'flex';
    }
}

function exitMapMeasureMode() {
    isMapMeasureMode = false;
    setPolygonsInteractivity(true);
    const btn = document.getElementById('btn-map-measure');
    if (btn) btn.classList.remove('active');
    if (map) {
        map.getContainer().style.cursor = '';
        map.off('mousemove', handleMapMeasureMouseMove);
    }
    
    if (mapMeasureTempLine && map) { map.removeLayer(mapMeasureTempLine); }
    mapMeasureTempLine = null;
    
    if (mapMeasureTempMarker && map) { map.removeLayer(mapMeasureTempMarker); }
    mapMeasureTempMarker = null;
    
    mapMeasureStartLatLng = null;
    
    if (map) {
        mapMeasureLines.forEach(item => {
            map.removeLayer(item.line);
            map.removeLayer(item.label);
        });
    }
    mapMeasureLines = [];
}

function toggleMapMeasureMode() {
    if (isMapMeasureMode) {
        exitMapMeasureMode();
    } else {
        exitNormalMode();
        exitMeasureMode();
        clearExclusionDrawingState();
        exitExclusionDrawMode();
        isMapMeasureMode = true;
        setPolygonsInteractivity(false);
        const btn = document.getElementById('btn-map-measure');
        if (btn) btn.classList.add('active');
        if (map) {
            map.getContainer().style.cursor = 'crosshair';
        }
    }
}

function handleMapMeasureClick(latlng) {
    if (!map) return;
    if (mapMeasureStartLatLng === null) {
        mapMeasureStartLatLng = latlng;
        mapMeasureTempMarker = L.circleMarker(latlng, {
            radius: 7, // Larger size
            color: 'rgba(255, 255, 255, 1)', // White border
            weight: 2,
            fillColor: 'rgba(239, 68, 68, 1)', // Red center
            fillOpacity: 1.0,
            interactive: false
        }).addTo(map);
        map.on('mousemove', handleMapMeasureMouseMove);
    } else {
        map.off('mousemove', handleMapMeasureMouseMove);
        if (mapMeasureTempLine) { map.removeLayer(mapMeasureTempLine); mapMeasureTempLine = null; }
        if (mapMeasureTempMarker) { map.removeLayer(mapMeasureTempMarker); mapMeasureTempMarker = null; }
        
        const endLatLng = latlng;
        const line = L.polyline([mapMeasureStartLatLng, endLatLng], {
            color: 'rgba(234, 179, 8, 1)',
            weight: 3.5, // Unified thicker weight
            dashArray: '6, 8', // Unified dash pattern
            interactive: false
        }).addTo(map);
        
        const dist = mapMeasureStartLatLng.distanceTo(endLatLng);
        const midpoint = L.latLng((mapMeasureStartLatLng.lat + endLatLng.lat) / 2, (mapMeasureStartLatLng.lng + endLatLng.lng) / 2);
        
        const labelIcon = L.divIcon({
            className: 'map-measure-label',
            html: `<div style="background-color: rgba(30, 41, 59, 1); color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold; border: 1.5px solid rgba(234, 179, 8, 1); white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3); transform: translate(-50%, -50%);">${dist.toFixed(2)} m</div>`,
            iconSize: [60, 20],
            iconAnchor: [30, 10]
        });
        const label = L.marker(midpoint, { icon: labelIcon, interactive: false }).addTo(map);
        
        mapMeasureLines.push({ line, label });
        mapMeasureStartLatLng = null;
    }
}

function handleMapMeasureMouseMove(event) {
    if (!map || !mapMeasureStartLatLng) return;
    const currentLatLng = event.latlng;
    const shaftCoords = [mapMeasureStartLatLng, currentLatLng];
    if (mapMeasureTempLine) {
        mapMeasureTempLine.setLatLngs(shaftCoords);
    } else {
        mapMeasureTempLine = L.polyline(shaftCoords, {
            color: 'rgba(239, 68, 68, 1)',
            weight: 3.5, // Unified thicker weight
            dashArray: '6, 8', // Unified dash pattern
            interactive: false
        }).addTo(map);
    }
}

let activePolygonVertexMarkers = [];
let activePolygonCenterMarker = null;

function clearPolygonVertexHandles() {
    if (activePolygonVertexMarkers && activePolygonVertexMarkers.length > 0) {
        activePolygonVertexMarkers.forEach(m => {
            if (map) map.removeLayer(m);
        });
        activePolygonVertexMarkers = [];
    }
    if (activePolygonCenterMarker) {
        if (map) map.removeLayer(activePolygonCenterMarker);
        activePolygonCenterMarker = null;
    }
}
let lastMoveBadgeTapTime = 0;
let isMoveBadgeDoubleTap = false;

window.addEventListener('keydown', (e) => {
    if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') {
        window.__isCtrlOrCmdPressed = true;
        const badge = document.querySelector('.poly-move-badge.dragging');
        if (badge) badge.classList.add('copy-mode');
    }
});
window.addEventListener('keyup', (e) => {
    if (e.key === 'Control' || e.key === 'Meta' || e.key === 'Alt') {
        window.__isCtrlOrCmdPressed = false;
    }
});

function clonePolygon(poly, latlngs) {
    if (!poly || !map) return null;
    const ring = (latlngs || getOuterRingLatLngs(poly)).map(pt => L.latLng(pt.lat, pt.lng));
    if (!ring || ring.length < 3) return null;

    let cloned = null;
    if (poly.isObstacle) {
        cloned = L.polygon(ring, {
            color: 'rgba(239, 68, 68, 1)',
            weight: 2.5,
            fillColor: 'rgba(239, 68, 68, 1)',
            fillOpacity: 0.35
        }).addTo(map);
        cloned.isObstacle = true;
        cloned.obstacleHeight = poly.obstacleHeight || 5.0;
        cloned.isOnRoof = poly.isOnRoof !== false;
        obstaclePolygons.push(cloned);
    } else {
        const isWalk = !!poly.isWalkway;
        const color = isWalk ? 'rgba(16, 185, 129, 1)' : 'rgba(234, 88, 12, 1)';
        cloned = L.polygon(ring, {
            color: color,
            weight: 2.5,
            fillColor: color,
            fillOpacity: isWalk ? 0.35 : 0.25
        }).addTo(map);
        cloned.isWalkway = isWalk;
        cloned.isPathway = !!poly.isPathway;
        cloned.pathwayWidth = poly.pathwayWidth;
        cloned.isSubstation = !!poly.isSubstation;
        cloned.substationWidth = poly.substationWidth;
        cloned.substationLength = poly.substationLength;
        if (poly.isSubstation && poly.substationCenter) {
            cloned.substationCenter = L.latLng(poly.substationCenter.lat, poly.substationCenter.lng);
        }
        exclusionPolygons.push(cloned);
    }

    makePolygonSelectable(cloned);
    return cloned;
}

function snapPolygonMovement(poly, rawLatLngs, startCenterPos, curMouseLatLng) {
    if (!map || !rawLatLngs || rawLatLngs.length < 3) {
        return { latlngs: rawLatLngs, snapped: false };
    }

    // 1. Gather all potential snap target vertices & midpoints from scene (except poly itself)
    const snapTargets = [];
    const collectTargets = (targetPoly) => {
        if (!targetPoly || targetPoly === poly) return;
        const outer = getOuterRingLatLngs(targetPoly);
        if (!outer || outer.length < 2) return;
        for (let i = 0; i < outer.length; i++) {
            snapTargets.push({ latlng: outer[i], type: 'endpoint' });
            const next = outer[(i + 1) % outer.length];
            snapTargets.push({
                latlng: L.latLng((outer[i].lat + next.lat) / 2, (outer[i].lng + next.lng) / 2),
                type: 'midpoint'
            });
        }
    };

    if (customSiteBoundary) collectTargets(customSiteBoundary);
    else if (coveragePolygon) collectTargets(coveragePolygon);
    exclusionPolygons.forEach(collectTargets);
    obstaclePolygons.forEach(collectTargets);

    // Check corner snapping (角點鎖點)
    let bestSnap = null;
    let minPix = 16;

    for (let i = 0; i < rawLatLngs.length; i++) {
        const v = rawLatLngs[i];
        const vPt = map.latLngToContainerPoint(v);
        for (const target of snapTargets) {
            const tPt = map.latLngToContainerPoint(target.latlng);
            const dist = vPt.distanceTo(tPt);
            if (dist < minPix) {
                minPix = dist;
                bestSnap = {
                    vertexIndex: i,
                    vertexLatLng: v,
                    targetLatLng: target.latlng,
                    type: target.type
                };
            }
        }
    }

    if (bestSnap) {
        const snapDLat = bestSnap.targetLatLng.lat - bestSnap.vertexLatLng.lat;
        const snapDLng = bestSnap.targetLatLng.lng - bestSnap.vertexLatLng.lng;
        const snappedLatLngs = rawLatLngs.map(pt => L.latLng(pt.lat + snapDLat, pt.lng + snapDLng));
        updateSnapMarkerVisual({ latlng: bestSnap.targetLatLng, type: bestSnap.type });
        clearRightAngleIndicator();
        return { latlngs: snappedLatLngs, snapped: true };
    }

    // 2. Check parallel line alignment / axial snapping (平行線吸附)
    const azimuthRad = ((state.azimuth || 180) * Math.PI) / 180;
    const dirX = Math.sin(azimuthRad);
    const dirY = Math.cos(azimuthRad);

    const metersPerLatDegree = 111320;
    const latRad = (startCenterPos.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);

    const dLatMeters = (curMouseLatLng.lat - startCenterPos.lat) * metersPerLatDegree;
    const dLngMeters = (curMouseLatLng.lng - startCenterPos.lng) * metersPerLngDegree;
    const totalDistMeters = Math.sqrt(dLatMeters * dLatMeters + dLngMeters * dLngMeters);

    if (totalDistMeters > 0.8) {
        const axes = [
            { ux: dirX, uy: dirY },
            { ux: dirY, uy: -dirX },
            { ux: -dirX, uy: -dirY },
            { ux: -dirY, uy: dirX }
        ];

        for (const axis of axes) {
            const dot = dLngMeters * axis.ux + dLatMeters * axis.uy;
            if (dot > 0.5) {
                const perpDist = Math.abs(dLngMeters * (-axis.uy) + dLatMeters * axis.ux);
                if (perpDist < 0.6 || (perpDist / dot) < 0.08) {
                    const snapLngM = dot * axis.ux;
                    const snapLatM = dot * axis.uy;
                    const snappedCenter = L.latLng(
                        startCenterPos.lat + snapLatM / metersPerLatDegree,
                        startCenterPos.lng + snapLngM / metersPerLngDegree
                    );
                    const snapDLat = snappedCenter.lat - curMouseLatLng.lat;
                    const snapDLng = snappedCenter.lng - curMouseLatLng.lng;
                    const snappedLatLngs = rawLatLngs.map(pt => L.latLng(pt.lat + snapDLat, pt.lng + snapDLng));

                    updateSnapMarkerVisual(null);
                    if (parallelGuidePolyline) {
                        parallelGuidePolyline.setLatLngs([startCenterPos, snappedCenter]);
                        parallelGuidePolyline.setStyle({ color: '#ec4899', weight: 2.5, dashArray: '5, 5', opacity: 0.95 });
                    } else {
                        parallelGuidePolyline = L.polyline([startCenterPos, snappedCenter], {
                            color: '#ec4899',
                            weight: 2.5,
                            dashArray: '5, 5',
                            opacity: 0.95,
                            interactive: false
                        }).addTo(map);
                    }
                    return { latlngs: snappedLatLngs, snapped: true };
                }
            }
        }
    }

    updateSnapMarkerVisual(null);
    clearRightAngleIndicator();
    return { latlngs: rawLatLngs, snapped: false };
}

function updatePolygonVertexHandles(poly) {
    clearPolygonVertexHandles();
    if (!poly || !map) return;
    
    const latlngs = getOuterRingLatLngs(poly);
    if (!latlngs || latlngs.length < 3) return;
    
    const isSite = (poly === customSiteBoundary);
    const handleColor = isSite ? 'rgba(56, 189, 248, 1)' : (poly.isObstacle ? 'rgba(239, 68, 68, 1)' : 'rgba(249, 115, 22, 1)');
    
    latlngs.forEach((ll, idx) => {
        const vIcon = L.divIcon({
            className: 'poly-vertex-handle-icon',
            html: `<div style="width: 14px; height: 14px; background: ${handleColor}; border: 2px solid rgba(255, 255, 255, 1); border-radius: 50%; box-shadow: 0 0 6px rgba(0,0,0,0.6); cursor: grab; transform: translate(-7px, -7px);"></div>`,
            iconSize: [14, 14],
            iconAnchor: [0, 0]
        });
        
        const vMarker = L.marker([ll.lat, ll.lng], {
            icon: vIcon,
            draggable: true,
            zIndexOffset: 3500
        }).addTo(map);
        
        vMarker.on('dragstart', (e) => {
            map.dragging.disable();
            if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
        });
        
        vMarker.on('drag', (e) => {
            const newPos = e.target.getLatLng();
            const currentRings = getOuterRingLatLngs(poly);
            currentRings[idx] = newPos;
            poly.setLatLngs(currentRings);
            
            if (activePolygonCenterMarker) {
                const newCenter = getPolygonCenter(poly);
                activePolygonCenterMarker.setLatLng(newCenter);
            }
            
            if (selectedEdgeHighlightLine && typeof activeSelectedEdgeIndex !== 'undefined' && activeSelectedEdgeIndex !== -1) {
                const p1 = currentRings[activeSelectedEdgeIndex];
                const p2 = currentRings[(activeSelectedEdgeIndex + 1) % currentRings.length];
                selectedEdgeHighlightLine.setLatLngs([p1, p2]);
            }
            
            if (isSite) {
                inferParametersFromSiteBoundary(poly, true);
            }
        });
        
        vMarker.on('dragend', () => {
            if (isSite) {
                inferParametersFromSiteBoundary(poly, true);
            } else {
                calculateOutputs();
                updateAllVisuals();
            }
        });
        
        activePolygonVertexMarkers.push(vMarker);
    });

    // Add central Move & Duplicate Icon Badge
    const center = getPolygonCenter(poly);
    const moveIcon = L.divIcon({
        className: 'poly-center-move-icon-container',
        html: `<div class="poly-move-badge" title="拖曳可移動多邊形；按住 Ctrl / Cmd 或連點兩下拖曳可直接複製另一份">
            <svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    
    activePolygonCenterMarker = L.marker([center.lat, center.lng], {
        icon: moveIcon,
        draggable: true,
        zIndexOffset: 3600
    }).addTo(map);

    let startCenterPos = null;
    let startCenterLatLngs = null;
    let startSubstationCenter = null;

    activePolygonCenterMarker.on('mousedown touchstart', () => {
        const now = Date.now();
        if (now - lastMoveBadgeTapTime < 450) {
            isMoveBadgeDoubleTap = true;
        } else {
            isMoveBadgeDoubleTap = false;
        }
        lastMoveBadgeTapTime = now;
    });

    activePolygonCenterMarker.on('dragstart', (e) => {
        map.dragging.disable();
        if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
        startCenterPos = activePolygonCenterMarker.getLatLng();
        if (poly.isWalkway) {
            startCenterLatLngs = poly.getLatLngs().map(pt => L.latLng(pt.lat, pt.lng));
        } else if (poly instanceof L.Polygon) {
            startCenterLatLngs = poly.getLatLngs()[0].map(pt => L.latLng(pt.lat, pt.lng));
        } else {
            startCenterLatLngs = poly.getLatLngs().map(pt => L.latLng(pt.lat, pt.lng));
        }
        if (poly.isSubstation) {
            startSubstationCenter = L.latLng(poly.substationCenter.lat, poly.substationCenter.lng);
        }

        const origEvt = e.originalEvent || {};
        const isModifier = !!(origEvt.ctrlKey || origEvt.metaKey || origEvt.altKey || window.__isCtrlOrCmdPressed);
        const isCloneMode = (poly !== customSiteBoundary) && (isModifier || isMoveBadgeDoubleTap);

        if (isCloneMode) {
            clonePolygon(poly, startCenterLatLngs);
        }

        const badge = activePolygonCenterMarker.getElement() ? activePolygonCenterMarker.getElement().querySelector('.poly-move-badge') : null;
        if (badge) {
            badge.classList.add('dragging');
            if (isCloneMode) badge.classList.add('copy-mode');
        }
    });

    activePolygonCenterMarker.on('drag', (e) => {
        const curPos = e.target.getLatLng();
        const dLat = curPos.lat - startCenterPos.lat;
        const dLng = curPos.lng - startCenterPos.lng;
        
        const rawLatLngs = startCenterLatLngs.map(pt => L.latLng(pt.lat + dLat, pt.lng + dLng));
        
        // 執行角點鎖點與平行線吸附
        const snapRes = snapPolygonMovement(poly, rawLatLngs, startCenterPos, curPos);
        const newLatLngs = snapRes.latlngs;
        
        if (poly instanceof L.Polygon) {
            poly.setLatLngs([newLatLngs]);
        } else {
            poly.setLatLngs(newLatLngs);
        }
        
        if (activePolygonVertexMarkers && activePolygonVertexMarkers.length === newLatLngs.length) {
            newLatLngs.forEach((pt, i) => {
                activePolygonVertexMarkers[i].setLatLng(pt);
            });
        }
        
        if (selectedEdgeHighlightLine && typeof activeSelectedEdgeIndex !== 'undefined' && activeSelectedEdgeIndex !== -1) {
            const p1 = newLatLngs[activeSelectedEdgeIndex];
            const p2 = newLatLngs[(activeSelectedEdgeIndex + 1) % newLatLngs.length];
            selectedEdgeHighlightLine.setLatLngs([p1, p2]);
        }
        
        if (poly.isSubstation) {
            const finalDLat = newLatLngs[0].lat - startCenterLatLngs[0].lat;
            const finalDLng = newLatLngs[0].lng - startCenterLatLngs[0].lng;
            poly.substationCenter = L.latLng(startSubstationCenter.lat + finalDLat, startSubstationCenter.lng + finalDLng);
        }
        
        if (isSite) {
            updateSiteCenterFromBoundary(poly);
        }
    });

    activePolygonCenterMarker.on('dragend', () => {
        map.dragging.enable();
        updateSnapMarkerVisual(null);
        clearRightAngleIndicator();
        const badge = activePolygonCenterMarker.getElement() ? activePolygonCenterMarker.getElement().querySelector('.poly-move-badge') : null;
        if (badge) {
            badge.classList.remove('dragging', 'copy-mode');
        }
        isMoveBadgeDoubleTap = false;
        if (isSite) {
            inferParametersFromSiteBoundary(poly, true);
        } else {
            calculateOutputs();
            updateAllVisuals(true);
        }
    });
}

function clearActivePolygonSelection() {
    try {
        const panel = document.getElementById('polygon-toolbox-panel');
        if (panel) {
            panel.style.display = 'none';
        }
        
        activeSelectedPolygonPopup = null;
        clearSubstationEditHandles();
        clearPolygonVertexHandles();
        
        const restorePolyStyle = (p) => {
            if (!p) return;
            let defaultColor = 'rgba(234, 88, 12, 1)';
            let defaultWeight = 2.5;
            let defaultOpacity = 0.25;
            
            if (p === customSiteBoundary) {
                defaultColor = 'rgba(56, 189, 248, 1)';
                defaultOpacity = 0;
            } else if (p.isObstacle) {
                defaultColor = 'rgba(239, 68, 68, 1)';
                defaultOpacity = 0.35;
            } else if (p.isWalkway) {
                defaultColor = p.walkwayWidth === 0.5 ? 'rgba(16, 185, 129, 1)' : 'rgba(251, 191, 36, 1)';
                defaultWeight = 4.0;
                defaultOpacity = 0.8;
            }
            
            p.setStyle({
                color: defaultColor,
                weight: defaultWeight,
                fillOpacity: defaultOpacity
            });
            if (p._path) {
                p._path.classList.remove('polygon-selected-flash');
            }
        };

        if (activeSelectedPolygon) {
            restorePolyStyle(activeSelectedPolygon);
            const polyToClear = activeSelectedPolygon;
            activeSelectedPolygon = null;
            
            if (polyToClear.closePopup) {
                polyToClear.closePopup();
            }
            map.closePopup();
        } else {
            if (customSiteBoundary) restorePolyStyle(customSiteBoundary);
            if (exclusionPolygons && exclusionPolygons.length > 0) exclusionPolygons.forEach(restorePolyStyle);
            if (obstaclePolygons && obstaclePolygons.length > 0) obstaclePolygons.forEach(restorePolyStyle);
        }
    } catch (err) {
        console.error("Error clearing polygon selection: ", err);
    }
    
    if (selectedEdgeHighlightLine) {
        try {
            map.removeLayer(selectedEdgeHighlightLine);
        } catch (err) {
            console.error("Error removing selectedEdgeHighlightLine: ", err);
        }
        selectedEdgeHighlightLine = null;
    }
    activeSelectedEdgeIndex = -1;
    clearRightAngleIndicator();
}

function switchPlanningMode(mode, targetState) {
    if (targetState === 'edit') {
        if (mode !== 'site' && siteBoundaryState === 'edit') setPlanningModeState('site', 'locked');
        if (mode !== 'exclusion' && exclusionState === 'edit') setPlanningModeState('exclusion', 'locked');
        if (mode !== 'obstacle' && obstacleState === 'edit') setPlanningModeState('obstacle', 'locked');
    }
    setPlanningModeState(mode, targetState);
}

function updateMarkerDragStates() {
    if (!marker) return;
    
    // Only allow center marker dragging in site boundary edit mode when no custom boundary exists!
    if (marker.dragging) {
        if (siteBoundaryState === 'edit' && !customSiteBoundary) {
            marker.dragging.enable();
        } else {
            marker.dragging.disable();
        }
    }
    
    // Only allow direction handle marker dragging in site boundary edit mode!
    if (arrowHandleMarker && arrowHandleMarker.dragging) {
        if (siteBoundaryState === 'edit') {
            arrowHandleMarker.dragging.enable();
        } else {
            arrowHandleMarker.dragging.disable();
        }
    }
}

function setPlanningModeState(mode, stateVal) {
    if (stateVal !== 'edit') {
        clearActivePolygonSelection();
        const pToolbox = document.getElementById('polygon-toolbox-panel');
        if (pToolbox) pToolbox.style.display = 'none';
    }
    if (mode === 'site') {
        siteBoundaryState = stateVal;
        const slider = document.getElementById('slider-site');
        const block = document.getElementById('planning-block-site');
        const lblEdit = document.getElementById('lbl-site-edit');
        const lblLock = document.getElementById('lbl-site-lock');
        const sitePanel = document.getElementById('site-tool-panel');
        const redrawBtn = document.getElementById('btn-redraw-site-trigger');
        
        if (slider) slider.value = stateVal === 'edit' ? 0 : 1;
        
        if (stateVal === 'edit') {
            if (block) block.classList.add('active-edit', 'edit-site');
            if (lblEdit) lblEdit.classList.add('active');
            if (lblLock) lblLock.classList.remove('active');
            enterSiteBoundaryDrawMode();
            if (customSiteBoundary) {
                try { customSiteBoundary.bringToFront(); } catch (e) {}
            }
        } else {
            if (block) block.classList.remove('active-edit', 'edit-site');
            if (lblEdit) lblEdit.classList.remove('active');
            if (lblLock) lblLock.classList.add('active');
            exitSiteBoundaryDrawMode();
            if (sitePanel) sitePanel.style.display = 'none';
            if (redrawBtn) redrawBtn.style.display = 'none';
            
            // Rebuild calculations when locked
            calculateOutputs();
            updateAllVisuals(true);
        }
    } else if (mode === 'exclusion') {
        exclusionState = stateVal;
        const slider = document.getElementById('slider-exclusion');
        const block = document.getElementById('planning-block-exclusion');
        const lblEdit = document.getElementById('lbl-ex-edit');
        const lblLock = document.getElementById('lbl-ex-lock');
        const exPanel = document.getElementById('exclusion-tool-panel');
        const exTrigger = document.getElementById('btn-add-exclusion-trigger');
        
        if (slider) slider.value = stateVal === 'edit' ? 0 : 1;
        
        if (stateVal === 'edit') {
            if (block) block.classList.add('active-edit', 'edit-exclusion');
            if (lblEdit) lblEdit.classList.add('active');
            if (lblLock) lblLock.classList.remove('active');
            exitExclusionDrawMode();
            exclusionPolygons.forEach(p => {
                try { p.bringToFront(); } catch (e) {}
            });
        } else {
            if (block) block.classList.remove('active-edit', 'edit-exclusion');
            if (lblEdit) lblEdit.classList.remove('active');
            if (lblLock) lblLock.classList.add('active');
            exitExclusionDrawMode();
            if (exPanel) exPanel.style.display = 'none';
            if (exTrigger) exTrigger.style.display = 'none';
            
            // Rebuild calculations when locked
            calculateOutputs();
            updateAllVisuals(true);
        }
    } else if (mode === 'obstacle') {
        obstacleState = stateVal;
        const slider = document.getElementById('slider-obstacle');
        const block = document.getElementById('planning-block-obstacle');
        const lblEdit = document.getElementById('lbl-obs-edit');
        const lblLock = document.getElementById('lbl-obs-lock');
        const obsPanel = document.getElementById('obstacle-tool-panel');
        const obsTrigger = document.getElementById('btn-add-obstacle-trigger');
        
        if (slider) slider.value = stateVal === 'edit' ? 0 : 1;
        
        if (stateVal === 'edit') {
            if (block) block.classList.add('active-edit', 'edit-obstacle');
            if (lblEdit) lblEdit.classList.add('active');
            if (lblLock) lblLock.classList.remove('active');
            exitObstacleDrawMode();
            obstaclePolygons.forEach(p => {
                try { p.bringToFront(); } catch (e) {}
            });
        } else {
            if (block) block.classList.remove('active-edit', 'edit-obstacle');
            if (lblEdit) lblEdit.classList.remove('active');
            if (lblLock) lblLock.classList.add('active');
            exitObstacleDrawMode();
            if (obsPanel) obsPanel.style.display = 'none';
            if (obsTrigger) obsTrigger.style.display = 'none';
            
            // Rebuild calculations when locked (Draws 3D obstacles!)
            calculateOutputs();
            updateAllVisuals(true);
        }
    }
    
    updateMarkerDragStates();
}

function updateSiteBoundaryDrawState() {
    const sitePanel = document.getElementById('site-tool-panel');
    const redrawBtn = document.getElementById('btn-redraw-site-trigger');
    
    if (siteBoundaryState !== 'edit') {
        if (isSiteBoundaryDrawMode) {
            isSiteBoundaryDrawMode = false;
            setPolygonsInteractivity(true);
            if (map) {
                map.getContainer().style.cursor = '';
                map.off('mousemove', handleSiteBoundaryMouseMove);
            }
        }
        if (sitePanel) sitePanel.style.display = 'none';
        if (redrawBtn) redrawBtn.style.display = 'none';
        return;
    }

    exitNormalMode();
    exitMeasureMode();
    exitMapMeasureMode();
    exitExclusionDrawMode();
    exitObstacleDrawMode();
    clearActivePolygonSelection();

    if (customSiteBoundary) {
        isSiteBoundaryDrawMode = false;
        setPolygonsInteractivity(true);
        if (map) {
            map.getContainer().style.cursor = '';
            map.off('mousemove', handleSiteBoundaryMouseMove);
        }
        if (sitePanel) sitePanel.style.display = 'none';
        if (redrawBtn) redrawBtn.style.display = 'block';
    } else {
        isSiteBoundaryDrawMode = true;
        setPolygonsInteractivity(false);
        if (sitePanel) sitePanel.style.display = 'block';
        if (redrawBtn) {
            redrawBtn.style.display = (siteBoundaryState === 'edit' && customSiteBoundary) ? 'block' : 'none';
        }
        if (map) {
            map.getContainer().style.cursor = 'url("images/draw_pencil.svg") 2 30, crosshair';
            map.on('mousemove', handleSiteBoundaryMouseMove);
        }
    }
}

let activeDrawingTouchMarker = null;
let activeDrawingTouchTimer = null;

function addDrawingVertexMarker(clickedLatLng, pointsArray, tempLine, color, snappersArray) {
    if (activeDrawingTouchMarker) {
        if (activeDrawingTouchTimer) clearTimeout(activeDrawingTouchTimer);
        lockActiveDrawingVertex(activeDrawingTouchMarker);
        activeDrawingTouchMarker = null;
    }

    const strokeColor = color || 'rgba(56, 189, 248, 1)';
    const pointIndex = pointsArray.length - 1;
    const marker = L.marker(clickedLatLng, {
        icon: L.divIcon({
            className: 'touch-vertex-marker-container',
            html: `<div class="touch-vertex-outer" style="border-color: ${strokeColor} !important; box-shadow: 0 0 14px ${strokeColor} !important;">
                <div class="touch-vertex-cross-h"></div>
                <div class="touch-vertex-cross-v"></div>
                <div class="touch-vertex-center-dot" style="border-color: ${strokeColor} !important;"></div>
            </div>`,
            iconSize: [0, 0]
        }),
        draggable: true,
        zIndexOffset: 1000
    }).addTo(map);

    marker._vertexColor = strokeColor;
    activeDrawingTouchMarker = marker;
    snappersArray.push(marker);

    const resetLockTimer = () => {
        if (activeDrawingTouchTimer) clearTimeout(activeDrawingTouchTimer);
        activeDrawingTouchTimer = setTimeout(() => {
            if (activeDrawingTouchMarker === marker) {
                lockActiveDrawingVertex(marker);
                activeDrawingTouchMarker = null;
            }
        }, 2000);
    };

    marker.on('dragstart', () => {
        if (activeDrawingTouchTimer) clearTimeout(activeDrawingTouchTimer);
        map.dragging.disable();
    });

    marker.on('drag', (e) => {
        let mouseLatLng = e.target.getLatLng();
        let targetLatLng = mouseLatLng;
        
        // 1. Check vertex snapping to other points/polygons
        const snapCheck = checkVertexSnapping(mouseLatLng);
        if (snapCheck) {
            isRightAngleSnapActive = false;
            isRectangleSnapActive = false;
            isParallelSnapActive = false;
            isPerpendicularSnapActive = false;
            clearRightAngleIndicator();
            updateSnapMarkerVisual(snapCheck);
            targetLatLng = snapCheck.latlng;
        } else {
            updateSnapMarkerVisual(null);
            // 2. Check right angle / parallel / perpendicular / rectangle snapping with previous vertices
            const priorPoints = pointsArray.slice(0, pointIndex);
            if (priorPoints.length > 0) {
                targetLatLng = snapToPreviousSegmentRightAngle(priorPoints, mouseLatLng);
            }
        }
        
        pointsArray[pointIndex] = targetLatLng;
        if (tempLine) {
            tempLine.setLatLngs(pointsArray);
        }
    });

    marker.on('dragend', () => {
        map.dragging.enable();
        if (pointsArray[pointIndex]) {
            marker.setLatLng(pointsArray[pointIndex]);
        }
        updateSnapMarkerVisual(null);
        clearRightAngleIndicator();
        resetLockTimer();
    });

    resetLockTimer();
}

function lockActiveDrawingVertex(marker) {
    if (!marker || !map || !map.hasLayer(marker)) return;
    const strokeColor = marker._vertexColor || 'rgba(56, 189, 248, 1)';
    const el = marker.getElement();
    if (el) {
        el.innerHTML = `<div class="touch-vertex-solid" style="border-color: ${strokeColor} !important; box-shadow: 0 0 8px rgba(0,0,0,0.7), 0 0 6px ${strokeColor} !important;"></div>`;
    }
    if (marker.dragging) marker.dragging.disable();
}

function clearActiveDrawingTouchState() {
    if (activeDrawingTouchTimer) {
        clearTimeout(activeDrawingTouchTimer);
        activeDrawingTouchTimer = null;
    }
    activeDrawingTouchMarker = null;
}

/* ==========================================================================
   6. ?ｇ?赯????/?謚????賹??釭??????湔 (Drawing Tools: Site, Exclusion & Obstacle)
   ========================================================================== */
/**
 * ????ｇ?赯剛??????叟契??塚撕曌?鞈????n */
function enterSiteBoundaryDrawMode() {
    updateSiteBoundaryDrawState();
}

function exitSiteBoundaryDrawMode() {
    isSiteBoundaryDrawMode = false;
    setPolygonsInteractivity(true);
    if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        map.off('mousemove', handleSiteBoundaryMouseMove);
    }
    clearSiteBoundaryDrawingState();
    
    
    const sitePanel = document.getElementById('site-tool-panel');
    const redrawBtn = document.getElementById('btn-redraw-site-trigger');
    if (sitePanel) sitePanel.style.display = 'none';
    if (redrawBtn) {
        redrawBtn.style.display = (siteBoundaryState === 'edit' && customSiteBoundary) ? 'block' : 'none';
    }
}

function clearSiteBoundaryDrawingState() {
    clearActiveDrawingTouchState();
    siteBoundaryPoints = [];
    if (siteBoundaryTempLine) {
        map.removeLayer(siteBoundaryTempLine);
        siteBoundaryTempLine = null;
    }
    siteBoundarySnappers.forEach(s => map.removeLayer(s));
    siteBoundarySnappers = [];
    if (mapSnapMarker) {
        map.removeLayer(mapSnapMarker);
        mapSnapMarker = null;
    }
    if (exclusionRubberband) {
        map.removeLayer(exclusionRubberband);
        exclusionRubberband = null;
    }
    clearRightAngleIndicator();
}

function handleSiteBoundaryMapClick(latlng) {
    let clickedLatLng = latlng;
    const snapCheck = checkVertexSnapping(clickedLatLng);
    if (snapCheck) {
        clickedLatLng = snapCheck.latlng;
    } else {
        clickedLatLng = snapToPreviousSegmentRightAngle(siteBoundaryPoints, clickedLatLng);
    }
    
    const isClosing = siteBoundaryPoints.length > 0 && 
        (clickedLatLng.equals(siteBoundaryPoints[0]) || clickedLatLng.distanceTo(siteBoundaryPoints[0]) < 1.5);
        
    if (isClosing) {
        if (siteBoundaryPoints.length >= 3) {
            const tempPoly = L.polygon(siteBoundaryPoints, {
                color: 'rgba(56, 189, 248, 1)',
                fill: false,
                fillOpacity: 0,
                weight: 2.5,
                interactive: true
            }).addTo(map);
            
            clearSiteBoundaryDrawingState();
            promptPolygonKeepOrDiscard("案場範圍", () => {
                customSiteBoundary = tempPoly;
                makePolygonDraggable(customSiteBoundary);
                makePolygonSelectable(customSiteBoundary);
                inferParametersFromSiteBoundary(customSiteBoundary);
                updateSiteBoundaryDrawState();
            }, () => {
                map.removeLayer(tempPoly);
                updateSiteBoundaryDrawState();
            }, tempPoly);
        } else {
            clearSiteBoundaryDrawingState();
            updateSiteBoundaryDrawState();
        }
        
        isRightAngleSnapBypassed = false;
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        return;
    }
    
    siteBoundaryPoints.push(clickedLatLng);
    isRightAngleSnapBypassed = false;
    isRightAngleSnapActive = false;
    isRectangleSnapActive = false;
    isParallelSnapActive = false;
    isPerpendicularSnapActive = false;
    
    if (siteBoundaryTempLine) {
        siteBoundaryTempLine.setLatLngs(siteBoundaryPoints);
    } else {
        siteBoundaryTempLine = L.polyline(siteBoundaryPoints, {
            color: 'rgba(56, 189, 248, 1)',
            weight: 2.5,
            interactive: false
        }).addTo(map);
    }
    
    addDrawingVertexMarker(clickedLatLng, siteBoundaryPoints, siteBoundaryTempLine, 'rgba(56, 189, 248, 1)', siteBoundarySnappers);
}

function handleSiteBoundaryMouseMove(e) {
    if (document.getElementById('polygon-confirm-modal')) {
        updateSnapMarkerVisual(null);
        if (exclusionRubberband) { map.removeLayer(exclusionRubberband); exclusionRubberband = null; }
        return;
    }
    if (!isSiteBoundaryDrawMode) return;
    
    lastMouseMoveEvent = e;
    
    let mouseLatLng = e.latlng;
    const snapCheck = checkVertexSnapping(mouseLatLng);
    let targetLatLng = snapCheck ? snapCheck.latlng : mouseLatLng;
    
    if (snapCheck) {
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        clearRightAngleIndicator();
        updateSnapMarkerVisual(snapCheck);
    } else {
        updateSnapMarkerVisual(null);
        targetLatLng = snapToPreviousSegmentRightAngle(siteBoundaryPoints, mouseLatLng);
    }
    
    if (siteBoundaryPoints.length === 0) return;
    
    let finalLatLng = targetLatLng;
    const isAnySnapActive = isRectangleSnapActive || isParallelSnapActive || isPerpendicularSnapActive || isRightAngleSnapActive || (snapCheck !== null);
    
    const rubberbandCoords = [siteBoundaryPoints[siteBoundaryPoints.length - 1], finalLatLng];
    if (exclusionRubberband) {
        exclusionRubberband.setLatLngs(rubberbandCoords);
        exclusionRubberband.setStyle({
            color: isAnySnapActive ? 'rgba(255, 0, 128, 1)' : 'rgba(56, 189, 248, 1)',
            weight: isRectangleSnapActive ? 3.5 : (isAnySnapActive ? 2.8 : 2),
            dashArray: isRectangleSnapActive ? null : '4, 4'
        });
        if (exclusionRubberband._path) {
            if (isRectangleSnapActive) {
                exclusionRubberband._path.classList.add('rubberband-rect-locked');
            } else {
                exclusionRubberband._path.classList.remove('rubberband-rect-locked');
            }
        }
    } else {
        exclusionRubberband = L.polyline(rubberbandCoords, {
            color: isAnySnapActive ? 'rgba(255, 0, 128, 1)' : 'rgba(56, 189, 248, 1)',
            weight: isRectangleSnapActive ? 3.5 : (isAnySnapActive ? 2.8 : 2),
            dashArray: isRectangleSnapActive ? null : '4, 4',
            interactive: false
        }).addTo(map);
        if (isRectangleSnapActive && exclusionRubberband._path) {
            exclusionRubberband._path.classList.add('rubberband-rect-locked');
        }
    }
}

function updateSiteCenterFromBoundary(polygon) {
    if (!polygon || !window.turf) return;
    try {
        const geojson = polygon.toGeoJSON();
        const cent = turf.centroid(geojson);
        const lat = cent.geometry.coordinates[1];
        const lng = cent.geometry.coordinates[0];
        
        state.lat = parseFloat(lat.toFixed(6));
        state.lng = parseFloat(lng.toFixed(6));
        
        if (marker) {
            marker.setLatLng([state.lat, state.lng]);
        }
        
        const dmsLat = convertToDMS(state.lat, true);
        const dmsLng = convertToDMS(state.lng, false);
        if (elements.coords) {
            elements.coords.value = `${dmsLat} ${dmsLng}`;
        }
        
        // Trigger silent background prefetch for instant PDF export
        prefetchReverseGeocode(state.lat, state.lng);
    } catch (e) {
        console.error("Error calculating centroid: ", e);
    }
    updateMarkerDragStates();
}

function inferParametersFromSiteBoundary(polygon, keepCurrentAzimuth = false) {
    if (!polygon) return;
    const latlngs = getOuterRingLatLngs(polygon);
    if (!latlngs || latlngs.length < 3) return;

    // 1. 更新案場中心經緯度
    updateSiteCenterFromBoundary(polygon);

    const refLat = state.lat;
    const refLng = state.lng;

    // 2. 推算方位角 (Azimuth)
    let inferredAzimuth = parseFloat(state.azimuth) || 180;
    
    if (!keepCurrentAzimuth) {
        if (state.siteType === 'roof-slope') {
            // 斜屋頂模式依最長邊幾何推算方位角
            let maxDist = 0;
            let bestAngle = inferredAzimuth;
            const metersPerLatDegree = 111320;
            const latRad = (refLat * Math.PI) / 180;
            const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
            
            for (let i = 0; i < latlngs.length; i++) {
                const p1 = latlngs[i];
                const p2 = latlngs[(i + 1) % latlngs.length];
                const dist = p1.distanceTo(p2);
                if (dist > maxDist) {
                    maxDist = dist;
                    const dy = (p2.lat - p1.lat) * metersPerLatDegree;
                    const dx = (p2.lng - p1.lng) * metersPerLngDegree;
                    let angle = (Math.atan2(dx, dy) * 180) / Math.PI;
                    if (angle < 0) angle += 360;
                    bestAngle = angle;
                }
            }
            inferredAzimuth = Math.round(bestAngle * 2) / 2;
        } else {
            // 地面與平屋頂預設朝南 180°
            if (state.azimuth === undefined) {
                inferredAzimuth = 180;
            }
        }
    }

    // 3. 計算案場邊界在該方位角下的投影寬度 X 與長度 Y (米)
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    for (const pt of latlngs) {
        const local = latLngToLocal(pt, refLat, refLng, inferredAzimuth);
        if (local.x < minX) minX = local.x;
        if (local.x > maxX) maxX = local.x;
        if (local.z < minZ) minZ = local.z;
        if (local.z > maxZ) maxZ = local.z;
    }
    const widthX = Math.max(0.1, maxX - minX);
    const lengthY = Math.max(0.1, maxZ - minZ);

    // 4. 計算單片模組在當前排布方向下的尺寸 (米)
    const isPortrait = state.pvOrient === 'portrait';
    // X 軸方向尺寸: 直向(portrait)為短邊 (pvW)，橫向(landscape)為長邊 (pvL)
    const pvW_m = (isPortrait ? state.pvW : state.pvL) / 1000;
    // Y 軸方向尺寸: 直向(portrait)為長邊 (pvL)，橫向(landscape)為短邊 (pvW)
    const pvL_m = (isPortrait ? state.pvL : state.pvW) / 1000;
    const spX_m = (parseFloat(state.spX) || 20) / 1000;
    const spY_m = (parseFloat(state.spY) || 20) / 1000;
    const arrP_m = parseFloat(state.arrP) || 1.0;

    // 5. 自動推算 arrI, arrJ, arrM
    // arrI: 陣列行數（滿版覆蓋，由 isModuleExcluded 自動剔除）
    let inferredI = Math.max(1, Math.ceil((widthX + spX_m) / (pvW_m + spX_m)));
    let inferredJ = 4;
    let inferredM = 1;

    if (state.siteType === 'roof-slope') {
        // 斜屋頂模式 arrM 固定為 1，由 arrJ 填滿長度 Y
        inferredM = 1;
        inferredJ = Math.max(1, Math.ceil((lengthY + spY_m) / (pvL_m + spY_m)));
    } else {
        // 地面與平屋頂 arrJ 固定為 4，以 arrM 增加總列數
        inferredJ = 4;

        // 計算單桌 4 片之高度
        const tableHeight = 4 * pvL_m + 3 * spY_m;
        if (lengthY >= tableHeight) {
            inferredM = 1 + Math.ceil((lengthY - tableHeight) / arrP_m);
        } else {
            inferredM = 1;
        }
        inferredM = Math.max(1, Math.min(50, inferredM));
    }

    // 6. 更新 UI 輸入框與 Slider 數值
    if (elements.arrI && !lockedParams['arrI']) {
        elements.arrI.value = inferredI;
        if (elements.arrISlider) elements.arrISlider.value = inferredI;
        state.arrI = inferredI;
    }
    if (elements.arrJ && !lockedParams['arrJ']) {
        elements.arrJ.value = inferredJ;
        if (elements.arrJSlider) elements.arrJSlider.value = inferredJ;
        state.arrJ = inferredJ;
    }
    if (elements.arrM && !lockedParams['arrM']) {
        elements.arrM.value = inferredM;
        if (elements.arrMSlider) elements.arrMSlider.value = inferredM;
        state.arrM = inferredM;
        handleSiteTypeChangeUI();
    }
    if (elements.azimuth && !lockedParams['azimuth']) {
        elements.azimuth.value = inferredAzimuth;
        if (elements.azimuthSlider) elements.azimuthSlider.value = inferredAzimuth;
        state.azimuth = inferredAzimuth;
    }

    calculateOutputs();
    updateAllVisuals(true);
}

function enterExclusionDrawMode() {
    exitNormalMode();
    exitMeasureMode();
    exitMapMeasureMode();
    exitObstacleDrawMode();
    exitSiteBoundaryDrawMode();
    clearActivePolygonSelection();
    
    isExclusionDrawMode = true;
    setPolygonsInteractivity(false);
    
    const panel = document.getElementById('exclusion-tool-panel');
    if (panel) panel.style.display = 'block';
    
    // Hide trigger button if it exists
    const triggerBtn = document.getElementById('btn-add-exclusion-trigger');
    if (triggerBtn) triggerBtn.style.display = 'none';
    
    selectExclusionTool('polygon');
    
    if (map) {
        map.getContainer().style.cursor = 'url("images/draw_pencil.svg") 2 30, crosshair';
        map.on('mousemove', handleExclusionMouseMove);
    }
}

function exitExclusionDrawMode() {
    isExclusionDrawMode = false;
    setPolygonsInteractivity(true);
    
    const panel = document.getElementById('exclusion-tool-panel');
    if (panel) panel.style.display = 'none';
    
    if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        map.off('mousemove', handleExclusionMouseMove);
    }
    
    clearExclusionDrawingState();
    clearSubstationEditHandles();
    if (exclusionPreviewPolygon) {
        map.removeLayer(exclusionPreviewPolygon);
        exclusionPreviewPolygon = null;
    }
    
    // Toggle the trigger button based on the overall slider state
    const triggerBtn = document.getElementById('btn-add-exclusion-trigger');
    if (triggerBtn) {
        if (exclusionState === 'edit') {
            triggerBtn.style.display = 'block';
        } else {
            triggerBtn.style.display = 'none';
        }
    }
}

function enterObstacleDrawMode() {
    exitNormalMode();
    exitMeasureMode();
    exitMapMeasureMode();
    exitExclusionDrawMode();
    exitSiteBoundaryDrawMode();
    clearActivePolygonSelection();
    
    isObstacleDrawMode = true;
    setPolygonsInteractivity(false);
    
    const panel = document.getElementById('obstacle-tool-panel');
    if (panel) panel.style.display = 'block';
    
    const triggerBtn = document.getElementById('btn-add-obstacle-trigger');
    if (triggerBtn) triggerBtn.style.display = 'none';
    
    if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = 'url("images/draw_pencil.svg") 2 30, crosshair';
        map.on('mousemove', handleObstacleMouseMove);
    }
}

function exitObstacleDrawMode() {
    isObstacleDrawMode = false;
    setPolygonsInteractivity(true);
    
    const panel = document.getElementById('obstacle-tool-panel');
    if (panel) panel.style.display = 'none';
    
    if (map) {
        map.dragging.enable();
        map.getContainer().style.cursor = '';
        map.off('mousemove', handleObstacleMouseMove);
    }
    
    clearObstacleDrawingState();
    
    const triggerBtn = document.getElementById('btn-add-obstacle-trigger');
    if (triggerBtn) {
        if (obstacleState === 'edit') {
            triggerBtn.style.display = 'block';
        } else {
            triggerBtn.style.display = 'none';
        }
    }
}

function clearObstacleDrawingState() {
    if (obstacleTempLine) { map.removeLayer(obstacleTempLine); obstacleTempLine = null; }
    clearExclusionDrawingState();
    obstaclePoints = [];
}

function setPolygonsInteractivity(interactive) {
    const pointerEvents = interactive ? 'auto' : 'none';
    
    const applyToPoly = (poly) => {
        if (!poly) return;
        const el = poly.getElement ? poly.getElement() : (poly._path || null);
        if (el) el.style.pointerEvents = pointerEvents;
    };
    
    applyToPoly(customSiteBoundary);
    exclusionPolygons.forEach(applyToPoly);
    obstaclePolygons.forEach(applyToPoly);
}

function handleObstacleMouseMove(e) {
    if (document.getElementById('polygon-confirm-modal')) {
        updateSnapMarkerVisual(null);
        if (exclusionRubberband) { map.removeLayer(exclusionRubberband); exclusionRubberband = null; }
        return;
    }
    if (!isObstacleDrawMode) return;
    
    lastMouseMoveEvent = e;
    
    let mouseLatLng = e.latlng;
    const snapCheck = checkVertexSnapping(mouseLatLng);
    let targetLatLng = snapCheck ? snapCheck.latlng : mouseLatLng;
    
    if (snapCheck) {
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        clearRightAngleIndicator();
        updateSnapMarkerVisual(snapCheck);
    } else {
        updateSnapMarkerVisual(null);
        targetLatLng = snapToPreviousSegmentRightAngle(obstaclePoints, mouseLatLng);
    }
    
    if (obstaclePoints.length === 0) return;
    
    let finalLatLng = targetLatLng;
    const isAnySnapActive = isRectangleSnapActive || isParallelSnapActive || isPerpendicularSnapActive || isRightAngleSnapActive || (snapCheck !== null);
    
    if (exclusionRubberband) {
        exclusionRubberband.setLatLngs([obstaclePoints[obstaclePoints.length - 1], finalLatLng]);
        exclusionRubberband.setStyle({
            color: isAnySnapActive ? 'rgba(255, 0, 128, 1)' : 'rgba(239, 68, 68, 1)',
            weight: isRectangleSnapActive ? 3.5 : (isAnySnapActive ? 2.8 : 2),
            dashArray: isRectangleSnapActive ? null : '4, 4'
        });
        if (exclusionRubberband._path) {
            if (isRectangleSnapActive) {
                exclusionRubberband._path.classList.add('rubberband-rect-locked');
            } else {
                exclusionRubberband._path.classList.remove('rubberband-rect-locked');
            }
        }
    } else {
        exclusionRubberband = L.polyline([obstaclePoints[obstaclePoints.length - 1], finalLatLng], {
            color: isAnySnapActive ? 'rgba(255, 0, 128, 1)' : 'rgba(239, 68, 68, 1)',
            weight: isRectangleSnapActive ? 3.5 : (isAnySnapActive ? 2.8 : 2),
            dashArray: isRectangleSnapActive ? null : '4, 4',
            interactive: false
        }).addTo(map);
        if (isRectangleSnapActive && exclusionRubberband._path) {
            exclusionRubberband._path.classList.add('rubberband-rect-locked');
        }
    }
}

function handleObstacleMapClick(latlng) {
    let clickedLatLng = latlng;
    const snapCheck = checkVertexSnapping(clickedLatLng);
    if (snapCheck) {
        clickedLatLng = snapCheck.latlng;
    } else {
        clickedLatLng = snapToPreviousSegmentRightAngle(obstaclePoints, clickedLatLng);
    }
    
    const isClosing = obstaclePoints.length > 0 && 
        (clickedLatLng.equals(obstaclePoints[0]) || clickedLatLng.distanceTo(obstaclePoints[0]) < 1.5);
    
    if (isClosing) {
        if (obstaclePoints.length >= 3) {
            const hInput = document.getElementById('val-obs-h');
            const h = parseFloat(hInput ? hInput.value : 5.0) || 5.0;
            
            const poly = L.polygon(obstaclePoints, {
                color: 'rgba(239, 68, 68, 1)',
                fillColor: 'rgba(239, 68, 68, 1)',
                fillOpacity: 0.35,
                weight: 2.5,
                dashArray: '6, 6',
                interactive: true
            }).addTo(map);
            
            clearObstacleDrawingState();
            promptPolygonKeepOrDiscard("障礙區域", () => {
                poly.isObstacle = true;
                poly.obstacleHeight = h;
                const onRoofChk = document.getElementById('chk-obs-on-roof');
                poly.isOnRoof = onRoofChk ? onRoofChk.checked : true;
                makePolygonDraggable(poly);
                makePolygonSelectable(poly);
                obstaclePolygons.push(poly);
                exitObstacleDrawMode();
                calculateOutputs();
                updateAllVisuals(true);
            }, () => {
                map.removeLayer(poly);
                exitObstacleDrawMode();
                calculateOutputs();
                updateAllVisuals(true);
            }, poly);
        } else {
            clearObstacleDrawingState();
            exitObstacleDrawMode();
        }
        
        isRightAngleSnapBypassed = false;
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        return;
    }
    
    obstaclePoints.push(clickedLatLng);
    isRightAngleSnapBypassed = false;
    isRightAngleSnapActive = false;
    isRectangleSnapActive = false;
    isParallelSnapActive = false;
    isPerpendicularSnapActive = false;
    
    if (obstacleTempLine) {
        obstacleTempLine.setLatLngs(obstaclePoints);
    } else {
        obstacleTempLine = L.polyline(obstaclePoints, {
            color: 'rgba(239, 68, 68, 1)',
            weight: 2.5,
            interactive: false
        }).addTo(map);
    }
    
    addDrawingVertexMarker(clickedLatLng, obstaclePoints, obstacleTempLine, 'rgba(239, 68, 68, 1)', exclusionSnappers);
}

function handleExclusionMouseMove(e) {
    if (document.getElementById('polygon-confirm-modal')) {
        updateSnapMarkerVisual(null);
        if (exclusionRubberband) { map.removeLayer(exclusionRubberband); exclusionRubberband = null; }
        return;
    }
    if (!isExclusionDrawMode) return;
    
    lastMouseMoveEvent = e;
    
    let mouseLatLng = e.latlng;
    const snapCheck = checkVertexSnapping(mouseLatLng);
    let targetLatLng = snapCheck ? snapCheck.latlng : mouseLatLng;
    
    if (snapCheck) {
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        clearRightAngleIndicator();
        updateSnapMarkerVisual(snapCheck);
    } else {
        updateSnapMarkerVisual(null);
        if (currentExclusionTool === 'polygon') {
            targetLatLng = snapToPreviousSegmentRightAngle(exclusionPoints, mouseLatLng);
        }
    }
    
    if (currentExclusionTool === 'polygon') {
        if (exclusionPoints.length === 0) return;
        
        let finalLatLng = targetLatLng;
        const isAnySnapActive = isRectangleSnapActive || isParallelSnapActive || isPerpendicularSnapActive || isRightAngleSnapActive || (snapCheck !== null);
        
        if (exclusionRubberband) {
            exclusionRubberband.setLatLngs([exclusionPoints[exclusionPoints.length - 1], finalLatLng]);
            exclusionRubberband.setStyle({
                color: isAnySnapActive ? 'rgba(255, 0, 128, 1)' : 'rgba(251, 191, 36, 1)',
                weight: isRectangleSnapActive ? 3.5 : (isAnySnapActive ? 2.8 : 2),
                dashArray: isRectangleSnapActive ? null : '4, 4'
            });
            if (exclusionRubberband._path) {
                if (isRectangleSnapActive) {
                    exclusionRubberband._path.classList.add('rubberband-rect-locked');
                } else {
                    exclusionRubberband._path.classList.remove('rubberband-rect-locked');
                }
            }
        } else {
            exclusionRubberband = L.polyline([exclusionPoints[exclusionPoints.length - 1], finalLatLng], {
                color: isAnySnapActive ? 'rgba(255, 0, 128, 1)' : 'rgba(251, 191, 36, 1)',
                weight: isRectangleSnapActive ? 3.5 : (isAnySnapActive ? 2.8 : 2),
                dashArray: isRectangleSnapActive ? null : '4, 4',
                interactive: false
            }).addTo(map);
            if (isRectangleSnapActive && exclusionRubberband._path) {
                exclusionRubberband._path.classList.add('rubberband-rect-locked');
            }
        }
    }
}

function handleExclusionMapClick(latlng) {
    let clickedLatLng = latlng;
    const snapCheck = checkVertexSnapping(clickedLatLng);
    if (snapCheck) {
        clickedLatLng = snapCheck.latlng;
    } else {
        if (currentExclusionTool === 'polygon') {
            clickedLatLng = snapToPreviousSegmentRightAngle(exclusionPoints, clickedLatLng);
        }
    }
    
    if (currentExclusionTool === 'polygon') {
        const isClosing = exclusionPoints.length > 0 && 
            (clickedLatLng.equals(exclusionPoints[0]) || clickedLatLng.distanceTo(exclusionPoints[0]) < 1.5);
        
        if (isClosing) {
            if (exclusionPoints.length >= 3) {
                const poly = L.polygon(exclusionPoints, {
                    color: 'rgba(251, 191, 36, 1)',
                    fillColor: 'rgba(251, 191, 36, 1)',
                    fillOpacity: 0.3,
                    weight: 2.5,
                    dashArray: '6, 6',
                    interactive: true
                }).addTo(map);
                
                clearExclusionDrawingState();
                promptPolygonKeepOrDiscard("排除區域", () => {
                    makePolygonDraggable(poly);
                    makePolygonSelectable(poly);
                    exclusionPolygons.push(poly);
                    exitExclusionDrawMode();
                    calculateOutputs();
                    updateAllVisuals(true);
                }, () => {
                    map.removeLayer(poly);
                    exitExclusionDrawMode();
                    calculateOutputs();
                    updateAllVisuals(true);
                }, poly);
            } else {
                clearExclusionDrawingState();
                exitExclusionDrawMode();
            }
            
            isRightAngleSnapBypassed = false;
            isRightAngleSnapActive = false;
            isRectangleSnapActive = false;
            isParallelSnapActive = false;
            isPerpendicularSnapActive = false;
            return;
        }
        
        exclusionPoints.push(clickedLatLng);
        isRightAngleSnapBypassed = false;
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        
        if (exclusionTempLine) {
            exclusionTempLine.setLatLngs(exclusionPoints);
        } else {
            exclusionTempLine = L.polyline(exclusionPoints, {
                color: 'rgba(251, 191, 36, 1)',
                weight: 2.5,
                interactive: false
            }).addTo(map);
        }
        
        addDrawingVertexMarker(clickedLatLng, exclusionPoints, exclusionTempLine, 'rgba(249, 115, 22, 1)', exclusionSnappers);
    }
}

function clearExclusionDrawingState() {
    if (exclusionTempLine) { map.removeLayer(exclusionTempLine); exclusionTempLine = null; }
    if (exclusionRubberband) { map.removeLayer(exclusionRubberband); exclusionRubberband = null; }
    if (mapSnapMarker) { map.removeLayer(mapSnapMarker); mapSnapMarker = null; }
    exclusionSnappers.forEach(s => map.removeLayer(s));
    exclusionSnappers = [];
    exclusionPoints = [];
    
    if (exclusionTempMarker) { map.removeLayer(exclusionTempMarker); exclusionTempMarker = null; }
    exclusionPathwayStart = null;
    exclusionWalkwayStart = null;
    clearRightAngleIndicator();
}

function getPolygonCenter(polygon) {
    const latlngs = getOuterRingLatLngs(polygon);
    let sumLat = 0, sumLng = 0;
    for (const pt of latlngs) {
        sumLat += pt.lat;
        sumLng += pt.lng;
    }
    return L.latLng(sumLat / latlngs.length, sumLng / latlngs.length);
}

function rotatePolygon(polygon, angleDegrees) {
    if (selectedEdgeHighlightLine) {
        map.removeLayer(selectedEdgeHighlightLine);
        selectedEdgeHighlightLine = null;
        activeSelectedEdgeIndex = -1;
        updateToolboxPopupEdgeUI();
    }
    const center = getPolygonCenter(polygon);
    const latlngs = getOuterRingLatLngs(polygon);
    const angleRad = (angleDegrees * Math.PI) / 180;
    const cosTheta = Math.cos(angleRad);
    const sinTheta = Math.sin(angleRad);
    
    const metersPerLatDegree = 111320;
    const latRad = (center.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const newLatLngs = latlngs.map(pt => {
        const dy = (pt.lat - center.lat) * metersPerLatDegree;
        const dx = (pt.lng - center.lng) * metersPerLngDegree;
        
        const rx = dx * cosTheta - dy * sinTheta;
        const ry = dx * sinTheta + dy * cosTheta;
        
        return L.latLng(
            center.lat + ry / metersPerLatDegree,
            center.lng + rx / metersPerLngDegree
        );
    });
    
    if (polygon instanceof L.Polygon) {
        polygon.setLatLngs([newLatLngs]);
    } else {
        polygon.setLatLngs(newLatLngs);
    }
    
    if (polygon.isSubstation) {
        polygon.substationAngle = (polygon.substationAngle || 0) + angleDegrees;
        if (activeSubstationPoly === polygon) {
            if (substationCenterMarker) substationCenterMarker.setLatLng(polygon.substationCenter);
            const rotateLatLng = projectLatLng(polygon.substationCenter, polygon.substationAngle, 4.0);
            if (substationRotationMarker) substationRotationMarker.setLatLng(rotateLatLng);
            if (substationConnectLine) substationConnectLine.setLatLngs([polygon.substationCenter, rotateLatLng]);
        }
    }
}

function scalePolygon(polygon, factor) {
    if (selectedEdgeHighlightLine) {
        map.removeLayer(selectedEdgeHighlightLine);
        selectedEdgeHighlightLine = null;
        activeSelectedEdgeIndex = -1;
        updateToolboxPopupEdgeUI();
    }
    const center = getPolygonCenter(polygon);
    const latlngs = getOuterRingLatLngs(polygon);
    
    const newLatLngs = latlngs.map(pt => {
        const dLat = pt.lat - center.lat;
        const dLng = pt.lng - center.lng;
        return L.latLng(
            center.lat + dLat * factor,
            center.lng + dLng * factor
        );
    });
    
    if (polygon instanceof L.Polygon) {
        polygon.setLatLngs([newLatLngs]);
    } else {
        polygon.setLatLngs(newLatLngs);
    }
}

function findClosestEdge(polygon, clickLatLng) {
    const latlngs = getOuterRingLatLngs(polygon);
    let minDistance = Infinity;
    let closestIndex = -1;
    
    if (!map || !latlngs || latlngs.length < 2) return -1;
    const clickPoint = map.latLngToContainerPoint(clickLatLng);
    
    for (let i = 0; i < latlngs.length; i++) {
        const p1 = map.latLngToContainerPoint(latlngs[i]);
        const p2 = map.latLngToContainerPoint(latlngs[(i + 1) % latlngs.length]);
        
        const dist = distToSegment(clickPoint, p1, p2);
        if (dist < minDistance) {
            minDistance = dist;
            closestIndex = i;
        }
    }
    
    // 距離邊線 <= 12px 判定為選取特定邊線；點擊在多邊形面內 (> 12px) 則判定為選取整個多邊形面 (-1)
    if (minDistance <= 12) {
        return closestIndex;
    }
    return -1;
}

function distToSegment(p, v, w) {
    const l2 = dist2(v, w);
    if (l2 === 0) return dist2(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.sqrt(dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }));
}

function dist2(v, w) {
    return (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
}

function lineIntersection(A, d1, B, d2) {
    const denom = d1.x * d2.y - d1.y * d2.x;
    if (Math.abs(denom) < 1e-8) {
        return A;
    }
    const t = ((B.x - A.x) * d2.y - (B.y - A.y) * d2.x) / denom;
    return { x: A.x + t * d1.x, y: A.y + t * d1.y };
}

function offsetSelectedEdge(poly, edgeIndex, amountMeters) {
    const center = getPolygonCenter(poly);
    const centerLat = center.lat;
    const centerLng = center.lng;
    
    const metersPerLatDegree = 111320;
    const latRad = (centerLat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const latlngs = getOuterRingLatLngs(poly);
    const vertices = latlngs.map(pt => ({
        x: (pt.lng - centerLng) * metersPerLngDegree,
        y: (pt.lat - centerLat) * metersPerLatDegree
    }));
    
    const n_vertices = vertices.length;
    if (n_vertices < 3 || edgeIndex < 0 || edgeIndex >= n_vertices) return;
    
    let areaSum = 0;
    for (let i = 0; i < n_vertices; i++) {
        const v1 = vertices[i];
        const v2 = vertices[(i + 1) % n_vertices];
        areaSum += (v1.x * v2.y - v2.x * v1.y);
    }
    const isCCW = areaSum > 0;
    
    const Vi = vertices[edgeIndex];
    const Vi1 = vertices[(edgeIndex + 1) % n_vertices];
    
    const ux = Vi1.x - Vi.x;
    const uy = Vi1.y - Vi.y;
    const len = Math.sqrt(ux * ux + uy * uy);
    if (len < 1e-6) return;
    
    let nx = isCCW ? uy / len : -uy / len;
    let ny = isCCW ? -ux / len : ux / len;
    
    const offsetDist = amountMeters;
    
    const Vi_prime = { x: Vi.x + nx * offsetDist, y: Vi.y + ny * offsetDist };
    const u = { x: ux, y: uy };
    
    const Vi_prev = vertices[(edgeIndex - 1 + n_vertices) % n_vertices];
    const Vi_next2 = vertices[(edgeIndex + 2) % n_vertices];
    
    const d_prev = { x: Vi.x - Vi_prev.x, y: Vi.y - Vi_prev.y };
    const d_next = { x: Vi_next2.x - Vi1.x, y: Vi_next2.y - Vi1.y };
    
    const newVi = lineIntersection(Vi_prime, u, Vi_prev, d_prev);
    const newVi1 = lineIntersection(Vi_prime, u, Vi1, d_next);
    
    vertices[edgeIndex] = newVi;
    vertices[(edgeIndex + 1) % n_vertices] = newVi1;
    
    const newLatLngs = vertices.map(v => L.latLng(
        centerLat + v.y / metersPerLatDegree,
        centerLng + v.x / metersPerLngDegree
    ));
    
    if (poly instanceof L.Polygon) {
        poly.setLatLngs([newLatLngs]);
    } else {
        poly.setLatLngs(newLatLngs);
    }
    
    if (poly === customSiteBoundary) {
        updateSiteCenterFromBoundary(customSiteBoundary);
    }
    
    if (selectedEdgeHighlightLine) {
        selectedEdgeHighlightLine.setLatLngs([newLatLngs[edgeIndex], newLatLngs[(edgeIndex + 1) % n_vertices]]);
    }
    
    calculateOutputs();
    updateAllVisuals(true);
}

function keepToolboxPopupInViewport() {
    if (!activeSelectedPolygonPopup || !map) return;
    const popup = activeSelectedPolygonPopup;
    const popupElement = popup.getElement();
    if (!popupElement) return;
    
    const rect = popupElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    
    const mapContainer = map.getContainer();
    const mapRect = mapContainer.getBoundingClientRect();
    
    const margin = 10;
    
    let shiftX = 0;
    let shiftY = 0;
    
    if (rect.left < mapRect.left + margin) {
        shiftX = (mapRect.left + margin) - rect.left;
    } else if (rect.right > mapRect.right - margin) {
        shiftX = (mapRect.right - margin) - rect.right;
    }
    
    if (rect.top < mapRect.top + margin) {
        shiftY = (mapRect.top + margin) - rect.top;
    } else if (rect.bottom > mapRect.bottom - margin) {
        shiftY = (mapRect.bottom - margin) - rect.bottom;
    }
    
    if (shiftX !== 0 || shiftY !== 0) {
        const currentLatLng = popup.getLatLng();
        if (!currentLatLng) return;
        const currentContainerPoint = map.latLngToContainerPoint(currentLatLng);
        
        const newContainerPoint = L.point(
            currentContainerPoint.x + shiftX,
            currentContainerPoint.y + shiftY
        );
        
        const newLatLng = map.containerPointToLatLng(newContainerPoint);
        
        // Temporarily disable autoPan on the popup options to prevent map jumps
        const originalAutoPan = popup.options.autoPan;
        popup.options.autoPan = false;
        popup.setLatLng(newLatLng);
        popup.options.autoPan = originalAutoPan;
    }
}

function updateSelectedPolygonVisuals(poly, edgeIndex) {
    if (!poly) return;
    
    // Clear any previous edge highlight line
    if (selectedEdgeHighlightLine) {
        if (map) {
            try { map.removeLayer(selectedEdgeHighlightLine); } catch (e) {}
        }
        selectedEdgeHighlightLine = null;
    }
    
    if (edgeIndex !== -1) {
        // Single Edge Selected -> That single edge flashes bright white!
        if (poly._path) {
            poly._path.classList.remove('polygon-selected-flash');
        }
        
        let normalColor = 'rgba(234, 88, 12, 1)';
        if (poly === customSiteBoundary) normalColor = 'rgba(56, 189, 248, 1)';
        else if (poly.isObstacle) normalColor = 'rgba(239, 68, 68, 1)';
        else if (poly.isWalkway) normalColor = 'rgba(16, 185, 129, 1)';
        poly.setStyle({ color: normalColor, weight: 2.5, fillOpacity: poly === customSiteBoundary ? 0 : 0.25 });
        
        const outerLatLngs = getOuterRingLatLngs(poly);
        if (outerLatLngs && outerLatLngs.length > 0) {
            const p1 = outerLatLngs[edgeIndex];
            const p2 = outerLatLngs[(edgeIndex + 1) % outerLatLngs.length];
            selectedEdgeHighlightLine = L.polyline([p1, p2], {
                color: '#ffffff',
                weight: 5.5,
                opacity: 1.0,
                interactive: false
            }).addTo(map);
            
            if (selectedEdgeHighlightLine._path) {
                selectedEdgeHighlightLine._path.classList.add('edge-selected-flash');
            }
        }
    } else {
        // Whole Polygon Selected (draggable state) -> Entire polygon border flashes bright white!
        poly.setStyle({
            color: '#ffffff',
            weight: 4.5,
            fillOpacity: poly === customSiteBoundary ? 0 : 0.35
        });
        if (poly._path) {
            poly._path.classList.add('polygon-selected-flash');
        }
    }
}

function updateToolboxPopupEdgeUI() {
    const lbl = document.getElementById('toolbox-edge-label');
    const btnIn = document.getElementById('btn-toolbox-edge-in');
    const btnOut = document.getElementById('btn-toolbox-edge-out');
    
    if (activeSelectedEdgeIndex !== -1) {
        if (lbl) lbl.innerHTML = `已選取邊線 #${activeSelectedEdgeIndex + 1}`;
        if (btnIn) btnIn.disabled = false;
        if (btnOut) btnOut.disabled = false;
    } else {
        if (lbl) lbl.innerHTML = `點擊邊線微調偏移`;
        if (btnIn) btnIn.disabled = true;
        if (btnOut) btnOut.disabled = true;
    }
    
    if (activeSelectedPolygon) {
        updateSelectedPolygonVisuals(activeSelectedPolygon, activeSelectedEdgeIndex);
    }
}

function makePolygonSelectable(poly) {
    if (poly.unbindPopup) {
        poly.unbindPopup();
    }
    poly.on('click', (e) => {
        if (isSiteBoundaryDrawMode || isExclusionDrawMode || isObstacleDrawMode) return;
        
        // Check active mode state
        if (poly === customSiteBoundary && siteBoundaryState !== 'edit') return;
        if (poly.isObstacle && obstacleState !== 'edit') return;
        if (poly !== customSiteBoundary && !poly.isObstacle && exclusionState !== 'edit') return;
        
        try { poly.bringToFront(); } catch (err) {}
        
        // Determine closest edge to click point
        let closestEdge = -1;
        if (!poly.isWalkway) {
            closestEdge = findClosestEdge(poly, e.latlng);
        }
        
        clearActivePolygonSelection();
        activeSelectedPolygon = poly;
        activeSelectedEdgeIndex = closestEdge;
        
        updatePolygonVertexHandles(poly);
        updateSelectedPolygonVisuals(poly, activeSelectedEdgeIndex);
        showPolygonToolboxPanel(poly);
        updateToolboxPopupEdgeUI();
        
        L.DomEvent.stopPropagation(e);
    });
}

function showPolygonToolboxPanel(poly) {
    let panel = document.getElementById('polygon-toolbox-panel');
    if (!panel) return;
    
    let title = "排除區域";
    if (poly.isWalkway) {
        title = "維修走道區域";
    } else if (poly === customSiteBoundary) {
        title = "案場邊界";
    } else if (poly.isObstacle) {
        const onRoofLabel = (poly.isOnRoof !== false && state.siteType !== 'ground') ? ' [建物上]' : '';
        title = `障礙物 (${poly.obstacleHeight || 5.0}m)${onRoofLabel}`;
        const onRoofChk = document.getElementById('chk-obs-on-roof');
        if (onRoofChk) onRoofChk.checked = (poly.isOnRoof !== false);
    } else {
        if (poly.isSubstation) title = "升壓站";
        else if (poly.isPathway) title = `${poly.pathwayWidth}m 走道`;
    }
    
    let heightControlsHtml = '';
    if (poly.isObstacle) {
        heightControlsHtml = `
            <div style="display: flex; gap: 4px; justify-content: center; margin-bottom: 4px;">
                <button id="btn-toolbox-height-down" class="toolbox-btn" style="flex: 1;">降低</button>
                <button id="btn-toolbox-height-up" class="toolbox-btn" style="flex: 1;">升高</button>
            </div>
        `;
    }

    const edgeOffsetHtml = `
        <div style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 4px; margin-bottom: 4px;">
            <div id="toolbox-edge-label" style="font-size: 0.65rem; color: #ffffff; margin-bottom: 3px; text-align: center; font-weight: bold;">
                ${activeSelectedEdgeIndex !== -1 ? `已選取邊線 #${activeSelectedEdgeIndex + 1}` : '點擊邊線微調偏移'}
            </div>
            <div style="display: flex; gap: 4px; justify-content: center;">
                <button id="btn-toolbox-edge-in" class="toolbox-btn" style="flex: 1;" title="將邊線向內平移 0.5m" ${activeSelectedEdgeIndex === -1 ? 'disabled' : ''}>內縮</button>
                <button id="btn-toolbox-edge-out" class="toolbox-btn" style="flex: 1;" title="將邊線向外平移 0.5m" ${activeSelectedEdgeIndex === -1 ? 'disabled' : ''}>外推</button>
            </div>
        </div>
    `;

    panel.innerHTML = `
        <div style="font-family: sans-serif; font-size: 0.8rem; text-align: center; color: #ffffff; padding: 0; min-width: 110px;">
            <div class="toolbox-drag-handle" style="font-size: 0.68rem; font-weight: bold; color: #ffffff; margin-bottom: 4px; user-select: none;">${title}</div>
            ${edgeOffsetHtml}
            ${heightControlsHtml}
            <div style="display: flex; gap: 4px; justify-content: center;">
                <button id="btn-toolbox-delete" class="toolbox-btn" style="flex: 1;">刪除</button>
                <button id="btn-toolbox-cancel" class="toolbox-btn" style="flex: 1;">返回</button>
            </div>
        </div>
    `;

    const btnDel = panel.querySelector('#btn-toolbox-delete');
    const btnCancel = panel.querySelector('#btn-toolbox-cancel');
    const btnHeightDown = panel.querySelector('#btn-toolbox-height-down');
    const btnHeightUp = panel.querySelector('#btn-toolbox-height-up');
    const btnEdgeIn = panel.querySelector('#btn-toolbox-edge-in');
    const btnEdgeOut = panel.querySelector('#btn-toolbox-edge-out');

    if (btnCancel) {
        btnCancel.addEventListener('click', () => {
            clearActivePolygonSelection();
        });
    }

    if (btnEdgeIn) {
        btnEdgeIn.addEventListener('click', () => {
            const edgeIdx = activeSelectedEdgeIndex >= 0 ? activeSelectedEdgeIndex : 0;
            offsetSelectedEdge(poly, edgeIdx, -0.5);
            updateToolboxPopupEdgeUI();
        });
    }
    if (btnEdgeOut) {
        btnEdgeOut.addEventListener('click', () => {
            const edgeIdx = activeSelectedEdgeIndex >= 0 ? activeSelectedEdgeIndex : 0;
            offsetSelectedEdge(poly, edgeIdx, 0.5);
            updateToolboxPopupEdgeUI();
        });
    }
    
    if (btnDel) {
        btnDel.addEventListener('click', () => {
            map.removeLayer(poly);
            clearPolygonVertexHandles();
            if (selectedEdgeHighlightLine) {
                map.removeLayer(selectedEdgeHighlightLine);
                selectedEdgeHighlightLine = null;
            }
            activeSelectedEdgeIndex = -1;
            if (poly === customSiteBoundary) {
                customSiteBoundary = null;
                if (siteBoundaryState === 'edit') {
                    clearSiteBoundaryDrawingState();
                    updateSiteBoundaryDrawState();
                }
                updateMarkerDragStates();
            } else if (poly.isObstacle) {
                obstaclePolygons = obstaclePolygons.filter(p => p !== poly);
            } else {
                if (poly.isSubstation) {
                    clearSubstationEditHandles();
                }
                exclusionPolygons = exclusionPolygons.filter(p => p !== poly);
            }
            activeSelectedPolygon = null;
            panel.style.display = 'none';
            calculateOutputs();
            updateAllVisuals(true);
        });
    }
    
    if (btnHeightDown) {
        btnHeightDown.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            poly.obstacleHeight = Math.max(0.5, (poly.obstacleHeight || 5.0) - 0.5);
            const onRoofLabel = (poly.isOnRoof !== false && state.siteType !== 'ground') ? ' [建物上]' : '';
            const handle = panel.querySelector('.toolbox-drag-handle');
            if (handle) {
                handle.innerHTML = `障礙物 (${poly.obstacleHeight.toFixed(1)}m)${onRoofLabel}`;
            }
            const hInput = document.getElementById('val-obs-h');
            const hSlider = document.getElementById('val-obs-h-slider');
            if (hInput) hInput.value = poly.obstacleHeight.toFixed(1);
            if (hSlider && poly.obstacleHeight >= 1 && poly.obstacleHeight <= 20) hSlider.value = poly.obstacleHeight;
            
            if (obstacleHeightDebounceTimer) clearTimeout(obstacleHeightDebounceTimer);
            obstacleHeightDebounceTimer = setTimeout(() => {
                calculateOutputs();
                updateAllVisuals(true);
                obstacleHeightDebounceTimer = null;
            }, 80);
        });
    }
    if (btnHeightUp) {
        btnHeightUp.addEventListener('click', (e) => {
            if (e) e.stopPropagation();
            poly.obstacleHeight = (poly.obstacleHeight || 5.0) + 0.5;
            const onRoofLabel = (poly.isOnRoof !== false && state.siteType !== 'ground') ? ' [建物上]' : '';
            const handle = panel.querySelector('.toolbox-drag-handle');
            if (handle) {
                handle.innerHTML = `障礙物 (${poly.obstacleHeight.toFixed(1)}m)${onRoofLabel}`;
            }
            const hInput = document.getElementById('val-obs-h');
            const hSlider = document.getElementById('val-obs-h-slider');
            if (hInput) hInput.value = poly.obstacleHeight.toFixed(1);
            if (hSlider && poly.obstacleHeight >= 1 && poly.obstacleHeight <= 20) hSlider.value = poly.obstacleHeight;
            
            if (obstacleHeightDebounceTimer) clearTimeout(obstacleHeightDebounceTimer);
            obstacleHeightDebounceTimer = setTimeout(() => {
                calculateOutputs();
                updateAllVisuals(true);
                obstacleHeightDebounceTimer = null;
            }, 80);
        });
    }

    panel.style.display = 'block';
}

function duplicatePolygon(sourcePolygon, offsetLat = 0, offsetLng = 0) {
    if (!sourcePolygon || !map) return null;
    const rawLatLngs = getOuterRingLatLngs(sourcePolygon);
    if (!rawLatLngs || rawLatLngs.length < 3) return null;
    
    const clonedLatLngs = rawLatLngs.map(pt => L.latLng(pt.lat + offsetLat, pt.lng + offsetLng));
    let newPoly = null;
    
    if (sourcePolygon.isObstacle) {
        newPoly = L.polygon(clonedLatLngs, {
            color: 'rgba(239, 68, 68, 1)',
            fillColor: 'rgba(239, 68, 68, 1)',
            fillOpacity: 0.35,
            weight: 2.5,
            dashArray: '6, 6',
            interactive: true
        }).addTo(map);
        newPoly.isObstacle = true;
        newPoly.obstacleHeight = sourcePolygon.obstacleHeight !== undefined ? sourcePolygon.obstacleHeight : 5.0;
        newPoly.isOnRoof = sourcePolygon.isOnRoof !== false;
        makePolygonDraggable(newPoly);
        makePolygonSelectable(newPoly);
        obstaclePolygons.push(newPoly);
    } else {
        const isWalkway = !!sourcePolygon.isWalkway;
        newPoly = L.polygon(clonedLatLngs, {
            color: isWalkway ? 'rgba(56, 189, 248, 1)' : 'rgba(249, 115, 22, 1)',
            fillColor: isWalkway ? 'rgba(56, 189, 248, 1)' : 'rgba(249, 115, 22, 1)',
            fillOpacity: isWalkway ? 0.45 : 0.35,
            weight: 2.5,
            dashArray: '6, 6',
            interactive: true
        }).addTo(map);
        newPoly.isExclusion = true;
        if (isWalkway) newPoly.isWalkway = true;
        if (sourcePolygon.isSubstation) {
            newPoly.isSubstation = true;
            newPoly.substationWidth = sourcePolygon.substationWidth;
            newPoly.substationHeight = sourcePolygon.substationHeight;
            newPoly.substationAngle = sourcePolygon.substationAngle;
            if (sourcePolygon.substationCenter) {
                newPoly.substationCenter = L.latLng(
                    sourcePolygon.substationCenter.lat + offsetLat,
                    sourcePolygon.substationCenter.lng + offsetLng
                );
            }
        }
        if (sourcePolygon.isPathway) {
            newPoly.isPathway = true;
            newPoly.pathwayWidth = sourcePolygon.pathwayWidth;
        }
        makePolygonDraggable(newPoly);
        makePolygonSelectable(newPoly);
        exclusionPolygons.push(newPoly);
    }
    
    return newPoly;
}

function triggerPolygonCloneEffect(poly, message = "已複製多邊形") {
    if (!poly) return;
    try {
        const el = poly._path || (poly.getElement ? poly.getElement() : null);
        if (el) {
            el.classList.remove('polygon-clone-shimmer');
            void el.offsetWidth;
            el.classList.add('polygon-clone-shimmer');
            setTimeout(() => {
                try { if (el) el.classList.remove('polygon-clone-shimmer'); } catch(e) {}
            }, 1400);
        }
    } catch(err) {}
    showCloneToast(message);
}

let cloneToastTimeout = null;
function showCloneToast(message) {
    let toast = document.getElementById('clone-toast-banner');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'clone-toast-banner';
        toast.className = 'clone-toast-notification';
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span style="font-size: 1.1rem; filter: drop-shadow(0 0 6px rgba(56,189,248,0.8));">✨</span> <span>${message}</span>`;
    toast.classList.add('active');
    
    if (cloneToastTimeout) clearTimeout(cloneToastTimeout);
    cloneToastTimeout = setTimeout(() => {
        if (toast) toast.classList.remove('active');
    }, 1800);
}

function snapPolygonToSiteBoundary(newLatLngs) {
    const targetBoundary = customSiteBoundary || coveragePolygon;
    if (!targetBoundary || !map) return null;
    const boundaryLatLngs = getOuterRingLatLngs(targetBoundary);
    if (!boundaryLatLngs || boundaryLatLngs.length < 3) return null;
    
    const snapThresholdPixels = 16;
    let bestSnap = null;
    let minSnapDist = Infinity;
    
    // 1. Check Vertex-to-Vertex snapping
    for (let i = 0; i < newLatLngs.length; i++) {
        const polyPt = map.latLngToContainerPoint(newLatLngs[i]);
        
        // Check corner endpoints of site boundary
        for (let j = 0; j < boundaryLatLngs.length; j++) {
            const bPt = map.latLngToContainerPoint(boundaryLatLngs[j]);
            const dist = polyPt.distanceTo(bPt);
            if (dist < snapThresholdPixels && dist < minSnapDist) {
                minSnapDist = dist;
                bestSnap = {
                    dLat: boundaryLatLngs[j].lat - newLatLngs[i].lat,
                    dLng: boundaryLatLngs[j].lng - newLatLngs[i].lng,
                    snapLatLng: boundaryLatLngs[j],
                    type: 'endpoint'
                };
            }
        }
        
        // Check edge midpoints of site boundary
        for (let j = 0; j < boundaryLatLngs.length; j++) {
            const b1 = boundaryLatLngs[j];
            const b2 = boundaryLatLngs[(j + 1) % boundaryLatLngs.length];
            const mid = L.latLng((b1.lat + b2.lat) / 2, (b1.lng + b2.lng) / 2);
            const bPt = map.latLngToContainerPoint(mid);
            const dist = polyPt.distanceTo(bPt);
            if (dist < snapThresholdPixels && dist < minSnapDist) {
                minSnapDist = dist;
                bestSnap = {
                    dLat: mid.lat - newLatLngs[i].lat,
                    dLng: mid.lng - newLatLngs[i].lng,
                    snapLatLng: mid,
                    type: 'midpoint'
                };
            }
        }
    }
    
    // 2. Check Vertex-to-Edge projection snapping
    if (!bestSnap) {
        for (let i = 0; i < newLatLngs.length; i++) {
            const p = map.latLngToContainerPoint(newLatLngs[i]);
            for (let j = 0; j < boundaryLatLngs.length; j++) {
                const a = map.latLngToContainerPoint(boundaryLatLngs[j]);
                const b = map.latLngToContainerPoint(boundaryLatLngs[(j + 1) % boundaryLatLngs.length]);
                
                const ab2 = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
                if (ab2 === 0) continue;
                let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / ab2;
                t = Math.max(0, Math.min(1, t));
                const proj = L.point(a.x + t * (b.x - a.x), a.y + t * (b.y - a.y));
                const dist = p.distanceTo(proj);
                if (dist < snapThresholdPixels && dist < minSnapDist) {
                    minSnapDist = dist;
                    const projLatLng = map.containerPointToLatLng(proj);
                    bestSnap = {
                        dLat: projLatLng.lat - newLatLngs[i].lat,
                        dLng: projLatLng.lng - newLatLngs[i].lng,
                        snapLatLng: projLatLng,
                        type: 'midpoint'
                    };
                }
            }
        }
    }
    
    return bestSnap;
}

function makePolygonDraggable(polygon) {
    let isDraggingPoly = false;
    let startMouseLatLng = null;
    let startLatLngs = null;
    let startSubstationCenter = null;
    let activeDragPoly = polygon;

    const startPolyDrag = (latlng, isModifierDown = false) => {
        if (isSiteBoundaryDrawMode || isExclusionDrawMode || isObstacleDrawMode) return false;
        if (polygon === customSiteBoundary && siteBoundaryState !== 'edit') return false;
        if (polygon.isObstacle && obstacleState !== 'edit') return false;
        if (polygon !== customSiteBoundary && !polygon.isObstacle && exclusionState !== 'edit') return false;

        const closestEdge = findClosestEdge(polygon, latlng);
        if (closestEdge !== -1) {
            return false;
        }

        activeDragPoly = polygon;

        // If Ctrl / Cmd is pressed on desktop during drag start on obstacle / exclusion, duplicate!
        if (isModifierDown && polygon !== customSiteBoundary) {
            const cloned = duplicatePolygon(polygon, 0, 0);
            if (cloned) {
                triggerPolygonCloneEffect(cloned, "✨ 已複製多邊形 (Ctrl+拖曳)");
                activeDragPoly = cloned;
            }
        }

        try { activeDragPoly.bringToFront(); } catch (err) {}
        map.dragging.disable();
        isDraggingPoly = true;
        startMouseLatLng = latlng;

        if (map && map.getContainer()) {
            map.getContainer().style.cursor = 'move';
        }

        activeSelectedPolygon = activeDragPoly;
        activeSelectedEdgeIndex = -1;
        updateSelectedPolygonVisuals(activeDragPoly, -1);
        updatePolygonVertexHandles(activeDragPoly);
        showPolygonToolboxPanel(activeDragPoly);
        updateToolboxPopupEdgeUI();

        if (activeDragPoly.isWalkway) {
            startLatLngs = activeDragPoly.getLatLngs().map(pt => L.latLng(pt.lat, pt.lng));
        } else if (activeDragPoly instanceof L.Polygon) {
            startLatLngs = activeDragPoly.getLatLngs()[0].map(pt => L.latLng(pt.lat, pt.lng));
        } else {
            startLatLngs = activeDragPoly.getLatLngs().map(pt => L.latLng(pt.lat, pt.lng));
        }
        if (activeDragPoly.isSubstation && activeDragPoly.substationCenter) {
            startSubstationCenter = L.latLng(activeDragPoly.substationCenter.lat, activeDragPoly.substationCenter.lng);
        }
        return true;
    };

    polygon.startPolyDragHandler = startPolyDrag;

    const doPolyDrag = (currentMouseLatLng) => {
        if (!isDraggingPoly || !startMouseLatLng || !startLatLngs) return;
        const dLat = currentMouseLatLng.lat - startMouseLatLng.lat;
        const dLng = currentMouseLatLng.lng - startMouseLatLng.lng;

        let newLatLngs = startLatLngs.map(pt => L.latLng(pt.lat + dLat, pt.lng + dLng));

        // Snap to site boundary edges / corners if applicable
        if (activeDragPoly !== customSiteBoundary) {
            const snap = snapPolygonToSiteBoundary(newLatLngs);
            if (snap) {
                newLatLngs = newLatLngs.map(pt => L.latLng(pt.lat + snap.dLat, pt.lng + snap.dLng));
                updateSnapMarkerVisual({ latlng: snap.snapLatLng, type: snap.type });
            } else {
                updateSnapMarkerVisual(null);
            }
        }

        if (activeDragPoly instanceof L.Polygon) {
            activeDragPoly.setLatLngs([newLatLngs]);
        } else {
            activeDragPoly.setLatLngs(newLatLngs);
        }

        if (activePolygonVertexMarkers && activePolygonVertexMarkers.length === newLatLngs.length) {
            newLatLngs.forEach((pt, i) => {
                activePolygonVertexMarkers[i].setLatLng(pt);
            });
        }
        if (activePolygonCenterMarker) {
            const newCenter = getPolygonCenter(activeDragPoly);
            activePolygonCenterMarker.setLatLng(newCenter);
        }

        if (selectedEdgeHighlightLine && activeSelectedPolygon === activeDragPoly && activeSelectedEdgeIndex !== -1) {
            const p1 = newLatLngs[activeSelectedEdgeIndex];
            const p2 = newLatLngs[(activeSelectedEdgeIndex + 1) % newLatLngs.length];
            selectedEdgeHighlightLine.setLatLngs([p1, p2]);
        }

        if (activeDragPoly.isSubstation && startSubstationCenter) {
            activeDragPoly.substationCenter = L.latLng(
                startSubstationCenter.lat + dLat,
                startSubstationCenter.lng + dLng
            );
        }

        if (activeDragPoly === customSiteBoundary) {
            updateSiteCenterFromBoundary(customSiteBoundary);
        }
    };

    const endPolyDrag = () => {
        if (isDraggingPoly) {
            isDraggingPoly = false;
            updateSnapMarkerVisual(null);
            map.dragging.enable();
            if (map && map.getContainer()) {
                map.getContainer().style.cursor = '';
            }
            if (activeDragPoly === customSiteBoundary) {
                inferParametersFromSiteBoundary(customSiteBoundary);
            } else {
                calculateOutputs();
                updateAllVisuals(true);
            }
        }
    };

    polygon.on('mousedown', (e) => {
        const isModifier = e.originalEvent && (e.originalEvent.ctrlKey || e.originalEvent.metaKey);
        if (startPolyDrag(e.latlng, isModifier)) {
            L.DomEvent.stopPropagation(e);
        }
    });

    map.on('mousemove', (e) => {
        if (isDraggingPoly) {
            doPolyDrag(e.latlng);
        }
    });

    map.on('mouseup', endPolyDrag);
    polygon.on('mouseup', endPolyDrag);

    // Support touch interactions & double-tap to duplicate on mobile
    setTimeout(() => {
        const polyPath = polygon._path || (polygon.getElement ? polygon.getElement() : null);
        if (polyPath) {
            L.DomEvent.on(polyPath, 'touchstart', (e) => {
                if (e.touches && e.touches.length === 1) {
                    const touch = e.touches[0];
                    const touchLatLng = map.mouseEventToLatLng(touch);
                    
                    // Double Tap detection on mobile / touch devices
                    const now = Date.now();
                    if (polygon._lastTapTime && (now - polygon._lastTapTime < 350)) {
                        if (polygon !== customSiteBoundary) {
                            const offsetLat = 0.00004;
                            const offsetLng = 0.00004;
                            const cloned = duplicatePolygon(polygon, offsetLat, offsetLng);
                            if (cloned) {
                                triggerPolygonCloneEffect(cloned, "✨ 已複製多邊形 (連點二次)");
                                activeSelectedPolygon = cloned;
                                showPolygonToolboxPanel(cloned);
                                calculateOutputs();
                                updateAllVisuals(true);
                            }
                            polygon._lastTapTime = 0;
                            L.DomEvent.stopPropagation(e);
                            if (e.cancelable) L.DomEvent.preventDefault(e);
                            return;
                        }
                    }
                    polygon._lastTapTime = now;

                    if (startPolyDrag(touchLatLng, false)) {
                        L.DomEvent.stopPropagation(e);
                        if (e.cancelable) L.DomEvent.preventDefault(e);
                    }
                }
            });
        }
    }, 100);

    const mapContainer = map.getContainer();
    if (mapContainer && !mapContainer._polyTouchBound) {
        mapContainer._polyTouchBound = true;
        L.DomEvent.on(mapContainer, 'touchmove', (e) => {
            if (isDraggingPoly && e.touches && e.touches.length === 1) {
                const touch = e.touches[0];
                const touchLatLng = map.mouseEventToLatLng(touch);
                doPolyDrag(touchLatLng);
                if (e.cancelable) L.DomEvent.preventDefault(e);
            }
        });
        L.DomEvent.on(mapContainer, 'touchend', () => {
            if (isDraggingPoly) endPolyDrag();
        });
        L.DomEvent.on(mapContainer, 'touchcancel', () => {
            if (isDraggingPoly) endPolyDrag();
        });
    }
}

function exitNormalMode() {
    isNormalMode = false;
    const btn = document.getElementById('btn-view-normal');
    if (btn) btn.classList.remove('active');
    if (renderer && renderer.domElement) {
        renderer.domElement.style.cursor = 'default';
    }
}

function toggleNormalMode() {
    if (isNormalMode) {
        exitNormalMode();
    } else {
        exitMeasureMode(); // Disable measure mode
        clearExclusionDrawingState();
        exitExclusionDrawMode();
        isNormalMode = true;
        const btn = document.getElementById('btn-view-normal');
        if (btn) btn.classList.add('active');
        if (renderer && renderer.domElement) {
            renderer.domElement.style.cursor = 'crosshair'; // Change cursor to crosshair for face selection
        }
    }
}

function initMaterials() {
    // Solar Panel top face (dark blue crystal silicon)
    materials.panelFace = new THREE.MeshStandardMaterial({
        color: 0x0a1c36,
        roughness: 0.85,
        metalness: 0.05,
        polygonOffset: true,
        polygonOffsetFactor: -2.0,
        polygonOffsetUnits: -2.0,
        shadowSide: THREE.BackSide
    });
    
    materials.panelFace.customProgramCacheKey = function () {
        return 'panelFaceShaderKey_v6';
    };
    
    materials.panelFace.onBeforeCompile = function (shader) {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <dithering_fragment>',
            `#include <dithering_fragment>
            #if NUM_DIR_LIGHT_SHADOWS > 0
                vec4 shadowCoord = vDirectionalShadowCoord[ 0 ];
                float shadowVal = getShadow( directionalShadowMap[ 0 ], directionalLightShadows[ 0 ].shadowMapSize, directionalLightShadows[ 0 ].shadowBias, directionalLightShadows[ 0 ].shadowRadius, shadowCoord );
                
                #if NUM_DIR_LIGHTS > 0
                    vec3 lightDir = directionalLights[ 0 ].direction;
                    float dotNL = dot( normalize( vNormal ), lightDir );
                #else
                    float dotNL = 1.0;
                #endif
                
                if ( shadowVal < 0.60 && dotNL > 0.05 ) {
                    float shadowRatio = clamp((0.60 - shadowVal) / 0.60, 0.0, 1.0);
                    // Shaded area gets clear red warning tint
                    vec3 shadeRed = vec3(0.95, 0.08, 0.08);
                    // Distinct bright red line along the shadow boundary
                    float edgeLine = smoothstep(0.10, 0.60, shadowVal) * smoothstep(0.80, 0.30, shadowVal) * 3.5;
                    vec3 edgeColor = vec3(1.0, 0.20, 0.20);
                    
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, shadeRed, shadowRatio * 0.80);
                    gl_FragColor.rgb = mix(gl_FragColor.rgb, edgeColor, clamp(edgeLine, 0.0, 0.95));
                }
            #endif`
        );
    };
    
    materials.frame = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Light silver anodized aluminum frame
        roughness: 0.60,
        metalness: 0.30
    });
    
    // Hot-dip galvanized steel texture for steel racking beams and legs (light silver metallic)
    materials.rack = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0, // Bright galvanized silver
        roughness: 0.60,
        metalness: 0.30
    });
    
    // Bright anodized aluminum for rails
    materials.aluminum = new THREE.MeshStandardMaterial({
        color: 0xf8fafc, // Extra bright aluminum silver
        roughness: 0.55,
        metalness: 0.30
    });
    
    materials.concrete = new THREE.MeshStandardMaterial({
        color: 0x475569, // Darker concrete gray color
        roughness: 0.8,
        metalness: 0.05,
        side: THREE.DoubleSide
    });
    
    materials.roofTile = new THREE.MeshStandardMaterial({
        color: 0xf5ebc6, // Warm beige color
        transparent: false,
        opacity: 1.0, // Opaque
        roughness: 0.7,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
    
    materials.building = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9, // Warm off-white paint for building exterior wall
        roughness: 0.65,
        metalness: 0.1,
        side: THREE.DoubleSide
    });
}

function robustEarClipping(pts, signedArea) {
    const n = pts.length;
    if (n < 3) return [];
    if (n === 3) return [[0, 1, 2]];

    const isCCW = signedArea > 0;
    const indices = [];
    for (let i = 0; i < n; i++) indices.push(i);

    const isPointInTriangle = (p, a, b, c) => {
        const areaABC = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
        const areaPBC = (b.x - p.x) * (c.z - p.z) - (b.z - p.z) * (c.x - p.x);
        const areaAPC = (p.x - a.x) * (c.z - a.z) - (p.z - a.z) * (c.x - a.x);
        const areaABP = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
        
        if (Math.abs(areaABC) < 1e-10) return false;
        
        const s = areaPBC / areaABC;
        const t = areaAPC / areaABC;
        const u = areaABP / areaABC;
        
        return s >= -1e-6 && t >= -1e-6 && u >= -1e-6 && Math.abs(s + t + u - 1.0) < 1e-5;
    };

    const isConvex = (a, b, c) => {
        const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
        return isCCW ? cross > 1e-9 : cross < -1e-9;
    };

    const faces = [];
    let count = indices.length;
    let stop = 2 * count * count; // Prevent infinite loop
    let idx = 0;

    while (indices.length > 3 && stop > 0) {
        stop--;
        const len = indices.length;
        const prevIdx = indices[(idx - 1 + len) % len];
        const currIdx = indices[idx % len];
        const nextIdx = indices[(idx + 1) % len];

        const pPrev = pts[prevIdx];
        const pCurr = pts[currIdx];
        const pNext = pts[nextIdx];

        if (isConvex(pPrev, pCurr, pNext)) {
            // Check if any other vertex is inside this triangle
            let isEar = true;
            for (let i = 0; i < len; i++) {
                const vi = indices[i];
                if (vi === prevIdx || vi === currIdx || vi === nextIdx) continue;
                if (isPointInTriangle(pts[vi], pPrev, pCurr, pNext)) {
                    isEar = false;
                    break;
                }
            }

            if (isEar) {
                faces.push([prevIdx, currIdx, nextIdx]);
                indices.splice(idx % len, 1);
                idx = (idx - 1 + indices.length) % indices.length;
                continue;
            }
        }
        idx = (idx + 1) % indices.length;
    }

    if (indices.length === 3) {
        faces.push([indices[0], indices[1], indices[2]]);
    }

    return faces;
}

function createObstacle3DGeometry(latlngs, extrudeHeight, isOnRoof, siteType, roofH, azimuthDeg, getRoofYFunc) {
    if (!latlngs || latlngs.length < 3) return null;

    // 1. Clean and deduplicate polygon vertices
    const cleanPts = [];
    for (let i = 0; i < latlngs.length; i++) {
        const pt = latlngs[i];
        const dy = (pt.lat - state.lat) * 111320;
        const dx = (pt.lng - state.lng) * 111320 * Math.cos((state.lat * Math.PI) / 180);
        const newP = { x: dx, z: -dy }; // world X is East (dx), world Z is South (-dy)
        if (cleanPts.length === 0) {
            cleanPts.push(newP);
        } else {
            const prev = cleanPts[cleanPts.length - 1];
            const distSq = (newP.x - prev.x) ** 2 + (newP.z - prev.z) ** 2;
            if (distSq > 1e-6) {
                cleanPts.push(newP);
            }
        }
    }
    // Remove closing point if equal to start point
    if (cleanPts.length > 1) {
        const first = cleanPts[0];
        const last = cleanPts[cleanPts.length - 1];
        if ((first.x - last.x) ** 2 + (first.z - last.z) ** 2 < 1e-6) {
            cleanPts.pop();
        }
    }

    let n = cleanPts.length;
    if (n < 3) return null;

    // 2. Compute signed area in X-Z plane
    let signedArea = 0;
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        signedArea += (cleanPts[i].x * cleanPts[next].z - cleanPts[next].x * cleanPts[i].z);
    }
    signedArea *= 0.5;

    // Standardize to CCW in X-Z space (signedArea > 0)
    let points2D = cleanPts;
    if (signedArea < 0) {
        points2D = cleanPts.slice().reverse();
        signedArea = -signedArea;
    }

    const thetaRad = (-azimuthDeg * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);

    // 3. Compute elevation for each 2D point
    const baseElevations = [];
    for (let i = 0; i < n; i++) {
        const pt = points2D[i];
        let baseH = 0;
        if (siteType !== 'ground' && isOnRoof) {
            const rx = pt.x;
            const ry = -pt.z; // North
            const localZ = rx * sinTheta - ry * cosTheta;
            let y_roof = 0;
            if (siteType === 'roof-slope' && getRoofYFunc) {
                y_roof = getRoofYFunc(localZ);
            }
            baseH = roofH + y_roof;
        }
        baseElevations.push(baseH);
    }

    // 4. Robust 2D Triangulation for complex/concave polygons
    let faces2D = [];

    // Method A: THREE.Earcut
    if (typeof THREE !== 'undefined' && THREE.Earcut && typeof THREE.Earcut.triangulate === 'function') {
        const flatCoords = [];
        for (let i = 0; i < n; i++) {
            flatCoords.push(points2D[i].x, points2D[i].z);
        }
        const indices = THREE.Earcut.triangulate(flatCoords, null, 2);
        if (indices && indices.length >= 3) {
            for (let i = 0; i < indices.length; i += 3) {
                faces2D.push([indices[i], indices[i + 1], indices[i + 2]]);
            }
        }
    }

    // Method B: THREE.ShapeUtils.triangulateShape
    if ((!faces2D || faces2D.length === 0) && THREE.ShapeUtils && THREE.ShapeUtils.triangulateShape) {
        const shapePoints = points2D.map(p => new THREE.Vector2(p.x, p.z));
        try {
            const result = THREE.ShapeUtils.triangulateShape(shapePoints, []);
            if (result && result.length > 0) {
                faces2D = result;
            }
        } catch (e) {
            console.warn("ShapeUtils triangulation failed:", e);
        }
    }

    // Method C: Robust Ear Clipping Algorithm (Never cuts across concave indents)
    if (!faces2D || faces2D.length === 0) {
        faces2D = robustEarClipping(points2D, signedArea);
    }

    if (!faces2D || faces2D.length === 0) return null;

    const positions = [];

    // 5. Bottom Cap (Facing down: p0 -> p1 -> p2)
    for (let f = 0; f < faces2D.length; f++) {
        const tri = faces2D[f];
        const i0 = tri[0], i1 = tri[1], i2 = tri[2];
        const p0 = points2D[i0], p1 = points2D[i1], p2 = points2D[i2];
        positions.push(p0.x, baseElevations[i0], p0.z);
        positions.push(p1.x, baseElevations[i1], p1.z);
        positions.push(p2.x, baseElevations[i2], p2.z);
    }

    // 6. Top Cap (Facing up: p0 -> p2 -> p1)
    for (let f = 0; f < faces2D.length; f++) {
        const tri = faces2D[f];
        const i0 = tri[0], i1 = tri[1], i2 = tri[2];
        const p0 = points2D[i0], p1 = points2D[i1], p2 = points2D[i2];
        positions.push(p0.x, baseElevations[i0] + extrudeHeight, p0.z);
        positions.push(p2.x, baseElevations[i2] + extrudeHeight, p2.z);
        positions.push(p1.x, baseElevations[i1] + extrudeHeight, p1.z);
    }

    // 7. Side Walls (Connecting each edge CCW: outward normal)
    for (let i = 0; i < n; i++) {
        const next = (i + 1) % n;
        const pA = points2D[i];
        const pB = points2D[next];
        const bA = baseElevations[i];
        const bB = baseElevations[next];
        const tA = bA + extrudeHeight;
        const tB = bB + extrudeHeight;

        // Triangle 1: bA -> bB -> tB
        positions.push(pA.x, bA, pA.z);
        positions.push(pB.x, bB, pB.z);
        positions.push(pB.x, tB, pB.z);

        // Triangle 2: bA -> tB -> tA
        positions.push(pA.x, bA, pA.z);
        positions.push(pB.x, tB, pB.z);
        positions.push(pA.x, tA, pA.z);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geom.computeVertexNormals();
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    return geom;
}

function clipPolygonByZ(points, zCut, isLessOrEqual) {
    const out = [];
    const n = points.length;
    if (n < 3) return out;
    
    for (let i = 0; i < n; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const in1 = isLessOrEqual ? (p1.z <= zCut + 0.0001) : (p1.z >= zCut - 0.0001);
        const in2 = isLessOrEqual ? (p2.z <= zCut + 0.0001) : (p2.z >= zCut - 0.0001);
        
        if (in1) {
            out.push(p1);
        }
        if (in1 !== in2) {
            const dz = p2.z - p1.z;
            if (Math.abs(dz) > 1e-6) {
                const t = (zCut - p1.z) / dz;
                const interX = p1.x + t * (p2.x - p1.x);
                out.push({ x: interX, z: zCut });
            }
        }
    }
    return out;
}

function updateViewer(params) {
    if (!scene) return;
    
    // Clear measurement tape markup when scene is rebuilt with new parameters
    exitMeasureMode();
    
    const loader = document.getElementById('viewer-loading');
    if (loader) {
        loader.classList.add('active');
        setTimeout(() => loader.classList.remove('active'), 250);
    }
    
    while (pvGroup.children.length > 0) {
        const obj = pvGroup.children[0];
        pvGroup.remove(obj);
        obj.traverse(child => {
            if (child.geometry) child.geometry.dispose();
        });
    }
    if (roofPlane) {
        scene.remove(roofPlane);
        if (roofPlane.geometry) roofPlane.geometry.dispose();
        roofPlane = null;
    }
    
    const siteType = params.siteType;
    const supportH = (params.supportH !== undefined ? params.supportH : 1500) / 1000; // support high point (m)
    const pitchStyle = params.pitchStyle || 'single';
    const arrM = siteType === 'roof-slope' ? 1 : (params.arrM !== undefined ? params.arrM : 1);
    const arrP = (params.arrP !== undefined ? params.arrP : 5.0);
    
    // Determine 3D dimensions based on placement selection
    // isPortrait means length direction tilts, width direction stays horizontal
    const isPortrait = params.pvOrient === 'portrait';
    const pvL = (isPortrait ? params.pvW : params.pvL) / 1000;
    const pvW = (isPortrait ? params.pvL : params.pvW) / 1000;
    
    const arrI = params.arrI;
    const arrJ = params.arrJ;
    const spX = params.spX / 1000;
    const spY = params.spY / 1000;
    
    const tilt = params.tilt; // Installation tilt relative to horizontal
    const roofTilt = params.roofTilt || 0; // Roof tilt relative to horizontal
    const totalTilt = tilt; // Total tilt relative to horizontal is exactly tilt
    
    const tiltRad = (tilt * Math.PI) / 180;
    const roofTiltRad = (roofTilt * Math.PI) / 180;
    const totalTiltRad = (totalTilt * Math.PI) / 180;
    const azimuthRad = (params.azimuth * Math.PI) / 180;
    
    const isSpecialRoofSlopeFlatLandscape = 
        siteType === 'roof-slope' && 
        Math.abs(tilt - roofTilt) < 0.01 && 
        params.pvOrient === 'landscape';

    let totalSpX = 0;
    for (let c = 1; c < arrI; c++) {
        totalSpX += (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 0.75 : spX;
    }
    let arrayWidth = arrI * pvL + totalSpX;
    
    let totalSpY = 0;
    for (let r = 1; r < arrJ; r++) {
        totalSpY += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
    }
    
    // Determine block size and zOffset
    let arrayLength = 0;
    let zOffset = 0;
    let halfLen = 0;
    let numNeg = 0;
    let numPos = 0;
    let isSouthSlopeZNeg = false;
    let s_outer_neg = 0;
    let s_outer_pos = 0;
    
    const ridgeSp = (siteType === 'roof-slope') ? 1.2 : 0.2; // 1.2m for slope roof, 0.2m for ground/flat roof
    
    const isDoublePitch = (pitchStyle === 'double' || pitchStyle === 'double-v');
    
    if (isDoublePitch) {
        isSouthSlopeZNeg = (Math.cos(azimuthRad) <= 0);
        const numSouth = (arrJ % 2 !== 0) ? (arrJ + 1) / 2 : arrJ / 2;
        const numNorth = arrJ - numSouth;
        numNeg = isSouthSlopeZNeg ? numSouth : numNorth;
        numPos = isSouthSlopeZNeg ? numNorth : numSouth;
        
        let totalSpY_neg = 0;
        for (let r = 1; r < numNeg; r++) {
            totalSpY_neg += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
        }
        let totalSpY_pos = 0;
        for (let r = 1; r < numPos; r++) {
            totalSpY_pos += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
        }
        
        s_outer_neg = (numNeg > 0) ? -(ridgeSp / 2 + numNeg * pvW + totalSpY_neg) : (ridgeSp / 2);
        s_outer_pos = (numPos > 0) ? +(ridgeSp / 2 + numPos * pvW + totalSpY_pos) : -(ridgeSp / 2);
        arrayLength = s_outer_pos - s_outer_neg;
        zOffset = (s_outer_pos + s_outer_neg) / 2 * Math.cos(totalTiltRad);
        halfLen = (arrayLength * Math.cos(totalTiltRad)) / 2;
    } else {
        arrayLength = arrJ * pvW + totalSpY;
        zOffset = 0;
        halfLen = (arrayLength * Math.cos(totalTiltRad)) / 2;
    }
    
    // Overrides for actual shifted bounds
    let xCenterOffset = 0;
    let zCenterOffset = 0;
    
    const layoutCoords = getShiftedLayoutCoords(params);
    let minX_actual = Infinity;
    let maxX_actual = -Infinity;
    let minZ_actual = Infinity;
    let maxZ_actual = -Infinity;
    
    let neg_max_s = -Infinity;
    let pos_max_s = -Infinity;
    
    if (isDoublePitch) {
        // Find the innermost rows (closest to ridge) for blockZ = 0
        let max_rowZ_neg = -Infinity;
        let min_rowZ_pos = Infinity;
        
        const center_g = Math.floor((arrM - 1) / 2);
        const center_blockZ = (center_g - (arrM - 1) / 2) * arrP;
        
        for (let r = 0; r < numNeg; r++) {
            for (let c = 0; c < arrI; c++) {
                const coord = layoutCoords[center_g]?.['neg']?.[r]?.[c];
                if (coord) {
                    max_rowZ_neg = Math.max(max_rowZ_neg, coord.rowZ);
                }
            }
        }
        for (let r = 0; r < numPos; r++) {
            for (let c = 0; c < arrI; c++) {
                const coord = layoutCoords[center_g]?.['pos']?.[r]?.[c];
                if (coord) {
                    min_rowZ_pos = Math.min(min_rowZ_pos, coord.rowZ);
                }
            }
        }
        
        if (max_rowZ_neg !== -Infinity && min_rowZ_pos !== Infinity) {
            zOffset = center_blockZ - (max_rowZ_neg + min_rowZ_pos) / 2;
        } else if (max_rowZ_neg !== -Infinity) {
            zOffset = center_blockZ - (max_rowZ_neg + (ridgeSp / 2 + pvW / 2) * Math.cos(totalTiltRad));
        } else if (min_rowZ_pos !== Infinity) {
            zOffset = center_blockZ - (min_rowZ_pos - (ridgeSp / 2 + pvW / 2) * Math.cos(totalTiltRad));
        }
        
        // Calculate neg_max_s and pos_max_s relative to this actual zOffset
        for (let g = 0; g < arrM; g++) {
            const blockZ = (g - (arrM - 1) / 2) * arrP;
            for (let r = 0; r < numNeg; r++) {
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['neg']?.[r]?.[c];
                    if (coord) {
                        minX_actual = Math.min(minX_actual, coord.localX);
                        maxX_actual = Math.max(maxX_actual, coord.localX);
                        minZ_actual = Math.min(minZ_actual, coord.rowZ - blockZ);
                        maxZ_actual = Math.max(maxZ_actual, coord.rowZ - blockZ);
                        
                        const s_actual = (coord.rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                        neg_max_s = Math.max(neg_max_s, Math.abs(s_actual));
                    }
                }
            }
            for (let r = 0; r < numPos; r++) {
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['pos']?.[r]?.[c];
                    if (coord) {
                        minX_actual = Math.min(minX_actual, coord.localX);
                        maxX_actual = Math.max(maxX_actual, coord.localX);
                        minZ_actual = Math.min(minZ_actual, coord.rowZ - blockZ);
                        maxZ_actual = Math.max(maxZ_actual, coord.rowZ - blockZ);
                        
                        const s_actual = (coord.rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                        pos_max_s = Math.max(pos_max_s, s_actual);
                    }
                }
            }
        }
    } else {
        for (let g = 0; g < arrM; g++) {
            const blockZ = (g - (arrM - 1) / 2) * arrP;
            for (let r = 0; r < arrJ; r++) {
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['single']?.[r]?.[c];
                    if (coord) {
                        minX_actual = Math.min(minX_actual, coord.localX);
                        maxX_actual = Math.max(maxX_actual, coord.localX);
                        minZ_actual = Math.min(minZ_actual, coord.rowZ - blockZ);
                        maxZ_actual = Math.max(maxZ_actual, coord.rowZ - blockZ);
                    }
                }
            }
        }
    }
    
    if (minX_actual !== Infinity && maxX_actual !== -Infinity) {
        arrayWidth = (maxX_actual - minX_actual) + pvL;
        xCenterOffset = (minX_actual + maxX_actual) / 2;
    }
    
    if (minZ_actual !== Infinity && maxZ_actual !== -Infinity) {
        if (isDoublePitch) {
            if (neg_max_s !== -Infinity) {
                s_outer_neg = -neg_max_s - pvW / 2;
            }
            if (pos_max_s !== -Infinity) {
                s_outer_pos = pos_max_s + pvW / 2;
            }
            arrayLength = s_outer_pos - s_outer_neg;
            halfLen = (arrayLength * Math.cos(totalTiltRad)) / 2;
        } else {
            arrayLength = (maxZ_actual - minZ_actual) / Math.cos(totalTiltRad) + pvW;
            halfLen = (arrayLength * Math.cos(totalTiltRad)) / 2;
            zOffset = 0;
            zCenterOffset = (minZ_actual + maxZ_actual) / 2;
        }
    }
    
    const systemLength = (arrM - 1) * arrP + 2 * halfLen;
    
    // Effective support height for slope roof (force 0.2m when parallel to roof, otherwise use supportH)
    const isFlatLaid = (siteType === 'roof-slope' && Math.abs(tilt - roofTilt) < 0.01);
    const effSupportH = isFlatLaid ? 0.2 : supportH;
    
    // ------------------------------------------
    // 1. Calculate Boundary Bounds and Roof Profile
    // ------------------------------------------
    let minZ_bound = Infinity;
    let maxZ_bound = -Infinity;
    if (customSiteBoundary) {
        const latlngs = getOuterRingLatLngs(customSiteBoundary);
        if (latlngs && latlngs.length >= 3) {
            for (let i = 0; i < latlngs.length; i++) {
                const localPt = latLngToLocal(latlngs[i], state.lat, state.lng, params.azimuth);
                minZ_bound = Math.min(minZ_bound, localPt.z);
                maxZ_bound = Math.max(maxZ_bound, localPt.z);
            }
        }
    }

    const len_neg = Math.abs(s_outer_neg);
    const L_neg_ext = len_neg + 1.0;
    const len_pos = s_outer_pos;
    const L_pos_ext = len_pos + 1.0;

    let z_ridge = -zOffset;
    let Y_ridge = L_neg_ext * Math.tan(roofTiltRad);

    if (customSiteBoundary && minZ_bound !== Infinity && maxZ_bound !== -Infinity) {
        z_ridge = (minZ_bound + maxZ_bound) / 2;
        const halfRoofLenZ = (maxZ_bound - minZ_bound) / 2;
        Y_ridge = halfRoofLenZ * Math.tan(roofTiltRad);
    }

    const z_front = (minZ_bound !== Infinity) ? minZ_bound : (zCenterOffset - halfLen - 1.0);
    const z_back = (maxZ_bound !== -Infinity) ? maxZ_bound : (zCenterOffset + halfLen + 1.0);
    const L_ext = Math.max(0.1, (z_back - z_front) / (Math.cos(roofTiltRad) || 1));
    const Y_high = (z_back - z_front) * Math.tan(roofTiltRad);

    const getRoofY = (zVal) => {
        if (siteType !== 'roof-slope') return 0;
        if (pitchStyle === 'double') {
            return Math.max(0, Y_ridge - Math.abs(zVal - z_ridge) * Math.tan(roofTiltRad));
        } else if (pitchStyle === 'double-v') {
            return Math.max(0, Math.abs(zVal - z_ridge) * Math.tan(roofTiltRad));
        } else {
            return Math.max(0, (zVal - z_front) * Math.tan(roofTiltRad));
        }
    };

    // ------------------------------------------
    // 2. Create Roof Plane and Building Walls
    // ------------------------------------------
    const localGroup = new THREE.Group();
    
    if (customSiteBoundary) {
        const latlngs = getOuterRingLatLngs(customSiteBoundary);
        if (latlngs && latlngs.length >= 3) {
            let localPoints = [];
            for (let i = 0; i < latlngs.length; i++) {
                const localPt = latLngToLocal(latlngs[i], state.lat, state.lng, params.azimuth);
                localPoints.push({ x: localPt.x, z: localPt.z });
            }

            if (siteType === 'roof-slope' || siteType === 'roof-flat') {
                const ExtrudeGeoClass = THREE.ExtrudeBufferGeometry || THREE.ExtrudeGeometry;

                const adjustExtrudeVertices = (geo, yAdjustFunc) => {
                    if (geo.attributes && geo.attributes.position) {
                        const posAttr = geo.attributes.position;
                        for (let i = 0; i < posAttr.count; i++) {
                            const x = posAttr.getX(i);
                            const y = posAttr.getY(i);
                            const z = posAttr.getZ(i);
                            const newY = yAdjustFunc(x, y, z);
                            if (newY !== null && newY !== undefined) {
                                posAttr.setY(i, newY);
                            }
                        }
                        posAttr.needsUpdate = true;
                        geo.computeVertexNormals();
                    } else if (geo.vertices) {
                        for (let i = 0; i < geo.vertices.length; i++) {
                            const v = geo.vertices[i];
                            const newY = yAdjustFunc(v.x, v.y, v.z);
                            if (newY !== null && newY !== undefined) {
                                v.y = newY;
                            }
                        }
                        geo.verticesNeedUpdate = true;
                        geo.computeFaceNormals();
                        geo.computeVertexNormals();
                    }
                };

                const extrudeSettings = {
                    depth: 0.15,
                    bevelEnabled: false
                };

                roofPlane = new THREE.Group();

                if (siteType === 'roof-slope' && isDoublePitch) {
                    const polyNeg = clipPolygonByZ(localPoints, z_ridge, true);
                    const polyPos = clipPolygonByZ(localPoints, z_ridge, false);

                    [polyNeg, polyPos].forEach(poly => {
                        if (poly && poly.length >= 3) {
                            const subShape = new THREE.Shape();
                            subShape.moveTo(poly[0].x, -poly[0].z);
                            for (let i = 1; i < poly.length; i++) {
                                subShape.lineTo(poly[i].x, -poly[i].z);
                            }
                            subShape.closePath();

                            const slabGeo = new ExtrudeGeoClass(subShape, extrudeSettings);
                            slabGeo.rotateX(-Math.PI / 2);
                            slabGeo.translate(0, -0.15, 0);

                            adjustExtrudeVertices(slabGeo, (x, y, z) => {
                                const y_roof = getRoofY(z);
                                return (y > -0.075) ? y_roof : (y_roof - 0.15);
                            });

                            const subMesh = new THREE.Mesh(slabGeo, materials.roofTile);
                            subMesh.receiveShadow = true;
                            subMesh.castShadow = true;
                            roofPlane.add(subMesh);
                        }
                    });
                } else {
                    const shape = new THREE.Shape();
                    shape.moveTo(localPoints[0].x, -localPoints[0].z);
                    for (let i = 1; i < localPoints.length; i++) {
                        shape.lineTo(localPoints[i].x, -localPoints[i].z);
                    }
                    shape.closePath();

                    const slabGeo = new ExtrudeGeoClass(shape, extrudeSettings);
                    slabGeo.rotateX(-Math.PI / 2);
                    slabGeo.translate(0, -0.15, 0);

                    adjustExtrudeVertices(slabGeo, (x, y, z) => {
                        let y_roof = 0;
                        if (siteType === 'roof-slope') {
                            y_roof = getRoofY(z);
                        }
                        return (y > -0.075) ? y_roof : (y_roof - 0.15);
                    });

                    const mesh = new THREE.Mesh(slabGeo, (siteType === 'roof-flat') ? materials.concrete : materials.roofTile);
                    mesh.receiveShadow = true;
                    mesh.castShadow = true;
                    roofPlane.add(mesh);
                }

                localGroup.add(roofPlane);

                // 2. Create Building Body walls under the roof matching boundary shape
                const roofH = params.roofH || 0;
                if (roofH > 0.05) {
                    const maxRoofH = isDoublePitch ? Y_ridge : Y_high;
                    const extrudeH = roofH + maxRoofH + 2.0;

                    if (siteType === 'roof-slope' && isDoublePitch) {
                        const polyNeg = clipPolygonByZ(localPoints, z_ridge, true);
                        const polyPos = clipPolygonByZ(localPoints, z_ridge, false);

                        [polyNeg, polyPos].forEach(poly => {
                            if (poly && poly.length >= 3) {
                                const shape = new THREE.Shape();
                                shape.moveTo(poly[0].x, -poly[0].z);
                                for (let i = 1; i < poly.length; i++) {
                                    shape.lineTo(poly[i].x, -poly[i].z);
                                }
                                shape.closePath();

                                const buildingGeo = new ExtrudeGeoClass(shape, { depth: extrudeH, bevelEnabled: false });
                                buildingGeo.rotateX(-Math.PI / 2);

                                adjustExtrudeVertices(buildingGeo, (x, y, z) => {
                                    const y_roof = getRoofY(z);
                                    if (y > 0.001) {
                                        return Math.max(roofH + y_roof, 0.1);
                                    }
                                    return 0;
                                });

                                const buildingMesh = new THREE.Mesh(buildingGeo, materials.building);
                                buildingMesh.position.y = -roofH;
                                buildingMesh.castShadow = true;
                                buildingMesh.receiveShadow = true;
                                localGroup.add(buildingMesh);
                            }
                        });
                    } else {
                        const shape = new THREE.Shape();
                        shape.moveTo(localPoints[0].x, -localPoints[0].z);
                        for (let i = 1; i < localPoints.length; i++) {
                            shape.lineTo(localPoints[i].x, -localPoints[i].z);
                        }
                        shape.closePath();

                        const buildingGeo = new ExtrudeGeoClass(shape, { depth: extrudeH, bevelEnabled: false });
                        buildingGeo.rotateX(-Math.PI / 2);

                        adjustExtrudeVertices(buildingGeo, (x, y, z) => {
                            let y_roof = 0;
                            if (siteType === 'roof-slope') {
                                y_roof = getRoofY(z);
                            }
                            if (y > 0.001) {
                                return Math.max(roofH + y_roof, 0.1);
                            }
                            return 0;
                        });

                        const buildingMesh = new THREE.Mesh(buildingGeo, materials.building);
                        buildingMesh.position.y = -roofH;
                        buildingMesh.castShadow = true;
                        buildingMesh.receiveShadow = true;
                        localGroup.add(buildingMesh);
                    }
                }
            } else if (siteType === 'ground') {
                // Draw bright blue boundary outline on the grass ground in 3D
                const points = [];
                for (let i = 0; i < latlngs.length; i++) {
                    const localPt = latLngToLocal(latlngs[i], state.lat, state.lng, params.azimuth);
                    points.push(new THREE.Vector3(localPt.x, 0.02, localPt.z));
                }
                const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                const lineMat = new THREE.LineBasicMaterial({
                    color: 0x00d2ff, // Bright blue
                    linewidth: 3
                });
                const boundaryLine = new THREE.LineLoop(lineGeo, lineMat);
                localGroup.add(boundaryLine);
            }
        }
    } else {
        if (siteType === 'roof-slope') {
            if (isDoublePitch) {
                roofPlane = new THREE.Group();
                const isDoubleV = (pitchStyle === 'double-v');
                
                // Negative slope roof plane
                const roofGeoNeg = new THREE.BoxGeometry(arrayWidth + 3, 0.15, L_neg_ext);
                const roofMeshNeg = new THREE.Mesh(roofGeoNeg, materials.roofTile);
                roofMeshNeg.receiveShadow = true;
                roofMeshNeg.castShadow = true;
                roofMeshNeg.rotation.x = isDoubleV ? +roofTiltRad : -roofTiltRad;
                
                const dyOffsetNeg = -0.075 * Math.cos(roofTiltRad);
                const dzOffsetNeg = 0.075 * Math.sin(roofTiltRad);
                const yNegPos = isDoubleV
                    ? (L_neg_ext / 2) * Math.sin(roofTiltRad) + dyOffsetNeg
                    : Y_ridge - (L_neg_ext / 2) * Math.sin(roofTiltRad) + dyOffsetNeg;
                roofMeshNeg.position.set(
                    xCenterOffset,
                    yNegPos,
                    z_ridge - (L_neg_ext / 2) * Math.cos(roofTiltRad) + dzOffsetNeg
                );
                roofPlane.add(roofMeshNeg);
                
                // Positive slope roof plane
                const roofGeoPos = new THREE.BoxGeometry(arrayWidth + 3, 0.15, L_pos_ext);
                const roofMeshPos = new THREE.Mesh(roofGeoPos, materials.roofTile);
                roofMeshPos.receiveShadow = true;
                roofMeshPos.castShadow = true;
                roofMeshPos.rotation.x = isDoubleV ? -roofTiltRad : +roofTiltRad;
                
                const dyOffsetPos = -0.075 * Math.cos(roofTiltRad);
                const dzOffsetPos = -0.075 * Math.sin(roofTiltRad);
                const yPosPos = isDoubleV
                    ? (L_pos_ext / 2) * Math.sin(roofTiltRad) + dyOffsetPos
                    : Y_ridge - (L_pos_ext / 2) * Math.sin(roofTiltRad) + dyOffsetPos;
                roofMeshPos.position.set(
                    xCenterOffset,
                    yPosPos,
                    z_ridge + (L_pos_ext / 2) * Math.cos(roofTiltRad) + dzOffsetPos
                );
                roofPlane.add(roofMeshPos);
                
                localGroup.add(roofPlane);
            } else {
                // Single Slope Roof Plane: Slopes down from z_back towards z_front
                const roofGeo = new THREE.BoxGeometry(arrayWidth + 3, 0.15, L_ext);
                roofPlane = new THREE.Mesh(roofGeo, materials.roofTile);
                roofPlane.receiveShadow = true;
                roofPlane.castShadow = true;
                
                roofPlane.rotation.x = -roofTiltRad;
                const dyOffset = -0.075 * Math.cos(roofTiltRad);
                const dzOffset = 0.075 * Math.sin(roofTiltRad);
                roofPlane.position.set(
                    xCenterOffset,
                    Y_high / 2 + dyOffset,
                    (z_front + z_back) / 2 + dzOffset
                );
                
                localGroup.add(roofPlane);
            }
            
            // Render building body walls under the slope roof
            const roofH = params.roofH || 0;
            if (roofH > 0.05) {
                const shape = new THREE.Shape();
                if (isDoublePitch) {
                    const zFront = z_ridge - L_neg_ext * Math.cos(roofTiltRad);
                    const zBack = z_ridge + L_pos_ext * Math.cos(roofTiltRad);
                    const Y_front = getRoofY(zFront);
                    const Y_back = getRoofY(zBack);
                    const Y_center = (pitchStyle === 'double-v') ? 0 : Y_ridge;
                    
                    shape.moveTo(zFront, -roofH);
                    shape.lineTo(zBack, -roofH);
                    shape.lineTo(zBack, Y_back);
                    shape.lineTo(z_ridge, Y_center);
                    shape.lineTo(zFront, Y_front);
                } else {
                    const zFront = z_front;
                    const zBack = z_back;
                    const yFrontSlope = getRoofY(zFront);
                    const yBackSlope = getRoofY(zBack);
                    
                    shape.moveTo(zFront, -roofH);
                    shape.lineTo(zBack, -roofH);
                    shape.lineTo(zBack, yBackSlope);
                    shape.lineTo(zFront, yFrontSlope);
                }
                const W = arrayWidth + 3.0;
                const extrudeSettings = {
                    depth: W,
                    bevelEnabled: false
                };
                const ExtrudeGeoClass = THREE.ExtrudeBufferGeometry || THREE.ExtrudeGeometry;
                const buildingGeo = new ExtrudeGeoClass(shape, extrudeSettings);
                
                if (buildingGeo.attributes && buildingGeo.attributes.position) {
                    const pos = buildingGeo.attributes.position;
                    for (let i = 0; i < pos.count; i++) {
                        const origZ_world = pos.getX(i);
                        const origY_world = pos.getY(i);
                        const origX_ext = pos.getZ(i);
                        pos.setXYZ(i, origX_ext - W / 2 + xCenterOffset, origY_world, origZ_world);
                    }
                    pos.needsUpdate = true;
                    buildingGeo.computeVertexNormals();
                } else if (buildingGeo.vertices) {
                    for (let i = 0; i < buildingGeo.vertices.length; i++) {
                        const v = buildingGeo.vertices[i];
                        const origZ_world = v.x;
                        const origY_world = v.y;
                        const origX_ext = v.z;
                        v.x = origX_ext - W / 2 + xCenterOffset;
                        v.y = origY_world;
                        v.z = origZ_world;
                    }
                    buildingGeo.verticesNeedUpdate = true;
                    buildingGeo.computeFaceNormals();
                    buildingGeo.computeVertexNormals();
                }
                
                const buildingMesh = new THREE.Mesh(buildingGeo, materials.building);
                buildingMesh.castShadow = true;
                buildingMesh.receiveShadow = true;
                localGroup.add(buildingMesh);
            }
        } else if (siteType === 'roof-flat') {
            // Flat roof concrete slab at local y = 0
            const roofGeo = new THREE.BoxGeometry(arrayWidth + 3, 0.15, systemLength + 3);
            roofPlane = new THREE.Mesh(roofGeo, materials.concrete);
            roofPlane.receiveShadow = true;
            roofPlane.castShadow = true;
            
            roofPlane.position.set(xCenterOffset, -0.075, zCenterOffset);
            localGroup.add(roofPlane);
            
            // Render building body walls under the flat roof
            const roofH = params.roofH || 0;
            if (roofH > 0.05) {
                const buildingGeo = new THREE.BoxGeometry(arrayWidth + 3, roofH, systemLength + 3);
                const buildingMesh = new THREE.Mesh(buildingGeo, materials.building);
                buildingMesh.castShadow = true;
                buildingMesh.receiveShadow = true;
                buildingMesh.position.set(xCenterOffset, -roofH / 2, zCenterOffset);
                localGroup.add(buildingMesh);
            }
        }
    }
    
    // ------------------------------------------
    // 3. Compute High Point Heights & Clearance
    // ------------------------------------------
    let ridgeY = supportH;
    let singleHighY = supportH;
    let doubleVHighY = supportH;
    
    if (siteType === 'roof-slope') {
        if (pitchStyle === 'double') {
            if (isFlatLaid) {
                // 平鋪時: 模組底面離屋脊 200mm (0.2m)
                ridgeY = Y_ridge + 0.20;
            } else {
                // 架高時: 19 的支架高度 (supportH) 為最高點 (屋脊) 支架高度
                const nominalRidgeY = Y_ridge + supportH;
                
                const s_leg_neg = (numNeg > 0) ? s_outer_neg * 0.8 : -ridgeSp / 2;
                const z_leg_neg = s_leg_neg * Math.cos(totalTiltRad) - zOffset;
                const clearance_neg = (nominalRidgeY - Math.abs(s_leg_neg) * Math.sin(totalTiltRad)) - getRoofY(z_leg_neg);
                
                const s_leg_pos = (numPos > 0) ? s_outer_pos * 0.8 : ridgeSp / 2;
                const z_leg_pos = s_leg_pos * Math.cos(totalTiltRad) - zOffset;
                const clearance_pos = (nominalRidgeY - s_leg_pos * Math.sin(totalTiltRad)) - getRoofY(z_leg_pos);
                
                const minClearance = Math.min(clearance_neg, supportH, clearance_pos);
                const lift = (minClearance < 0.1) ? (0.1 - minClearance) : 0;
                ridgeY = nominalRidgeY + lift;
            }
        } else if (pitchStyle === 'double-v') {
            // 雙斜V: 最高點在兩側屋簷 (s_outer_neg / s_outer_pos)
            const s_max = Math.max(Math.abs(s_outer_neg), s_outer_pos);
            const y_roof_eave = s_max * Math.tan(roofTiltRad);
            if (isFlatLaid) {
                doubleVHighY = y_roof_eave + 0.20;
            } else {
                // 支架高度一樣都定義最高點
                const nominalHighY = y_roof_eave + supportH;
                const centerModY = nominalHighY - s_max * Math.sin(totalTiltRad);
                const centerClearance = centerModY - 0; // roof valley is at Y=0
                const lift = (centerClearance < 0.1) ? (0.1 - centerClearance) : 0;
                doubleVHighY = nominalHighY + lift;
            }
        } else {
            // 單斜: 最高點在後端 (z_back_arr)
            const z_back_arr = zCenterOffset + halfLen * Math.cos(totalTiltRad);
            const z_front_arr = zCenterOffset - halfLen * Math.cos(totalTiltRad);
            const y_roof_back = getRoofY(z_back_arr);
            const y_roof_front = getRoofY(z_front_arr);
            
            if (isFlatLaid) {
                // 平鋪時: 模組底面離屋面固定 200mm (0.2m)
                singleHighY = y_roof_back + 0.20;
            } else {
                // 架高時: 19 的支架高度 (supportH) 為最高點 (後端) 支架高度
                const nominalHighY = y_roof_back + supportH;
                const mod_front_Y = nominalHighY - 2 * halfLen * Math.sin(totalTiltRad);
                const clearance_front = mod_front_Y - y_roof_front;
                const lift = (clearance_front < 0.1) ? (0.1 - clearance_front) : 0;
                singleHighY = nominalHighY + lift;
            }
        }
    }
    
    // ------------------------------------------
    // 4. Create Solar Panels (Optimized with InstancedMesh)
    // ------------------------------------------
    const panelOffset = (siteType === 'roof-slope') ? 0.0 : (0.075 + 0.20);
    const panelsToDraw = [];
    
    for (let g = 0; g < arrM; g++) {
        const blockZ = (g - (arrM - 1) / 2) * arrP;
        
        if (pitchStyle === 'double') {
            // Z-negative rows
            for (let r = 0; r < numNeg; r++) {
                const rotX = -totalTiltRad;
                
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['neg']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                    const localX = coord.localX;
                    const rowZ = coord.rowZ;
                    if (!isModuleExcluded(localX, rowZ, params)) {
                        let rowY = 0;
                        if (siteType === 'roof-slope') {
                            if (isFlatLaid) {
                                rowY = getRoofY(rowZ) + 0.20;
                            } else {
                                const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                                rowY = ridgeY - Math.abs(s_actual) * Math.sin(totalTiltRad);
                            }
                        } else {
                            const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                            rowY = supportH - Math.abs(s_actual) * Math.sin(totalTiltRad);
                        }
                        const panelY = rowY + 0.015 + panelOffset;
                        panelsToDraw.push({ x: localX, y: panelY, z: rowZ, rotX });
                    }
                }
            }
            
            // Z-positive rows
            for (let r = 0; r < numPos; r++) {
                const rotX = +totalTiltRad;
                
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['pos']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                    const localX = coord.localX;
                    const rowZ = coord.rowZ;
                    if (!isModuleExcluded(localX, rowZ, params)) {
                        let rowY = 0;
                        if (siteType === 'roof-slope') {
                            if (isFlatLaid) {
                                rowY = getRoofY(rowZ) + 0.20;
                            } else {
                                const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                                rowY = ridgeY - s_actual * Math.sin(totalTiltRad);
                            }
                        } else {
                            const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                            rowY = supportH - s_actual * Math.sin(totalTiltRad);
                        }
                        const panelY = rowY + 0.015 + panelOffset;
                        panelsToDraw.push({ x: localX, y: panelY, z: rowZ, rotX });
                    }
                }
            }
        } else if (pitchStyle === 'double-v') {
            // Double Pitch V (雙斜V): slopes down towards the center valley!
            const s_max_neg = Math.abs(s_outer_neg);
            const s_max_pos = s_outer_pos;
            const highY_neg = (siteType === 'roof-slope') ? doubleVHighY : supportH;
            const highY_pos = (siteType === 'roof-slope') ? doubleVHighY : supportH;
            
            for (let r = 0; r < numNeg; r++) {
                const rotX = +totalTiltRad;
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['neg']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                    const localX = coord.localX;
                    const rowZ = coord.rowZ;
                    if (!isModuleExcluded(localX, rowZ, params)) {
                        let rowY = 0;
                        if (siteType === 'roof-slope' && isFlatLaid) {
                            rowY = getRoofY(rowZ) + 0.20;
                        } else {
                            const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                            rowY = highY_neg - (s_max_neg - Math.abs(s_actual)) * Math.sin(totalTiltRad);
                        }
                        const panelY = rowY + 0.015 + panelOffset;
                        panelsToDraw.push({ x: localX, y: panelY, z: rowZ, rotX });
                    }
                }
            }
            
            for (let r = 0; r < numPos; r++) {
                const rotX = -totalTiltRad;
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['pos']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                    const localX = coord.localX;
                    const rowZ = coord.rowZ;
                    if (!isModuleExcluded(localX, rowZ, params)) {
                        let rowY = 0;
                        if (siteType === 'roof-slope' && isFlatLaid) {
                            rowY = getRoofY(rowZ) + 0.20;
                        } else {
                            const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
                            rowY = highY_pos - (s_max_pos - s_actual) * Math.sin(totalTiltRad);
                        }
                        const panelY = rowY + 0.015 + panelOffset;
                        panelsToDraw.push({ x: localX, y: panelY, z: rowZ, rotX });
                    }
                }
            }
        } else {
            // Single Pitch
            for (let r = 0; r < arrJ; r++) {
                const rotX = -totalTiltRad;
                
                for (let c = 0; c < arrI; c++) {
                    const coord = layoutCoords[g]?.['single']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                    const localX = coord.localX;
                    const rowZ = coord.rowZ;
                    if (!isModuleExcluded(localX, rowZ, params)) {
                        let rowY = 0;
                        if (siteType === 'roof-slope' && isFlatLaid) {
                            rowY = getRoofY(rowZ) + 0.20;
                        } else if (siteType === 'roof-slope') {
                            const localZ_actual = (rowZ - blockZ) / Math.cos(totalTiltRad);
                            rowY = singleHighY - (halfLen - localZ_actual) * Math.sin(totalTiltRad);
                        } else {
                            const localZ_actual = (rowZ - blockZ) / Math.cos(totalTiltRad);
                            rowY = supportH - (halfLen - localZ_actual) * Math.sin(totalTiltRad);
                        }
                        const panelY = rowY + 0.015 + panelOffset;
                        panelsToDraw.push({ x: localX, y: panelY, z: rowZ, rotX });
                    }
                }
            }
        }
    }
    
    if (panelsToDraw.length > 0) {
        // Reuse geometry to avoid memory allocations in render loop
        const frameGeo = new THREE.BoxGeometry(pvL, 0.03, pvW);
        const cellsGeo = new THREE.BoxGeometry(pvL - 0.02, 0.002, pvW - 0.02);
        
        const instancedFrame = new THREE.InstancedMesh(frameGeo, materials.frame, panelsToDraw.length);
        const instancedCells = new THREE.InstancedMesh(cellsGeo, materials.panelFace, panelsToDraw.length);
        
        instancedFrame.castShadow = false;
        instancedFrame.receiveShadow = true;
        instancedCells.castShadow = true;
        instancedCells.receiveShadow = true;
        
        const matrixFrame = new THREE.Matrix4();
        const matrixCells = new THREE.Matrix4();
        
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const quaternion = new THREE.Quaternion();
        const scale = new THREE.Vector3(1, 1, 1);
        
        panelsToDraw.forEach((panel, idx) => {
            // Frame matrix
            position.set(panel.x, panel.y, panel.z);
            rotation.set(panel.rotX, 0, 0);
            quaternion.setFromEuler(rotation);
            matrixFrame.compose(position, quaternion, scale);
            instancedFrame.setMatrixAt(idx, matrixFrame);
            
            // Cells matrix (aligned with frame, elevated by 15.1mm to sit on top surface of frame without 3D volume Z-fighting)
            const dy = 0.0151;
            const offsetZ = dy * Math.sin(panel.rotX);
            const offsetY = dy * Math.cos(panel.rotX);
            
            position.set(panel.x, panel.y + offsetY, panel.z + offsetZ);
            matrixCells.compose(position, quaternion, scale);
            instancedCells.setMatrixAt(idx, matrixCells);
        });
        
        localGroup.add(instancedFrame);
        localGroup.add(instancedCells);
    }
    
    // ------------------------------------------
    // 5. Create Racking, Legs & Foundations (Optimized with InstancedMesh)
    // ------------------------------------------
    const xPositions = [];
    const startX = xCenterOffset - arrayWidth / 2 + pvL / 2;
    const endX = xCenterOffset + arrayWidth / 2 - pvL / 2;
    
    let curX = startX;
    xPositions.push(curX);
    
    while (curX + 4.0 <= endX + 0.001) {
        curX += 4.0;
        xPositions.push(curX);
    }
    
    const lastPlacedX = xPositions[xPositions.length - 1];
    const rightOverhang = (xCenterOffset + arrayWidth / 2) - lastPlacedX;
    if (rightOverhang > 1.5 && (endX - lastPlacedX) > 0.01) {
        xPositions.push(endX);
    }
    
    if (xPositions.length === 1 && (endX - startX > 0.5)) {
        xPositions.push(endX);
    }
    
    const rackBoxes = [];
    const concreteBoxes = [];
    const aluminumBoxes = [];
    const aluminumFeet = [];
    
    // Support pruning filter helpers (prune supports with no active panels above them)
    const hasPanelNear = (x, z, radX = 2.2, radZ = 2.0) => {
        if (!panelsToDraw || panelsToDraw.length === 0) return false;
        for (let i = 0; i < panelsToDraw.length; i++) {
            const p = panelsToDraw[i];
            if (Math.abs(p.x - x) <= radX && Math.abs(p.z - z) <= radZ) {
                return true;
            }
        }
        return false;
    };
    
    const hasPanelInSpan = (x, zCenter, halfSpanZ, radX = 2.2) => {
        if (!panelsToDraw || panelsToDraw.length === 0) return false;
        const zMin = zCenter - halfSpanZ - 0.4;
        const zMax = zCenter + halfSpanZ + 0.4;
        for (let i = 0; i < panelsToDraw.length; i++) {
            const p = panelsToDraw[i];
            if (Math.abs(p.x - x) <= radX && p.z >= zMin && p.z <= zMax) {
                return true;
            }
        }
        return false;
    };
    
    const xBayRad = Math.max(pvL / 2 + 0.3, 2.2);

    if (siteType === 'roof-slope') {
        if (isFlatLaid) {
            // 平鋪時: 模組底面離屋面 200mm，每片模組底下 2支鋁支架，分配在離兩邊各自 1/5L (1/5 PV長度) 的位置
            const pvLength = params.pvL / 1000;
            const pvWidth = params.pvW / 1000;
            const isPortrait = params.pvOrient === 'portrait';
            
            panelsToDraw.forEach(panel => {
                const bottomY = panel.y - 0.015;
                
                if (!isPortrait) {
                    // Landscape: PV 長度 L 在 X 軸方向，寬度 W 沿斜坡 Z 軸方向
                    const offsetL = 0.3 * pvLength; // 離兩邊各 1/5L => 距離中心 0.3L
                    const x1 = panel.x - offsetL;
                    const x2 = panel.x + offsetL;
                    
                    [x1, x2].forEach(xRail => {
                        aluminumBoxes.push({
                            pos: [xRail, bottomY - 0.02, panel.z],
                            rot: [panel.rotX, 0, 0],
                            scale: [0.04, 0.04, pvWidth]
                        });
                        
                        // L-feet 固定件 (前端與後端各一個)
                        const offsetW = 0.3 * pvWidth;
                        [-offsetW, offsetW].forEach(dz => {
                            const zFoot = panel.z + dz * Math.cos(panel.rotX);
                            const yRailBottom = (bottomY - 0.04) - dz * Math.sin(panel.rotX);
                            const yRoofFoot = getRoofY(zFoot);
                            const hFoot = yRailBottom - yRoofFoot;
                            if (hFoot > 0.005) {
                                aluminumFeet.push({
                                    pos: [xRail, yRoofFoot + hFoot / 2, zFoot],
                                    rot: [0, 0, 0],
                                    scale: [0.03, hFoot, 0.03]
                                });
                            }
                        });
                    });
                } else {
                    // Portrait: PV 長度 L 沿斜坡 Z 軸方向，寬度 W 在 X 軸方向
                    const offsetL = 0.3 * pvLength; // 沿斜坡方向離兩邊各 1/5L
                    [-offsetL, offsetL].forEach(ds => {
                        const zRail = panel.z + ds * Math.cos(panel.rotX);
                        const yRail = (bottomY - 0.02) - ds * Math.sin(panel.rotX);
                        
                        aluminumBoxes.push({
                            pos: [panel.x, yRail, zRail],
                            rot: [panel.rotX, 0, 0],
                            scale: [pvWidth, 0.04, 0.04]
                        });
                        
                        // L-feet 固定件 (左端與右端各一個)
                        const offsetW = 0.3 * pvWidth;
                        [-offsetW, offsetW].forEach(dx => {
                            const xFoot = panel.x + dx;
                            const yRailBottom = yRail - 0.02;
                            const yRoofFoot = getRoofY(zRail);
                            const hFoot = yRailBottom - yRoofFoot;
                            if (hFoot > 0.005) {
                                aluminumFeet.push({
                                    pos: [xFoot, yRoofFoot + hFoot / 2, zRail],
                                    rot: [0, 0, 0],
                                    scale: [0.03, hFoot, 0.03]
                                });
                            }
                        });
                    });
                }
            });
        } else {
            // 架高時 (Elevated): 19 的支架高度 (supportH) 代表最高點支架高度
            if (pitchStyle === 'double' || pitchStyle === 'double-v') {
                const isDoubleV = (pitchStyle === 'double-v');
                const local_s_outer_neg = s_outer_neg;
                const local_s_outer_pos = s_outer_pos;
                const highY_neg = isDoubleV ? doubleVHighY : ridgeY;
                const highY_pos = isDoubleV ? doubleVHighY : ridgeY;
                const s_max_neg = Math.abs(local_s_outer_neg);
                const s_max_pos = local_s_outer_pos;
                
                for (let k = 0; k < xPositions.length; k++) {
                    const xRack = xPositions[k];
                    for (let g = 0; g < arrM; g++) {
                        const blockZ = (g - (arrM - 1) / 2) * arrP;
                        
                        // Z-negative rail
                        const len_neg = Math.abs(local_s_outer_neg);
                        if (len_neg > 0.05) {
                            const s_center = local_s_outer_neg / 2;
                            const railY = isDoubleV
                                ? (highY_neg - (s_max_neg - Math.abs(s_center)) * Math.sin(totalTiltRad) - 0.025)
                                : (ridgeY - Math.abs(s_center) * Math.sin(totalTiltRad) - 0.025);
                            const railZ = s_center * Math.cos(totalTiltRad) - zOffset + blockZ;
                            if (hasPanelInSpan(xRack, railZ, len_neg / 2, xBayRad)) {
                                aluminumBoxes.push({
                                    pos: [xRack, railY, railZ],
                                    rot: [isDoubleV ? +totalTiltRad : -totalTiltRad, 0, 0],
                                    scale: [0.05, 0.05, len_neg]
                                });
                            }
                        }
                        
                        // Z-positive rail
                        const len_pos = local_s_outer_pos;
                        if (len_pos > 0.05) {
                            const s_center = local_s_outer_pos / 2;
                            const railY = isDoubleV
                                ? (highY_pos - (s_max_pos - s_center) * Math.sin(totalTiltRad) - 0.025)
                                : (ridgeY - s_center * Math.sin(totalTiltRad) - 0.025);
                            const railZ = s_center * Math.cos(totalTiltRad) - zOffset + blockZ;
                            if (hasPanelInSpan(xRack, railZ, len_pos / 2, xBayRad)) {
                                aluminumBoxes.push({
                                    pos: [xRack, railY, railZ],
                                    rot: [isDoubleV ? -totalTiltRad : +totalTiltRad, 0, 0],
                                    scale: [0.05, 0.05, len_pos]
                                });
                            }
                        }
                        
                        const s_leg_neg = (numNeg > 0) ? s_outer_neg * 0.8 : -ridgeSp / 2;
                        const s_leg_pos = (numPos > 0) ? s_outer_pos * 0.8 : ridgeSp / 2;
                        
                        const legZ_neg = s_leg_neg * Math.cos(totalTiltRad) - zOffset + blockZ;
                        const legZ_pos = s_leg_pos * Math.cos(totalTiltRad) - zOffset + blockZ;
                        const legZ_center = -zOffset + blockZ;
                        
                        const y_roof_neg = getRoofY(legZ_neg);
                        const y_roof_pos = getRoofY(legZ_pos);
                        const y_roof_center = getRoofY(legZ_center);
                        
                        let hFoot_neg = 0, hFoot_center = 0, hFoot_pos = 0;
                        if (isDoubleV) {
                            hFoot_neg = (highY_neg - (s_max_neg - Math.abs(s_leg_neg)) * Math.sin(totalTiltRad) - 0.05) - y_roof_neg;
                            hFoot_center = (highY_neg - s_max_neg * Math.sin(totalTiltRad) - 0.05) - y_roof_center;
                            hFoot_pos = (highY_pos - (s_max_pos - s_leg_pos) * Math.sin(totalTiltRad) - 0.05) - y_roof_pos;
                        } else {
                            hFoot_neg = (ridgeY - Math.abs(s_leg_neg) * Math.sin(totalTiltRad) - 0.05) - y_roof_neg;
                            hFoot_center = (ridgeY - 0.05) - y_roof_center;
                            hFoot_pos = (ridgeY - Math.abs(s_leg_pos) * Math.sin(totalTiltRad) - 0.05) - y_roof_pos;
                        }
                        
                        const feet = [
                            { z: legZ_neg, h: hFoot_neg, y_base: y_roof_neg },
                            { z: legZ_center, h: hFoot_center, y_base: y_roof_center },
                            { z: legZ_pos, h: hFoot_pos, y_base: y_roof_pos }
                        ];
                        
                        feet.forEach(f => {
                            if (f.h > 0.005 && hasPanelNear(xRack, f.z, xBayRad, 2.0)) {
                                aluminumFeet.push({
                                    pos: [xRack, f.y_base + f.h / 2, f.z],
                                    rot: [0, 0, 0],
                                    scale: [0.03, f.h, 0.03]
                                });
                            }
                        });
                    }
                }
            } else {
                // Single-pitch elevated racking
                for (let k = 0; k < xPositions.length; k++) {
                    const xRack = xPositions[k];
                    for (let g = 0; g < arrM; g++) {
                        const blockZ = (g - (arrM - 1) / 2) * arrP;
                        const railCenterY = singleHighY - halfLen * Math.sin(totalTiltRad) - 0.025;
                        const railCenterZ = zCenterOffset + blockZ;
                        
                        if (hasPanelInSpan(xRack, railCenterZ, arrayLength / 2, xBayRad)) {
                            aluminumBoxes.push({
                                pos: [xRack, railCenterY, railCenterZ],
                                rot: [-totalTiltRad, 0, 0],
                                scale: [0.05, 0.05, arrayLength]
                            });
                        }
                        
                        const hasMiddleLeg = arrayLength > 8.0;
                        const shiftDist = arrayLength / (hasMiddleLeg ? 8 : 5);
                        const legFrontZ_local = -halfLen + shiftDist;
                        const legBackZ_local = halfLen - shiftDist;
                        const legMiddleZ_local = 0.0;
                        
                        const legFrontZ = zCenterOffset + legFrontZ_local * Math.cos(totalTiltRad) + blockZ;
                        const legBackZ = zCenterOffset + legBackZ_local * Math.cos(totalTiltRad) + blockZ;
                        const legMiddleZ = zCenterOffset + legMiddleZ_local * Math.cos(totalTiltRad) + blockZ;
                        
                        const legY_front = singleHighY - (halfLen - legFrontZ_local) * Math.sin(totalTiltRad) - 0.05;
                        const legY_back = singleHighY - (halfLen - legBackZ_local) * Math.sin(totalTiltRad) - 0.05;
                        const legY_middle = singleHighY - (halfLen - legMiddleZ_local) * Math.sin(totalTiltRad) - 0.05;
                        
                        const feet = [
                            { z: legFrontZ, y: legY_front },
                            { z: legBackZ, y: legY_back }
                        ];
                        if (hasMiddleLeg) {
                            feet.push({ z: legMiddleZ, y: legY_middle });
                        }
                        
                        const legRadZ = Math.max(arrayLength / 6, 1.8);
                        feet.forEach(f => {
                            const yRoof = getRoofY(f.z);
                            const hFoot = f.y - yRoof;
                            if (hFoot > 0.005 && hasPanelNear(xRack, f.z, xBayRad, legRadZ)) {
                                aluminumFeet.push({
                                    pos: [xRack, yRoof + hFoot / 2, f.z],
                                    rot: [0, 0, 0],
                                    scale: [0.03, hFoot, 0.03]
                                });
                            }
                        });
                    }
                }
            }
        }
    } else {
        // Ground mount and Flat roof racking
        for (let k = 0; k < xPositions.length; k++) {
            const xRack = xPositions[k];
            
            for (let g = 0; g < arrM; g++) {
                const blockZ = (g - (arrM - 1) / 2) * arrP;
                
                if (pitchStyle === 'double' || pitchStyle === 'double-v') {
                    const isDoubleV = (pitchStyle === 'double-v');
                    const ridgeY_ground = supportH;
                    const local_s_outer_neg = s_outer_neg;
                    const local_s_outer_pos = s_outer_pos;
                    const s_max_neg = Math.abs(local_s_outer_neg);
                    const s_max_pos = local_s_outer_pos;
                    
                    // Z-negative racking beam
                    const len_neg = Math.abs(local_s_outer_neg);
                    if (len_neg > 0.05) {
                        const s_center = local_s_outer_neg / 2;
                        const beamY = isDoubleV
                            ? (ridgeY_ground - (s_max_neg - Math.abs(s_center)) * Math.sin(totalTiltRad))
                            : (ridgeY_ground - Math.abs(s_center) * Math.sin(totalTiltRad));
                        const beamZ = s_center * Math.cos(totalTiltRad) - zOffset + blockZ;
                        if (hasPanelInSpan(xRack, beamZ, len_neg / 2, xBayRad)) {
                            rackBoxes.push({
                                pos: [xRack, beamY, beamZ],
                                rot: [isDoubleV ? +totalTiltRad : -totalTiltRad, 0, 0],
                                scale: [0.15, 0.15, len_neg]
                            });
                        }
                    }
                    
                    // Z-positive racking beam
                    const len_pos = local_s_outer_pos;
                    if (len_pos > 0.05) {
                        const s_center = local_s_outer_pos / 2;
                        const beamY = isDoubleV
                            ? (ridgeY_ground - (s_max_pos - s_center) * Math.sin(totalTiltRad))
                            : (ridgeY_ground - s_center * Math.sin(totalTiltRad));
                        const beamZ = s_center * Math.cos(totalTiltRad) - zOffset + blockZ;
                        if (hasPanelInSpan(xRack, beamZ, len_pos / 2, xBayRad)) {
                            rackBoxes.push({
                                pos: [xRack, beamY, beamZ],
                                rot: [isDoubleV ? -totalTiltRad : +totalTiltRad, 0, 0],
                                scale: [0.15, 0.15, len_pos]
                            });
                        }
                    }
                    
                    // Legs
                    const s_leg_neg = (numNeg > 0) ? s_outer_neg * 0.8 : -ridgeSp / 2;
                    const s_leg_pos = (numPos > 0) ? s_outer_pos * 0.8 : ridgeSp / 2;
                    
                    const legZ_neg = s_leg_neg * Math.cos(totalTiltRad) - zOffset + blockZ;
                    const legZ_pos = s_leg_pos * Math.cos(totalTiltRad) - zOffset + blockZ;
                    const legZ_center = -zOffset + blockZ;
                    
                    let legY_neg = 0, legY_center = 0, legY_pos = 0;
                    if (isDoubleV) {
                        legY_neg = ridgeY_ground - (s_max_neg - Math.abs(s_leg_neg)) * Math.sin(totalTiltRad);
                        legY_center = ridgeY_ground - s_max_neg * Math.sin(totalTiltRad);
                        legY_pos = ridgeY_ground - (s_max_pos - s_leg_pos) * Math.sin(totalTiltRad);
                    } else {
                        legY_neg = ridgeY_ground - Math.abs(s_leg_neg) * Math.sin(totalTiltRad);
                        legY_center = ridgeY_ground;
                        legY_pos = ridgeY_ground - s_leg_pos * Math.sin(totalTiltRad);
                    }
                    
                    const legHeights = [
                        { z: legZ_neg, h: legY_neg - 0.075 },
                        { z: legZ_center, h: ridgeY_ground - 0.075 },
                        { z: legZ_pos, h: legY_pos - 0.075 }
                    ];
                    
                    legHeights.forEach(lh => {
                        const hLeg = lh.h;
                        if (hasPanelNear(xRack, lh.z, xBayRad, 2.2)) {
                            if (siteType === 'ground') {
                                concreteBoxes.push({
                                    pos: [xRack, 0.2, lh.z],
                                    rot: [0, 0, 0],
                                    scale: [0.35, 0.4, 0.35]
                                });
                                
                                const colH = hLeg - 0.4;
                                if (colH > 0.05) {
                                    rackBoxes.push({
                                        pos: [xRack, 0.4 + colH / 2, lh.z],
                                        rot: [0, 0, 0],
                                        scale: [0.15, colH, 0.15]
                                    });
                                }
                            } else {
                                if (hLeg > 0.05) {
                                    rackBoxes.push({
                                        pos: [xRack, hLeg / 2, lh.z],
                                        rot: [0, 0, 0],
                                        scale: [0.15, hLeg, 0.15]
                                    });
                                }
                            }
                        }
                    });
                } else {
                    // Single-pitch racking beam
                    const beamY = supportH - halfLen * Math.sin(totalTiltRad);
                    const beamZ = zCenterOffset + blockZ;
                    if (hasPanelInSpan(xRack, beamZ, arrayLength / 2, xBayRad)) {
                        rackBoxes.push({
                            pos: [xRack, beamY, beamZ],
                            rot: [-totalTiltRad, 0, 0],
                            scale: [0.15, 0.15, arrayLength]
                        });
                    }
                    
                    const hasMiddleLeg = arrayLength > 8.0;
                    const legShiftFactor = hasMiddleLeg ? 8 : 5;
                    const shiftDist = arrayLength / legShiftFactor;
                    
                    const legFrontZ_local = -halfLen + shiftDist;
                    const legBackZ_local = halfLen - shiftDist;
                    const legMiddleZ_local = 0.0;
                    
                    const legFrontZ = zCenterOffset + legFrontZ_local * Math.cos(totalTiltRad) + blockZ;
                    const legBackZ = zCenterOffset + legBackZ_local * Math.cos(totalTiltRad) + blockZ;
                    const legMiddleZ = zCenterOffset + legMiddleZ_local * Math.cos(totalTiltRad) + blockZ;
                    
                    const frontBeamCenterY = supportH - (halfLen - legFrontZ_local) * Math.sin(totalTiltRad);
                    const backBeamCenterY = supportH - (halfLen - legBackZ_local) * Math.sin(totalTiltRad);
                    const middleBeamCenterY = supportH - (halfLen - legMiddleZ_local) * Math.sin(totalTiltRad);
                    
                    const shiftedFrontBeamBottomY = frontBeamCenterY - 0.075;
                    const shiftedBackBeamBottomY = backBeamCenterY - 0.075;
                    const shiftedMiddleBeamBottomY = middleBeamCenterY - 0.075;
                    
                    const legRadZ = Math.max(arrayLength / (legShiftFactor * 1.4), 1.8);

                    if (siteType === 'ground') {
                        // Front Concrete Pier & Leg
                        if (hasPanelNear(xRack, legFrontZ, xBayRad, legRadZ)) {
                            concreteBoxes.push({
                                pos: [xRack, 0.2, legFrontZ],
                                rot: [0, 0, 0],
                                scale: [0.35, 0.4, 0.35]
                            });
                            
                            const frontLegH = shiftedFrontBeamBottomY - 0.4;
                            if (frontLegH > 0.05) {
                                rackBoxes.push({
                                    pos: [xRack, 0.4 + frontLegH / 2, legFrontZ],
                                    rot: [0, 0, 0],
                                    scale: [0.15, frontLegH, 0.15]
                                });
                            }
                        }
                        
                        // Middle Concrete Pier & Leg
                        if (hasMiddleLeg && hasPanelNear(xRack, legMiddleZ, xBayRad, legRadZ)) {
                            concreteBoxes.push({
                                pos: [xRack, 0.2, legMiddleZ],
                                rot: [0, 0, 0],
                                scale: [0.35, 0.4, 0.35]
                            });
                            
                            const middleLegH = shiftedMiddleBeamBottomY - 0.4;
                            if (middleLegH > 0.05) {
                                rackBoxes.push({
                                    pos: [xRack, 0.4 + middleLegH / 2, legMiddleZ],
                                    rot: [0, 0, 0],
                                    scale: [0.15, middleLegH, 0.15]
                                });
                            }
                        }
                        
                        // Back Concrete Pier & Leg
                        if (hasPanelNear(xRack, legBackZ, xBayRad, legRadZ)) {
                            concreteBoxes.push({
                                pos: [xRack, 0.2, legBackZ],
                                rot: [0, 0, 0],
                                scale: [0.35, 0.4, 0.35]
                            });
                            
                            const backLegH = shiftedBackBeamBottomY - 0.4;
                            if (backLegH > 0.05) {
                                rackBoxes.push({
                                    pos: [xRack, 0.4 + backLegH / 2, legBackZ],
                                    rot: [0, 0, 0],
                                    scale: [0.15, backLegH, 0.15]
                                });
                            }
                        }
                    } else {
                        // Flat Roof Mount: Direct Steel Leg Column to roof surface (y=0)
                        if (shiftedFrontBeamBottomY > 0.05 && hasPanelNear(xRack, legFrontZ, xBayRad, legRadZ)) {
                            rackBoxes.push({
                                pos: [xRack, shiftedFrontBeamBottomY / 2, legFrontZ],
                                rot: [0, 0, 0],
                                scale: [0.15, shiftedFrontBeamBottomY, 0.15]
                            });
                        }
                        if (hasMiddleLeg && shiftedMiddleBeamBottomY > 0.05 && hasPanelNear(xRack, legMiddleZ, xBayRad, legRadZ)) {
                            rackBoxes.push({
                                pos: [xRack, shiftedMiddleBeamBottomY / 2, legMiddleZ],
                                rot: [0, 0, 0],
                                scale: [0.15, shiftedMiddleBeamBottomY, 0.15]
                            });
                        }
                        if (shiftedBackBeamBottomY > 0.05 && hasPanelNear(xRack, legBackZ, xBayRad, legRadZ)) {
                            rackBoxes.push({
                                pos: [xRack, shiftedBackBeamBottomY / 2, legBackZ],
                                rot: [0, 0, 0],
                                scale: [0.15, shiftedBackBeamBottomY, 0.15]
                            });
                        }
                    }
                }
            }
        }
    }
    
    // Create InstancedMeshes for supportGroup (1 draw call per material)
    const supportGroup = new THREE.Group();
    supportGroup.name = "supportGroup";
    
    function buildInstancedMesh(instances, geometry, material, castShadow = true, receiveShadow = true) {
        if (!instances || instances.length === 0) return null;
        const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        
        const mat4 = new THREE.Matrix4();
        const pos = new THREE.Vector3();
        const rot = new THREE.Euler();
        const quat = new THREE.Quaternion();
        const sca = new THREE.Vector3();
        
        for (let i = 0; i < instances.length; i++) {
            const it = instances[i];
            pos.set(it.pos[0], it.pos[1], it.pos[2]);
            rot.set(it.rot ? it.rot[0] : 0, it.rot ? it.rot[1] : 0, it.rot ? it.rot[2] : 0);
            quat.setFromEuler(rot);
            sca.set(it.scale[0], it.scale[1], it.scale[2]);
            mat4.compose(pos, quat, sca);
            mesh.setMatrixAt(i, mat4);
        }
        mesh.instanceMatrix.needsUpdate = true;
        return mesh;
    }
    
    if (rackBoxes.length > 0) {
        const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
        const instancedRack = buildInstancedMesh(rackBoxes, unitBoxGeo, materials.rack, false, true);
        if (instancedRack) supportGroup.add(instancedRack);
    }
    if (concreteBoxes.length > 0) {
        const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
        const instancedConcrete = buildInstancedMesh(concreteBoxes, unitBoxGeo, materials.concrete, false, true);
        if (instancedConcrete) supportGroup.add(instancedConcrete);
    }
    if (aluminumBoxes.length > 0) {
        const unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);
        const instancedAluminum = buildInstancedMesh(aluminumBoxes, unitBoxGeo, materials.aluminum, false, true);
        if (instancedAluminum) supportGroup.add(instancedAluminum);
    }
    if (aluminumFeet.length > 0) {
        const unitCylGeo = new THREE.CylinderGeometry(1, 1, 1, 8);
        const instancedFeet = buildInstancedMesh(aluminumFeet, unitCylGeo, materials.aluminum, false, true);
        if (instancedFeet) supportGroup.add(instancedFeet);
    }
    
    const showSupports = params && params.showSupports !== undefined ? params.showSupports : state.showSupports;
    supportGroup.visible = (showSupports !== false);
    localGroup.add(supportGroup);
    
    // Rotate entire localGroup by Azimuth
    const targetYRotation = -azimuthRad;
    localGroup.rotation.y = targetYRotation;
    
    // Elevate localGroup by roof height (for flat roof and slope roof)
    const roofH = siteType === 'ground' ? 0.0 : (params.roofH || 0);
    localGroup.position.y = roofH;
    
    pvGroup.add(localGroup);
    
    // ------------------------------------------
    // 4. Create 3D Obstacles (Real-time rendered on keep & adjust)
    // ------------------------------------------
    if (obstacleGroup) {
        while (obstacleGroup.children.length > 0) {
            const obj = obstacleGroup.children[0];
            obstacleGroup.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
        }
        
        obstaclePolygons.forEach(poly => {
            const latlngs = getOuterRingLatLngs(poly) || [];
            if (latlngs.length < 3) return;
            
            const extrudeHeight = poly.obstacleHeight !== undefined ? poly.obstacleHeight : 5.0;
            const isOnRoof = (poly.isOnRoof !== undefined) ? poly.isOnRoof : true;
            
            const geom = createObstacle3DGeometry(
                latlngs,
                extrudeHeight,
                isOnRoof,
                siteType,
                roofH,
                params.azimuth || 180,
                getRoofY
            );
            if (!geom) return;
            
            // High-visibility obstacle red material (matching 2D map theme)
            const obsMat = new THREE.MeshStandardMaterial({
                color: 0xef4444, // Bright obstacle red
                roughness: 0.35,
                metalness: 0.1,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide
            });
            
            const mesh = new THREE.Mesh(geom, obsMat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.renderOrder = 2;
            
            // Enable physically accurate real-time shadow projection onto roof and PV panels
            mesh.customDepthMaterial = new THREE.MeshDepthMaterial({
                depthPacking: THREE.RGBADepthPacking,
                side: THREE.DoubleSide
            });
            
            // Add crisp structural outline edges
            const edgeGeo = new THREE.EdgesGeometry(geom);
            const edgeMat = new THREE.LineBasicMaterial({ color: 0x991b1b, linewidth: 2 });
            const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
            edgeLines.renderOrder = 3;
            mesh.add(edgeLines);
            
            obstacleGroup.add(mesh);
        });
    }

    drawActualModulesOnMap(panelsToDraw, pvL, pvW);
    
    // Position orbital camera target center on actual 3D bounding box center
    const bounds = getSceneBoundsInfo();
    if (controls) {
        controls.target.copy(bounds.center);
    }
    
    // Ensure sun position, shadow camera frustum, and lighting are completely synchronized with the array
    updateSunPosition(state.lat, state.lng, state.sunMonth, state.sunHour);
}

function drawActualModulesOnMap(panelsToDraw, pvL, pvW) {
    if (!actualModulesLayerGroup) return;
    actualModulesLayerGroup.clearLayers();
    
    if (!panelsToDraw || panelsToDraw.length === 0) return;
    
    const lat = state.lat;
    const lng = state.lng;
    const azimuth = state.azimuth;
    
    const thetaRad = (-azimuth * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    
    const metersPerLatDegree = 111320;
    const latRad = (lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const multiPolygonLatLngs = [];
    const halfL = pvL / 2;
    
    for (let i = 0; i < panelsToDraw.length; i++) {
        const panel = panelsToDraw[i];
        const tiltCos = Math.abs(Math.cos(panel.rotX || 0));
        const projW = pvW * tiltCos;
        const halfW = projW / 2;
        
        const px = panel.x;
        const pz = panel.z;
        
        const c1x = px - halfL, c1z = pz - halfW;
        const c2x = px + halfL, c2z = pz - halfW;
        const c3x = px + halfL, c3z = pz + halfW;
        const c4x = px - halfL, c4z = pz + halfW;
        
        multiPolygonLatLngs.push([
            [lat + (c1x * sinTheta - c1z * cosTheta) / metersPerLatDegree, lng + (c1x * cosTheta + c1z * sinTheta) / metersPerLngDegree],
            [lat + (c2x * sinTheta - c2z * cosTheta) / metersPerLatDegree, lng + (c2x * cosTheta + c2z * sinTheta) / metersPerLngDegree],
            [lat + (c3x * sinTheta - c3z * cosTheta) / metersPerLatDegree, lng + (c3x * cosTheta + c3z * sinTheta) / metersPerLngDegree],
            [lat + (c4x * sinTheta - c4z * cosTheta) / metersPerLatDegree, lng + (c4x * cosTheta + c4z * sinTheta) / metersPerLngDegree]
        ]);
    }
    
    L.polygon(multiPolygonLatLngs, {
        color: 'rgba(34, 197, 94, 0.2)',
        weight: 0.5,
        fillColor: 'rgba(34, 197, 94, 1)',
        fillOpacity: 0.35,
        interactive: false
    }).addTo(actualModulesLayerGroup);
}

function getSceneBoundsInfo() {
    const box = new THREE.Box3();
    
    if (pvGroup) {
        pvGroup.updateMatrixWorld(true);
        pvGroup.traverse(node => {
            if (!node.visible || node === snapIndicator || (node.name && node.name.startsWith('measure'))) return;
            
            if (node.isInstancedMesh && node.geometry) {
                const geom = node.geometry;
                if (!geom.boundingBox) geom.computeBoundingBox();
                const geoBox = geom.boundingBox;
                const count = node.count;
                const instanceMat = new THREE.Matrix4();
                const worldMat = new THREE.Matrix4();
                const nodeWorldMat = node.matrixWorld;
                const tmpBox = new THREE.Box3();
                
                for (let i = 0; i < count; i++) {
                    node.getMatrixAt(i, instanceMat);
                    worldMat.multiplyMatrices(nodeWorldMat, instanceMat);
                    tmpBox.copy(geoBox).applyMatrix4(worldMat);
                    box.union(tmpBox);
                }
            } else if (node.isMesh && node.geometry) {
                const geom = node.geometry;
                if (!geom.boundingBox) geom.computeBoundingBox();
                const tmpBox = new THREE.Box3().copy(geom.boundingBox).applyMatrix4(node.matrixWorld);
                box.union(tmpBox);
            }
        });
    }
    
    if (obstacleGroup && obstacleGroup.children.length > 0) {
        obstacleGroup.updateMatrixWorld(true);
        obstacleGroup.traverse(node => {
            if (node.isMesh && node.geometry && node.visible) {
                if (!node.geometry.boundingBox) node.geometry.computeBoundingBox();
                const tmpBox = new THREE.Box3().copy(node.geometry.boundingBox).applyMatrix4(node.matrixWorld);
                box.union(tmpBox);
            }
        });
    }
    
    if (box.isEmpty() || box.min.x === Infinity || isNaN(box.min.x)) {
        box.set(new THREE.Vector3(-15, 0, -15), new THREE.Vector3(15, 5, 15));
    }
    
    const center = new THREE.Vector3();
    box.getCenter(center);
    
    const size = new THREE.Vector3();
    box.getSize(size);
    
    const maxHoriz = Math.max(size.x, size.z, 2.0);
    const maxVert = Math.max(size.y, 2.0);
    
    const fov = (camera && camera.fov) ? camera.fov : 40;
    const aspect = (camera && camera.aspect) ? camera.aspect : 1.0;
    const fovRad = (fov * Math.PI) / 180;
    
    // Fit both vertical, horizontal and diagonal aspect with a targeted ~75% viewport fill ratio
    const distVert = (maxVert / 2) / Math.tan(fovRad / 2);
    const distHoriz = (maxHoriz / 2) / (Math.tan(fovRad / 2) * aspect);
    const distDiag = (Math.hypot(size.x, size.z) / 2) / (Math.tan(fovRad / 2) * Math.min(aspect, 1.35));
    
    // Scale distance so the model fills ~75% of the frame
    let distance = Math.max(distVert, distHoriz, distDiag * 0.72) / 0.75;
    distance = Math.max(8, Math.min(5000, distance));
    
    return { box, center, size, maxDim: Math.max(size.x, size.y, size.z), distance };
}

function resetCamera() {
    if (!camera || !controls) return;
    const { center, distance } = getSceneBoundsInfo();
    const dir = new THREE.Vector3(0.55, 0.45, 0.70).normalize();
    camera.position.copy(center).addScaledVector(dir, distance);
    controls.target.copy(center);
    controls.update();
}

function topView() {
    if (!camera || !controls) return;
    const { center, distance } = getSceneBoundsInfo();
    camera.position.set(center.x, center.y + distance, center.z + 0.001);
    controls.target.copy(center);
    controls.update();
}

function sideView() {
    if (!camera || !controls) return;
    const { center, distance } = getSceneBoundsInfo();
    camera.position.set(center.x + distance * 0.9, center.y + distance * 0.2, center.z);
    controls.target.copy(center);
    controls.update();
}

function zoomToFit() {
    if (!camera || !controls) return;
    const { center, distance } = getSceneBoundsInfo();
    const direction = new THREE.Vector3().subVectors(camera.position, center).normalize();
    camera.position.copy(center).add(direction.multiplyScalar(distance));
    controls.target.copy(center);
    controls.update();
}

function onWindowResize() {
    if (!camera || !renderer) return;
    const canvas = renderer.domElement;
    const container = canvas.parentElement;
    
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

let customActiveCamera = null;

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    updateMeasureLabels();
    
    // 羅盤 HUD 位置與旋轉更新
    const curCamera = customActiveCamera || camera;
    if (compassGroup && curCamera && renderer) {
        if (!curCamera.isOrthographicCamera) {
            compassGroup.visible = true;
            const aspect = curCamera.aspect || 1;
            const distance = 5.0; // 相對於相機的前方距離
            const fovRad = ((curCamera.fov || 45) * Math.PI) / 180;
            const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
            const visibleWidth = visibleHeight * aspect;
            
            // 固定在左上方 (位於 3D 預覽標籤下方，避免遮擋重疊)
            compassGroup.position.set(
                -visibleWidth / 2 + 0.55,
                visibleHeight / 2 - 1.10,
                -distance
            );
            
            // 使 HUD 羅盤相對於相機反向旋轉以指向世界北向
            compassGroup.quaternion.copy(curCamera.quaternion).conjugate();
        } else {
            compassGroup.visible = false;
        }
    }
    
    if (scene && curCamera && renderer) renderer.render(scene, curCamera);
}

// ==========================================
// 3. MAIN APPLICATION & STATE MANAGEMENT
// ==========================================
const state = {
    siteName: '',
    siteType: 'ground',
    pitchStyle: 'single',
    pvOrient: 'portrait', // Ground/Flat roof default to Portrait (直向排列)
    pvPreset: 'preset-vsun450', // Default to VSUN 450W
    pvL: 1722,
    pvW: 1134,
    pvP: 450,
    arrI: 20,
    arrJ: 4,
    arrM: 1,
    arrP: 1.0,
    spX: 20,
    spY: 20, // Ground/Flat roof default to x=y=20mm
    tilt: 6, // All three modes default to 6 degrees
    roofTilt: 0,
    roofH: 10,
    supportH: 2000,
    azimuth: 180,
    lat: 23.870194,
    lng: 120.523000,
    sunMonth: 12,
    sunHour: 15.0,
    
    totalCount: 0,
    totalPower: 0,
    dimW: 0,
    dimH: 0,
    showShadows: true,
    showSupports: true
};

const elements = {
    siteName: document.getElementById('val-site-name'),
    siteType: document.getElementById('val-site-type'),
    pitchStyle: document.getElementById('val-pitch-style'),
    chkPitchSingle: document.getElementById('chk-pitch-single'),
    chkPitchDouble: document.getElementById('chk-pitch-double'),
    chkPitchDoubleV: document.getElementById('chk-pitch-double-v'),
    pvOrient: document.getElementById('val-pv-orient'),
    pvSelect: document.getElementById('val-pv-select'),
    pvL: document.getElementById('val-pv-l'),
    pvW: document.getElementById('val-pv-w'),
    pvP: document.getElementById('val-pv-p'),
    arrI: document.getElementById('val-arr-i'),
    arrISlider: document.getElementById('val-arr-i-slider'),
    arrJ: document.getElementById('val-arr-j'),
    arrJSlider: document.getElementById('val-arr-j-slider'),
    arrM: document.getElementById('val-arr-m'),
    arrMSlider: document.getElementById('val-arr-m-slider'),
    arrP: document.getElementById('val-arr-p'),
    arrPSlider: document.getElementById('val-arr-p-slider'),
    spX: document.getElementById('val-sp-x'),
    spXSlider: document.getElementById('val-sp-x-slider'),
    spY: document.getElementById('val-sp-y'),
    spYSlider: document.getElementById('val-sp-y-slider'),
    tilt: document.getElementById('val-tilt'),
    tiltSlider: document.getElementById('val-tilt-slider'),
    roofTilt: document.getElementById('val-roof-tilt'),
    roofTiltSlider: document.getElementById('val-roof-tilt-slider'),
    roofH: document.getElementById('val-roof-h'),
    roofHSlider: document.getElementById('val-roof-h-slider'),
    supportH: document.getElementById('val-support-h'),
    supportHSlider: document.getElementById('val-support-h-slider'),
    azimuth: document.getElementById('val-azimuth'),
    azimuthSlider: document.getElementById('val-azimuth-slider'),
    coords: document.getElementById('val-coords'),
    
    totalCount: document.getElementById('val-total-count'),
    totalPower: document.getElementById('val-total-power'),
    dimW: document.getElementById('val-dim-w'),
    dimH: document.getElementById('val-dim-h'),
    siteArea: document.getElementById('val-site-area'),
    
    btnExportJson: document.getElementById('btn-export-json'),
    btnReset: document.getElementById('btn-reset'),
    btnSaveDefault: document.getElementById('btn-save-default'),
    btnSiteBoundary: document.getElementById('btn-site-boundary'),
    sliderSite: document.getElementById('slider-site'),
    btnRedrawSiteTrigger: document.getElementById('btn-redraw-site-trigger'),
    btnExclusionZone: document.getElementById('btn-exclusion-zone'),
    sliderExclusion: document.getElementById('slider-exclusion'),
    btnObstacleZone: document.getElementById('btn-obstacle-zone'),
    sliderObstacle: document.getElementById('slider-obstacle'),
    btnAddExclusionTrigger: document.getElementById('btn-add-exclusion-trigger'),
    btnAddObstacleTrigger: document.getElementById('btn-add-obstacle-trigger'),
    btnExCancel: document.getElementById('btn-ex-cancel'),
    btnObsCancel: document.getElementById('btn-obs-cancel'),
    btnObsPolygon: document.getElementById('btn-obs-polygon'),
    btnViewReset: document.getElementById('btn-view-reset'),
    btnViewTop: document.getElementById('btn-view-top'),
    btnViewSide: document.getElementById('btn-view-side'),
    btnViewFit: document.getElementById('btn-view-fit'),
    btnMapPegman: document.getElementById('btn-map-pegman'),
    btnMapCenter: document.getElementById('btn-map-center'),
    btnMapMyLocation: document.getElementById('btn-map-mylocation'),
    btnMapMeasure: document.getElementById('btn-map-measure'),
    mapSearchInput: document.getElementById('map-search-input'),
    mapSearchBtn: document.getElementById('map-search-btn'),
    
    sunMonthSlider: document.getElementById('sun-month-slider'),
    sunMonthVal: document.getElementById('sun-month-val'),
    sunHourSlider: document.getElementById('sun-hour-slider'),
    sunHourVal: document.getElementById('sun-hour-val'),
    
    slider3DShadows: document.getElementById('slider-3d-shadows'),
    slider3DSupports: document.getElementById('slider-3d-supports')
};

const pvPresets = {
    'preset-vsun450': { l: 1722, w: 1134, p: 450 },
    'preset-longi460': { l: 2094, w: 1038, p: 460 },
    'preset-longi425': { l: 1722, w: 1134, p: 425 },
    'preset-motech460': { l: 1722, w: 1133, p: 460 },
    'preset-tsec455': { l: 1723, w: 1134, p: 455 }
};


function parseDMS(dmsStr) {
    if (!dmsStr) return null;
    
    // 1. Standardize commonly confused characters and typographic variants
    let str = dmsStr.trim();
    
    // Replace Chinese notation with standard DMS symbols
    str = str.replace(/度/g, "\u00b0").replace(/分/g, "'").replace(/秒/g, '"');
    
    // Replace typographical single/double quotes and prime/double prime symbols
    str = str.replace(/[\u2032\u2035\x27\u2019\u0060]/g, "'");
    str = str.replace(/[\u2033\u201C\u201D\x22]/g, '"');
    
    // 2. Highly permissive regex to parse DMS parts. 
    const dmsRegex = /(\d+)\s*[\u00b0\u7670]?\s*(\d+)\s*\x27?\s*([\d.]+)\s*\x22?\s*([NSEWnsew])/ig;
    
    let match;
    const results = [];
    dmsRegex.lastIndex = 0; // Reset state
    
    while ((match = dmsRegex.exec(str)) !== null) {
        const deg = parseFloat(match[1]);
        const min = parseFloat(match[2]);
        const sec = parseFloat(match[3]);
        const dir = match[4].toUpperCase();
        
        let decimal = deg + min / 60 + sec / 3600;
        if (dir === 'S' || dir === 'W') {
            decimal = -decimal;
        }
        results.push({ decimal, dir });
    }
    
    if (results.length >= 2) {
        let lat = null;
        let lng = null;
        results.forEach(r => {
            if (r.dir === 'N' || r.dir === 'S') lat = r.decimal;
            if (r.dir === 'E' || r.dir === 'W') lng = r.decimal;
        });
        
        // If direction markers are ambiguous, map by order
        if (lat === null) lat = results[0].decimal;
        if (lng === null) lng = results[1].decimal;
        
        return { lat, lng };
    }
    
    // Fallback: decimals regex e.g. "24.809167, 121.041972"
    const decRegex = /(-?[\d.]+)\s*[,/|\s]\s*(-?[\d.]+)/;
    const decMatch = str.match(decRegex);
    if (decMatch) {
        return {
            lat: parseFloat(decMatch[1]),
            lng: parseFloat(decMatch[2])
        };
    }
    
    return null;
}

/**
 * Converts decimal coordinates to DMS string format
 */
function convertToDMS(decimal, isLat) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    
    let direction = "";
    if (isLat) {
        direction = decimal >= 0 ? "N" : "S";
    } else {
        direction = decimal >= 0 ? "E" : "W";
    }
    
    return `${degrees}°${String(minutes).padStart(2, '0')}'${String(seconds).padStart(4, '0')}"${direction}`;
}

function getCoord(obj) {
    if (!obj) return null;
    if (obj.lat !== undefined && obj.lng !== undefined) {
        return { lat: obj.lat, lng: obj.lng };
    }
    if (Array.isArray(obj) && obj.length >= 2 && !Array.isArray(obj[0]) && !Array.isArray(obj[1])) {
        const val1 = parseFloat(obj[0]);
        const val2 = parseFloat(obj[1]);
        if (!isNaN(val1) && !isNaN(val2)) {
            if (Math.abs(val1) > 100) {
                return { lat: val2, lng: val1 };
            } else {
                return { lat: val1, lng: val2 };
            }
        }
    }
    return null;
}

function isPointInPolygon(point, polygonLatLngs) {
    const x = point.lng, y = point.lat;
    let inside = false;
    for (let i = 0, j = polygonLatLngs.length - 1; i < polygonLatLngs.length; j = i++) {
        const ptI = getCoord(polygonLatLngs[i]);
        const ptJ = getCoord(polygonLatLngs[j]);
        if (!ptI || !ptJ) continue;
        
        const xi = ptI.lng, yi = ptI.lat;
        const xj = ptJ.lng, yj = ptJ.lat;
        const intersect = ((yi > y) !== (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getOuterRingLatLngs(poly) {
    let latlngs = poly.getLatLngs();
    while (Array.isArray(latlngs) && latlngs.length > 0 && !getCoord(latlngs[0])) {
        latlngs = latlngs[0];
    }
    return latlngs;
}

function getModuleWorldBottomY(localX, rowZ, params) {
    const config = params || state;
    const siteType = config.siteType || 'ground';
    const pitchStyle = config.pitchStyle || 'single';
    const tilt = config.tilt !== undefined ? config.tilt : 6;
    const roofTilt = config.roofTilt !== undefined ? config.roofTilt : 0;
    const supportH = (config.supportH !== undefined ? config.supportH : 2000) / 1000; // in meters
    const roofH = config.roofH !== undefined ? config.roofH : 0; // in meters
    const pvOrient = config.pvOrient || 'portrait';
    const pvL_raw = config.pvL || 1722;
    const pvW_raw = config.pvW || 1134;
    const arrJ = config.arrJ || 4;
    const arrM = siteType === 'roof-slope' ? 1 : (config.arrM || 1);
    const arrP = config.arrP !== undefined ? config.arrP : 1.0;
    const spY = (config.spY !== undefined ? config.spY : 20) / 1000;
    
    const totalTiltRad = (tilt * Math.PI) / 180;
    const roofTiltRad = (roofTilt * Math.PI) / 180;
    const isPortrait = pvOrient === 'portrait';
    const pvW_term = isPortrait ? pvL_raw : pvW_raw;
    const pvW = pvW_term / 1000;
    const halfW = pvW / 2;
    const halfH_tilted = halfW * Math.sin(totalTiltRad);
    
    const isSpecialRoofSlopeFlatLandscape = 
        siteType === 'roof-slope' && 
        Math.abs(tilt - roofTilt) < 0.01 && 
        pvOrient === 'landscape';
        
    let totalSpY = 0;
    for (let r = 1; r < arrJ; r++) {
        totalSpY += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
    }
    const arrayLength = arrJ * pvW + totalSpY;
    const halfLen = arrayLength / 2;
    
    const panelOffset = (siteType === 'roof-slope') ? 0.0 : (0.075 + 0.20);
    const isFlatLaid = (siteType === 'roof-slope') && Math.abs(tilt - roofTilt) < 0.01;
    
    const getRoofY = (zVal) => {
        if (siteType !== 'roof-slope') return 0;
        return zVal * Math.sin(roofTiltRad);
    };
    
    const blockIdx = arrM > 1 ? Math.round((rowZ / arrP) + (arrM - 1) / 2) : 0;
    const clampedG = Math.max(0, Math.min(arrM - 1, blockIdx));
    const blockZ = (clampedG - (arrM - 1) / 2) * arrP;
    
    let panelY = 0;
    const isDoublePitch = (pitchStyle === 'double' || pitchStyle === 'double-v');
    if (isDoublePitch) {
        const ridgeSp = (siteType === 'roof-slope') ? 1.2 : 0.2;
        const azimuthRad = ((config.azimuth || 180) * Math.PI) / 180;
        const isSouthSlopeZNeg = (Math.cos(azimuthRad) <= 0);
        const numSouth = (arrJ % 2 !== 0) ? (arrJ + 1) / 2 : arrJ / 2;
        const numNorth = arrJ - numSouth;
        const numNeg = isSouthSlopeZNeg ? numSouth : numNorth;
        const numPos = isSouthSlopeZNeg ? numNorth : numSouth;
        
        let totalSpY_neg = 0;
        for (let r = 1; r < numNeg; r++) {
            totalSpY_neg += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
        }
        let totalSpY_pos = 0;
        for (let r = 1; r < numPos; r++) {
            totalSpY_pos += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
        }
        const s_outer_neg = (numNeg > 0) ? -(ridgeSp / 2 + numNeg * pvW + totalSpY_neg) : (ridgeSp / 2);
        const s_outer_pos = (numPos > 0) ? +(ridgeSp / 2 + numPos * pvW + totalSpY_pos) : -(ridgeSp / 2);
        const zOffset = (s_outer_pos + s_outer_neg) / 2 * Math.cos(totalTiltRad);
        
        let ridgeY = supportH;
        if (siteType === 'roof-slope') {
            ridgeY = isFlatLaid ? 0.20 : (supportH + 0.1);
        }
        const s_actual = (rowZ + zOffset - blockZ) / Math.cos(totalTiltRad);
        if (pitchStyle === 'double-v') {
            const s_max = Math.max(Math.abs(s_outer_neg), s_outer_pos);
            const rowY = ridgeY - (s_max - Math.abs(s_actual)) * Math.sin(totalTiltRad);
            panelY = rowY + 0.015 + panelOffset;
        } else {
            const rowY = ridgeY - Math.abs(s_actual) * Math.sin(totalTiltRad);
            panelY = rowY + 0.015 + panelOffset;
        }
    } else {
        let singleHighY = supportH;
        if (siteType === 'roof-slope') {
            const z_back_arr = halfLen * Math.cos(totalTiltRad);
            const y_roof_back = getRoofY(z_back_arr);
            if (isFlatLaid) {
                singleHighY = y_roof_back + 0.20;
            } else {
                const z_front_arr = -halfLen * Math.cos(totalTiltRad);
                const y_roof_front = getRoofY(z_front_arr);
                const nominalHighY = y_roof_back + supportH;
                const mod_front_Y = nominalHighY - 2 * halfLen * Math.sin(totalTiltRad);
                const clearance_front = mod_front_Y - y_roof_front;
                const lift = (clearance_front < 0.1) ? (0.1 - clearance_front) : 0;
                singleHighY = nominalHighY + lift;
            }
        }
        const localZ_actual = (rowZ - blockZ) / Math.cos(totalTiltRad);
        const tiltedY = (siteType === 'roof-slope' ? singleHighY : supportH) - (halfLen - localZ_actual) * Math.sin(totalTiltRad);
        panelY = tiltedY + 0.015 + panelOffset;
    }
    
    // World bottom elevation of module
    const worldBottomY = roofH + (panelY - 0.015) - halfH_tilted;
    return worldBottomY;
}

function isModuleExcluded(localX, rowZ, params) {
    if (exclusionPolygons.length === 0 && obstaclePolygons.length === 0 && !customSiteBoundary) return false;
    
    const config = params || state;
    const pvOrient = config.pvOrient !== undefined ? config.pvOrient : state.pvOrient;
    const pvL = config.pvL !== undefined ? config.pvL : state.pvL;
    const pvW = config.pvW !== undefined ? config.pvW : state.pvW;
    const tilt = config.tilt !== undefined ? config.tilt : state.tilt;
    const azimuth = config.azimuth !== undefined ? config.azimuth : state.azimuth;
    const lat = config.lat !== undefined ? config.lat : state.lat;
    const lng = config.lng !== undefined ? config.lng : state.lng;

    const isPortrait = pvOrient === 'portrait';
    const pvL_term = isPortrait ? pvW : pvL;
    const pvW_term = isPortrait ? pvL : pvW;
    const totalTiltRad = (tilt * Math.PI) / 180;
    const halfL = pvL_term / 2000;
    const halfW = pvW_term / 2000;
    const halfW_z = halfW * Math.cos(totalTiltRad);
    
    const testPoints = [
        { x: localX, z: rowZ },
        { x: localX - halfL, z: rowZ - halfW_z },
        { x: localX + halfL, z: rowZ - halfW_z },
        { x: localX + halfL, z: rowZ + halfW_z },
        { x: localX - halfL, z: rowZ + halfW_z }
    ];
    
    const thetaRad = (-azimuth * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    
    const metersPerLatDegree = 111320;
    const latRad = (lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    // A. Check Site Boundary (if customSiteBoundary exists, module must be INSIDE it!)
    if (customSiteBoundary) {
        const boundaryLatLngs = getOuterRingLatLngs(customSiteBoundary);
        let allInside = true;
        for (const pt of testPoints) {
            const rx = pt.x * cosTheta + pt.z * sinTheta;
            const ry = pt.x * sinTheta - pt.z * cosTheta;
            
            const testLat = lat + ry / metersPerLatDegree;
            const testLng = lng + rx / metersPerLngDegree;
            
            const inside = isPointInPolygon({ lat: testLat, lng: testLng }, boundaryLatLngs);
            if (!inside) {
                allInside = false;
                break;
            }
        }
        if (!allInside) {
            return true; // Excluded! (Outside site boundary)
        }
    }
    
    // B. Check Exclusion Zones
    let isExcludedByExclusion = false;
    if (exclusionPolygons.length > 0) {
        const corners = [
            { x: localX - halfL, z: rowZ - halfW_z },
            { x: localX + halfL, z: rowZ - halfW_z },
            { x: localX + halfL, z: rowZ + halfW_z },
            { x: localX - halfL, z: rowZ + halfW_z }
        ];
        const coords = corners.map(pt => {
            const rx = pt.x * cosTheta + pt.z * sinTheta;
            const ry = pt.x * sinTheta - pt.z * cosTheta;
            const testLat = lat + ry / metersPerLatDegree;
            const testLng = lng + rx / metersPerLngDegree;
            return [testLng, testLat];
        });
        coords.push(coords[0]);
        
        try {
            if (window.turf) {
                const moduleGeoJSON = turf.polygon([coords]);
                const moduleArea = turf.area(moduleGeoJSON);
                let totalRegularOverlapArea = 0;
                
                for (const poly of exclusionPolygons) {
                    if (poly.isWalkway) continue;
                    const polyGeoJSON = poly.toGeoJSON();
                    const intersection = turf.intersect(moduleGeoJSON, polyGeoJSON);
                    if (intersection) {
                        const area = turf.area(intersection);
                        if (poly.isPathway || poly.isSubstation) {
                            if (area > 0.01) { // Any significant overlap (more than 100 cm²)
                                isExcludedByExclusion = true;
                                break;
                            }
                        } else {
                            totalRegularOverlapArea += area;
                        }
                    }
                }
                
                if (totalRegularOverlapArea >= moduleArea / 3.0) {
                    isExcludedByExclusion = true;
                }
            } else {
                throw new Error("Turf.js not loaded on window");
            }
        } catch (err) {
            console.error("Turf intersection area calculation failed:", err);
            // Fallback to point check if turf fails
            let ptExcluded = false;
            for (const pt of testPoints) {
                const rx = pt.x * cosTheta + pt.z * sinTheta;
                const ry = pt.x * sinTheta - pt.z * cosTheta;
                const testLat = lat + ry / metersPerLatDegree;
                const testLng = lng + rx / metersPerLngDegree;
                for (const poly of exclusionPolygons) {
                    if (poly.isWalkway) continue;
                    const latlngs = getOuterRingLatLngs(poly);
                    if (isPointInPolygon({ lat: testLat, lng: testLng }, latlngs)) {
                        ptExcluded = true;
                        break;
                    }
                }
                if (ptExcluded) break;
            }
            if (ptExcluded) isExcludedByExclusion = true;
        }
    }
    
    if (isExcludedByExclusion) return true;
    
    // C. Check Obstacles (Planar 2D Footprint + 3D Height Collision)
    let isExcludedByObstacle = false;
    if (obstaclePolygons.length > 0) {
        const corners = [
            { x: localX - halfL, z: rowZ - halfW_z },
            { x: localX + halfL, z: rowZ - halfW_z },
            { x: localX + halfL, z: rowZ + halfW_z },
            { x: localX - halfL, z: rowZ + halfW_z }
        ];
        const coords = corners.map(pt => {
            const rx = pt.x * cosTheta + pt.z * sinTheta;
            const ry = pt.x * sinTheta - pt.z * cosTheta;
            const testLat = lat + ry / metersPerLatDegree;
            const testLng = lng + rx / metersPerLngDegree;
            return [testLng, testLat];
        });
        coords.push(coords[0]);
        
        const roofH = config.roofH !== undefined ? config.roofH : 0;
        let supportBaseY = 0;
        if (config.siteType === 'roof-flat') {
            supportBaseY = roofH;
        } else if (config.siteType === 'roof-slope') {
            const roofTiltRad = ((config.roofTilt || 0) * Math.PI) / 180;
            supportBaseY = roofH + rowZ * Math.sin(roofTiltRad);
        } else {
            supportBaseY = 0; // ground mount base
        }
        
        for (const poly of obstaclePolygons) {
            const rawH = poly.obstacleHeight !== undefined ? poly.obstacleHeight : 5.0;
            const isOnRoof = (poly.isOnRoof !== undefined) ? poly.isOnRoof : true;
            let obsBaseY = 0;
            if (config.siteType !== 'ground' && isOnRoof) {
                if (config.siteType === 'roof-flat') {
                    obsBaseY = roofH;
                } else if (config.siteType === 'roof-slope') {
                    const roofTiltRad = ((config.roofTilt || 0) * Math.PI) / 180;
                    obsBaseY = roofH + rowZ * Math.sin(roofTiltRad);
                }
            }
            const obsTotalHeight = obsBaseY + rawH;
            
            // If obstacle total height does not even reach the base of support structure / roof surface, no physical clash
            if (obsTotalHeight < supportBaseY - 0.001) {
                continue;
            }
            
            // Check 2D planar overlap
            let has2DOverlap = false;
            try {
                if (window.turf) {
                    const moduleGeoJSON = turf.polygon([coords]);
                    const polyGeoJSON = poly.toGeoJSON();
                    const intersection = turf.intersect(moduleGeoJSON, polyGeoJSON);
                    if (intersection && turf.area(intersection) > 0.001) {
                        has2DOverlap = true;
                    }
                }
            } catch (e) {
                // Turf fallback
            }
            
            if (!has2DOverlap) {
                // Point-in-polygon check
                const latlngs = getOuterRingLatLngs(poly);
                for (const pt of testPoints) {
                    const rx = pt.x * cosTheta + pt.z * sinTheta;
                    const ry = pt.x * sinTheta - pt.z * cosTheta;
                    const testLat = lat + ry / metersPerLatDegree;
                    const testLng = lng + rx / metersPerLngDegree;
                    if (isPointInPolygon({ lat: testLat, lng: testLng }, latlngs)) {
                        has2DOverlap = true;
                        break;
                    }
                }
            }
            
            if (has2DOverlap) {
                isExcludedByObstacle = true;
                break;
            }
        }
    }
    
    if (isExcludedByObstacle) return true;
    
    // Print debug log for first few modules to see what is calculated
    if (Math.abs(localX) < 1.0 && Math.abs(rowZ) < 1.0) {
        console.log(`[DEBUG Exclude] Module at local (${localX.toFixed(2)}, ${rowZ.toFixed(2)}) -> Excluded: false`);
        if (exclusionPolygons.length > 0) {
            const firstPolyLatLngs = getOuterRingLatLngs(exclusionPolygons[0]) || [];
            console.log(` - First Poly corners count: ${firstPolyLatLngs.length}`);
            if (firstPolyLatLngs.length > 0 && firstPolyLatLngs[0]) {
                console.log(` - First Poly corner 0: [lat: ${firstPolyLatLngs[0].lat.toFixed(6)}, lng: ${firstPolyLatLngs[0].lng.toFixed(6)}]`);
            }
            const firstTestPt = testPoints[0];
            const rx0 = firstTestPt.x * cosTheta + firstTestPt.z * sinTheta;
            const ry0 = firstTestPt.x * sinTheta - firstTestPt.z * cosTheta;
            const lat0 = lat + ry0 / metersPerLatDegree;
            const lng0 = lng + rx0 / metersPerLngDegree;
            console.log(` - Module center map coord: [lat: ${lat0.toFixed(6)}, lng: ${lng0.toFixed(6)}]`);
        }
    }
    
    return false;
}

function unionExclusionPolygons() {
    if (!window.turf) return;
    
    const regulars = exclusionPolygons.filter(p => !p.isPathway && !p.isSubstation && !p.isWalkway);
    const nonRegulars = exclusionPolygons.filter(p => p.isPathway || p.isSubstation || p.isWalkway);
    
    if (regulars.length <= 1) return;
    
    clearActivePolygonSelection();
    
    const features = regulars.map(p => p.toGeoJSON());
    try {
        let unioned = features[0];
        for (let i = 1; i < features.length; i++) {
            unioned = turf.union(unioned, features[i]);
        }
        
        regulars.forEach(p => map.removeLayer(p));
        exclusionPolygons = [...nonRegulars];
        
        const geoLayer = L.geoJSON(unioned, {
            style: {
                color: 'rgba(251, 191, 36, 1)',
                fillColor: 'rgba(251, 191, 36, 1)',
                fillOpacity: 0.3,
                weight: 2.5,
                dashArray: '6, 6'
            }
        });
        
        geoLayer.eachLayer(layer => {
            if (layer instanceof L.Polygon) {
                layer.setStyle({
                    color: 'rgba(251, 191, 36, 1)',
                    fillColor: 'rgba(251, 191, 36, 1)',
                    fillOpacity: 0.3,
                    weight: 2.5,
                    dashArray: '6, 6',
                    interactive: true
                });
                makePolygonDraggable(layer);
                makePolygonSelectable(layer);
                layer.addTo(map);
                exclusionPolygons.push(layer);
            }
        });
    } catch (err) {
        console.error("Turf union failed:", err);
    }
}

function applyDefaultsIntoDOM(defaults) {
    if (!defaults) return;
    elements.siteName.value = defaults.siteName;
    elements.siteType.value = defaults.siteType;
    elements.pitchStyle.value = defaults.pitchStyle;
    if (elements.chkPitchSingle) elements.chkPitchSingle.checked = (defaults.pitchStyle === 'single');
    if (elements.chkPitchDouble) elements.chkPitchDouble.checked = (defaults.pitchStyle === 'double');
    if (elements.chkPitchDoubleV) elements.chkPitchDoubleV.checked = (defaults.pitchStyle === 'double-v');
    elements.pvOrient.value = defaults.pvOrient;
    
    const resetPreset = pvPresets[defaults.pvPreset] ? defaults.pvPreset : (Object.keys(pvPresets)[0] || 'custom');
    elements.pvSelect.value = resetPreset;
    if (resetPreset !== 'custom') {
        const preset = pvPresets[resetPreset];
        elements.pvL.value = preset.l;
        elements.pvW.value = preset.w;
        elements.pvP.value = preset.p;
    } else {
        elements.pvL.value = defaults.pvL;
        elements.pvW.value = defaults.pvW;
        elements.pvP.value = defaults.pvP;
    }
    
    elements.arrI.value = defaults.arrI;
    if (elements.arrISlider) elements.arrISlider.value = defaults.arrI;
    elements.arrJ.value = defaults.arrJ;
    if (elements.arrJSlider) elements.arrJSlider.value = defaults.arrJ;
    elements.arrM.value = defaults.arrM;
    if (elements.arrMSlider) elements.arrMSlider.value = defaults.arrM;
    elements.arrP.value = defaults.arrP;
    if (elements.arrPSlider) elements.arrPSlider.value = defaults.arrP;
    
    elements.spX.value = defaults.spX;
    if (elements.spXSlider) elements.spXSlider.value = defaults.spX;
    elements.spY.value = defaults.spY;
    if (elements.spYSlider) elements.spYSlider.value = defaults.spY;
    elements.tilt.value = defaults.tilt;
    if (elements.tiltSlider) elements.tiltSlider.value = defaults.tilt;
    
    elements.roofTilt.value = defaults.roofTilt;
    if (elements.roofTiltSlider) elements.roofTiltSlider.value = defaults.roofTilt;
    elements.roofH.value = defaults.roofH;
    if (elements.roofHSlider) elements.roofHSlider.value = defaults.roofH;
    elements.supportH.value = defaults.supportH;
    if (elements.supportHSlider) elements.supportHSlider.value = defaults.supportH;
    
    elements.azimuth.value = defaults.azimuth;
    if (elements.azimuthSlider) elements.azimuthSlider.value = defaults.azimuth;
    elements.coords.value = defaults.coords || '23°52\'12.7"N 120°31\'22.8"E';
    
    if (elements.sunMonthSlider) elements.sunMonthSlider.value = defaults.sunMonth;
    if (elements.sunHourSlider) elements.sunHourSlider.value = defaults.sunHour;
    
    if (defaults.lat && defaults.lng) {
        state.lat = defaults.lat;
        state.lng = defaults.lng;
    } else {
        state.lat = 23.870194;
        state.lng = 120.523000;
    }
}

function updateLogoTheme() {
    const logoImg = document.getElementById('pv-super-logo');
    if (!logoImg) return;
    
    // Find the first parent with a non-transparent background color
    let parent = logoImg.parentElement;
    let bgColor = 'rgba(0, 0, 0, 0)';
    
    while (parent) {
        const style = window.getComputedStyle(parent);
        const bg = style.backgroundColor;
        if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgba(0,0,0,0)') {
            bgColor = bg;
            break;
        }
        parent = parent.parentElement;
    }
    
    let isDark = true; // Default to dark background (meaning we show light logo)
    
    const match = bgColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
    if (match) {
        const r = parseInt(match[1], 10);
        const g = parseInt(match[2], 10);
        const b = parseInt(match[3], 10);
        const a = match[4] !== undefined ? parseFloat(match[4]) : 1;
        
        if (a > 0.1) {
            // HSP relative luminance formula
            const brightness = Math.sqrt(
                0.299 * (r * r) +
                0.587 * (g * g) +
                0.114 * (b * b)
            );
            isDark = brightness <= 127.5;
        }
    }
    
    const normalSrc = isDark ? 'images/pv_super_logo_dark.png' : 'images/pv_super_logo_light.png';
    const hoverSrc = 'images/favicon.png';
    
    logoImg.src = normalSrc;
    
    // Preload both images for instant hover switching
    const preloadHover = new Image();
    preloadHover.src = hoverSrc;
    const preloadNormal = new Image();
    preloadNormal.src = normalSrc;
    
    const logoLink = logoImg.closest('.pv-super-logo-link') || logoImg;
    
    const updateContainerWidth = () => {
        if (logoImg.naturalWidth && logoImg.naturalHeight) {
            const fullW = (logoImg.naturalWidth / logoImg.naturalHeight) * (logoImg.clientHeight || 72);
            logoLink.style.minWidth = `${fullW}px`;
        } else if (logoImg.offsetWidth > 0) {
            logoLink.style.minWidth = `${logoImg.offsetWidth}px`;
        }
    };
    
    if (logoImg.complete && logoImg.naturalWidth > 0) {
        updateContainerWidth();
    } else {
        logoImg.addEventListener('load', updateContainerWidth, { once: true });
    }
    
    if (!logoLink._hasHoverListener) {
        logoLink._hasHoverListener = true;
        logoLink.addEventListener('mouseenter', () => {
            logoImg.src = hoverSrc;
        });
        logoLink.addEventListener('mouseleave', () => {
            logoImg.src = normalSrc;
        });
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    // 讀取 defaults.json 設定檔
    let defaults = {
        siteName: "??蝬 1?",
        siteType: "ground",
        pitchStyle: "single",
        pvOrient: "portrait",
        pvPreset: "preset-vsun450",
        pvL: 1722,
        pvW: 1134,
        pvP: 450,
        arrI: 20,
        arrJ: 4,
        arrM: 1,
        arrP: 1.0,
        spX: 20,
        spY: 20,
        tilt: 6,
        roofTilt: 0,
        roofH: 10.0,
        supportH: 2000,
        azimuth: 180.0,
        coords: "23簞52'12.7\"N 120簞31'22.8\"E",
        lat: 23.870194444444444,
        lng: 120.523,
        sunMonth: 12,
        sunHour: 15.0
    };
    
    // 優先自 defaults.json 檔案讀取預設值，附加 timestamp 避免瀏覽器快取
    try {
        const fileResponse = await fetch('defaults.json?t=' + Date.now(), { cache: 'no-store' });
        if (fileResponse.ok) {
            const fileDefaults = await fileResponse.json();
            defaults = { ...defaults, ...fileDefaults };
            // 同步存入 localStorage
            localStorage.setItem('solar_layout_custom_defaults', JSON.stringify(defaults));
            console.log('Loaded defaults from defaults.json', defaults);
        }
    } catch (err) {
        console.log('Cannot fetch defaults.json, falling back to localStorage/static defaults.', err);
        // 次選讀取 localStorage 內儲存的預設值
        const saved = localStorage.getItem('solar_layout_custom_defaults');
        if (saved) {
            try {
                const localDefaults = JSON.parse(saved);
                // 修正舊版 localStorage 存留之 month: 6，強制改為 12
                if (localDefaults.sunMonth === 6) {
                    localDefaults.sunMonth = 12;
                }
                defaults = { ...defaults, ...localDefaults };
            } catch (e) {
                console.error("Error parsing localStorage defaults: ", e);
            }
        }
    }
    
    // 套用預設值至 DOM Inputs
    applyDefaultsIntoDOM(defaults);
    
    syncStateFromDOM();
    handleSiteTypeChangeUI(); // 確保初次載入即判定各項參數 (包含第13項組列間距) 之 Mute / Readonly 狀態
    updateSupportHLockState();
    calculateOutputs();
    
    // Initialize Leaflet Map
    initMap(state.lat, state.lng, handleMarkerDrag);
    
    // Initialize Three.js Viewer
    initViewer('three-canvas');
    
    setupEventListeners(); // 綁定事件監聽器
    
    // Initialize sun simulator text labels and solar position
    if (elements.sunMonthSlider) elements.sunMonthSlider.dispatchEvent(new Event('input'));
    if (elements.sunHourSlider) elements.sunHourSlider.dispatchEvent(new Event('input'));
    
    updateAllVisuals(true);
    resetCamera();
    setupSplitter(); // Enable resizable panes
    initInstructionsHighlight(); // 初始化說明高亮功能
    updateLogoTheme(); // 依主題更新 Logo (dark/light)
    
    // 初始化工具箱切換與位置控制
    updatePlanningControlsSlot();
    window.addEventListener('resize', updatePlanningControlsSlot);
    
    // 綁定邊線平移微調按鈕
    initDraggablePanels();
    
    // 初始化模組滑桿
    initLockButtons();
});

const lockedParams = {};

const SVG_LOCK = `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`;
const SVG_UNLOCK = `<svg viewBox="0 0 24 24"><path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z"/></svg>`;

function initLockButtons() {
    // Dynamically wrap all .slider-cell contents in a flexbox inner container for perfect alignment
    document.querySelectorAll('.slider-cell').forEach(td => {
        if (!td.querySelector('.slider-cell-inner')) {
            const inner = document.createElement('div');
            inner.className = 'slider-cell-inner';
            while (td.firstChild) {
                inner.appendChild(td.firstChild);
            }
            td.appendChild(inner);
        }
    });

    document.querySelectorAll('.lock-toggle-btn').forEach(btn => {
        btn.innerHTML = SVG_UNLOCK;
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const param = btn.getAttribute('data-param');
            if (!param) return;
            
            lockedParams[param] = !lockedParams[param];
            const isLocked = lockedParams[param];
            
            btn.classList.toggle('is-locked', isLocked);
            btn.innerHTML = isLocked ? SVG_LOCK : SVG_UNLOCK;
            btn.title = isLocked ? '已鎖定此參數 (不隨案場變更)' : '鎖定此參數';
            
            const row = btn.closest('tr');
            if (row) {
                row.querySelectorAll('input, button.slider-btn, button.slider-node-btn').forEach(elem => {
                    if (elem !== btn) {
                        elem.disabled = isLocked;
                    }
                });
            }
        });
    });
}

function updatePlanningControlsSlot() {
    const isMobile = window.innerWidth <= 768;
    const container = document.getElementById('planning-controls-container');
    const mobileSlot = document.getElementById('mobile-planning-controls-slot');
    const desktopSlot = document.getElementById('desktop-planning-controls-slot');
    
    if (!container) return;
    
    if (isMobile && mobileSlot) {
        if (container.parentElement !== mobileSlot) {
            mobileSlot.appendChild(container);
        }
    } else if (!isMobile && desktopSlot) {
        if (container.parentElement !== desktopSlot) {
            desktopSlot.appendChild(container);
        }
    }
}

function syncStateFromDOM() {
    state.siteName = elements.siteName.value;
    state.siteType = elements.siteType.value;
    if (elements.chkPitchDoubleV && elements.chkPitchDoubleV.checked) {
        state.pitchStyle = 'double-v';
    } else if (elements.chkPitchDouble && elements.chkPitchDouble.checked) {
        state.pitchStyle = 'double';
    } else {
        state.pitchStyle = 'single';
    }
    if (elements.pitchStyle) elements.pitchStyle.value = state.pitchStyle;
    state.pvOrient = elements.pvOrient.value;
    state.pvPreset = elements.pvSelect.value;
    state.pvL = parseFloat(elements.pvL.value) || 0;
    state.pvW = parseFloat(elements.pvW.value) || 0;
    state.pvP = parseFloat(elements.pvP.value) || 0;
    state.arrI = parseInt(elements.arrI.value) || 1;
    state.arrJ = parseInt(elements.arrJ.value) || 1;
    state.arrM = parseInt(elements.arrM.value) || 1;
    state.arrP = parseFloat(elements.arrP.value) || 10.0;
    state.spX = parseFloat(elements.spX.value) || 0;
    state.spY = parseFloat(elements.spY.value) || 0;
    state.tilt = parseFloat(elements.tilt.value) || 0;
    state.roofTilt = parseFloat(elements.roofTilt.value) || 0;
    state.roofH = parseFloat(elements.roofH.value) || 0;
    state.supportH = parseFloat(elements.supportH.value) || 1500;
    state.azimuth = parseFloat(elements.azimuth.value) || 0;
    if (elements.sunMonthSlider) {
        state.sunMonth = parseInt(elements.sunMonthSlider.value) || 12;
    }
    if (elements.sunHourSlider) {
        state.sunHour = parseFloat(elements.sunHourSlider.value) || 15.0;
    }
    
    const parsedCoords = parseDMS(elements.coords.value);
    if (parsedCoords) {
        state.lat = parsedCoords.lat;
        state.lng = parsedCoords.lng;
    }
    
    handlePvPresetChangeUI();
    handleSiteTypeChangeUI();
    updateSupportHLockState();
}

function handlePvPresetChangeUI() {
    const isCustom = state.pvPreset === 'custom';
    elements.pvL.disabled = !isCustom;
    elements.pvW.disabled = !isCustom;
    elements.pvP.disabled = !isCustom;
    
    const rows = [elements.pvL, elements.pvW, elements.pvP].map(el => el.closest('td'));
    rows.forEach(td => {
        if (!isCustom) {
            td.classList.add('readonly');
        } else {
            td.classList.remove('readonly');
        }
    });
}

function handleSiteTypeChangeUI() {
    const isSlopeRoof = state.siteType === 'roof-slope';
    const isGround = state.siteType === 'ground';
    
    // Roof tilt controls (only for slope roof)
    elements.roofTilt.disabled = !isSlopeRoof;
    elements.roofTiltSlider.disabled = !isSlopeRoof;
    
    const minusBtn = document.getElementById('btn-roof-minus');
    const plusBtn = document.getElementById('btn-roof-plus');
    if (minusBtn) minusBtn.disabled = !isSlopeRoof;
    if (plusBtn) plusBtn.disabled = !isSlopeRoof;
    
    const tdTilt = elements.roofTilt.closest('td');
    if (!isSlopeRoof) {
        tdTilt.classList.add('readonly');
        elements.roofTilt.value = 0;
        elements.roofTiltSlider.value = 0;
        state.roofTilt = 0;
    } else {
        tdTilt.classList.remove('readonly');
        if (parseFloat(elements.roofTilt.value) === 0) {
            elements.roofTilt.value = 8;
            elements.roofTiltSlider.value = 8;
            state.roofTilt = 8;
        }
    }
    
    // Roof height controls (for flat roof and slope roof)
    elements.roofH.disabled = isGround;
    elements.roofHSlider.disabled = isGround;
    
    const minusHBtn = document.getElementById('btn-roof-h-minus');
    const plusHBtn = document.getElementById('btn-roof-h-plus');
    if (minusHBtn) minusHBtn.disabled = isGround;
    if (plusHBtn) plusHBtn.disabled = isGround;
    
    const tdH = elements.roofH.closest('td');
    if (isGround) {
        tdH.classList.add('readonly');
        elements.roofH.value = 0;
        elements.roofHSlider.value = 0;
        state.roofH = 0;
    } else {
        tdH.classList.remove('readonly');
        if (parseFloat(elements.roofH.value) === 0) {
            elements.roofH.value = 10;
            elements.roofHSlider.value = 10;
            state.roofH = 10;
        }
    }
    
    // Group m and p controls (only for ground and flat roof)
    const isMEnabled = !isSlopeRoof;
    const currentM = parseInt(elements.arrM ? elements.arrM.value : state.arrM, 10) || state.arrM || 1;
    state.arrM = currentM;
    const isPEnabled = isMEnabled && (currentM > 1);
    
    if (elements.arrM) elements.arrM.disabled = !isMEnabled;
    if (elements.arrP) elements.arrP.disabled = !isPEnabled;
    if (elements.arrMSlider) elements.arrMSlider.disabled = !isMEnabled;
    if (elements.arrPSlider) elements.arrPSlider.disabled = !isPEnabled;
    
    const btnMMinus = document.getElementById('btn-arr-m-minus');
    const btnMPlus = document.getElementById('btn-arr-m-plus');
    const btnPMinus = document.getElementById('btn-arr-p-minus');
    const btnPPlus = document.getElementById('btn-arr-p-plus');
    if (btnMMinus) btnMMinus.disabled = !isMEnabled;
    if (btnMPlus) btnMPlus.disabled = !isMEnabled;
    if (btnPMinus) btnPMinus.disabled = !isPEnabled;
    if (btnPPlus) btnPPlus.disabled = !isPEnabled;
    
    const tdM = elements.arrM ? elements.arrM.closest('td') : null;
    const tdP = elements.arrP ? elements.arrP.closest('td') : null;
    if (tdM) {
        if (!isMEnabled) {
            tdM.classList.add('readonly');
            elements.arrM.value = 1;
            state.arrM = 1;
            if (elements.arrMSlider) elements.arrMSlider.value = 1;
        } else {
            tdM.classList.remove('readonly');
        }
    }
    
    if (tdP) {
        if (!isPEnabled) {
            tdP.classList.add('readonly');
        } else {
            tdP.classList.remove('readonly');
        }
    }

    document.querySelectorAll('.slider-nodes-container[data-target="roofH"] .slider-node-btn').forEach(btn => {
        btn.disabled = isGround;
    });
    document.querySelectorAll('.slider-nodes-container[data-target="roofTilt"] .slider-node-btn').forEach(btn => {
        btn.disabled = isGround || state.siteType === 'roof-flat';
    });
    document.querySelectorAll('.slider-nodes-container[data-target="arrM"] .slider-node-btn').forEach(btn => {
        btn.disabled = !isMEnabled;
    });
    document.querySelectorAll('.slider-nodes-container[data-target="arrP"] .slider-node-btn').forEach(btn => {
        btn.disabled = !isPEnabled;
    });
    
    // 坡向型式控制: 斜屋頂時將「雙斜V」mute / disable
    if (elements.chkPitchDoubleV) {
        elements.chkPitchDoubleV.disabled = isSlopeRoof;
        const parentLabel = elements.chkPitchDoubleV.closest('label') || elements.chkPitchDoubleV.parentElement;
        if (parentLabel) {
            parentLabel.style.opacity = isSlopeRoof ? '0.35' : '1';
            parentLabel.style.pointerEvents = isSlopeRoof ? 'none' : 'auto';
            parentLabel.style.cursor = isSlopeRoof ? 'not-allowed' : 'pointer';
        }
        if (isSlopeRoof && state.pitchStyle === 'double-v') {
            state.pitchStyle = 'double';
            if (elements.pitchStyle) elements.pitchStyle.value = 'double';
            if (elements.chkPitchDouble) elements.chkPitchDouble.checked = true;
            if (elements.chkPitchDoubleV) elements.chkPitchDoubleV.checked = false;
        }
    }
    
    updateSupportHLockState();
}

function updateSupportHLockState() {
    const isSlopeRoof = state.siteType === 'roof-slope';
    // 平鋪時角度鎖定邏輯處理
    const isFlatLaid = Math.abs(state.tilt - state.roofTilt) < 0.01;
    
    // Locked ONLY if Slope Roof AND flat-laid
    const shouldDisable = isSlopeRoof && isFlatLaid;
    
    elements.supportH.disabled = shouldDisable;
    elements.supportHSlider.disabled = shouldDisable;
    
    const minusBtn = document.getElementById('btn-support-minus');
    const plusBtn = document.getElementById('btn-support-plus');
    if (minusBtn) minusBtn.disabled = shouldDisable;
    if (plusBtn) plusBtn.disabled = shouldDisable;
    
    const td = elements.supportH.closest('td');
    if (shouldDisable) {
        td.classList.add('readonly');
    } else {
        td.classList.remove('readonly');
    }
}

function getBaseArrP() {
    const isPortrait = state.pvOrient === 'portrait';
    const pvW_term = isPortrait ? state.pvL : state.pvW; // in mm
    
    const isSpecialRoofSlopeFlatLandscape = 
        state.siteType === 'roof-slope' && 
        Math.abs(state.tilt - state.roofTilt) < 0.01 && 
        state.pvOrient === 'landscape';

    let totalSpY = 0;
    for (let r = 1; r < state.arrJ; r++) {
        totalSpY += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
    }
    
    let blockLength_sloped_mm = 0;
    if (state.pitchStyle === 'double' || state.pitchStyle === 'double-v') {
        const ridgeSp = (state.siteType === 'roof-slope') ? 1200 : 200; // dynamic ridge spacing in mm
        const numNeg = Math.ceil(state.arrJ / 2);
        const numPos = Math.floor(state.arrJ / 2);
        
        let totalSpY_neg = 0;
        for (let r = 1; r < numNeg; r++) {
            totalSpY_neg += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
        }
        let totalSpY_pos = 0;
        for (let r = 1; r < numPos; r++) {
            totalSpY_pos += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
        }

        const s_outer_neg = (numNeg > 0) ? -(ridgeSp / 2 + numNeg * pvW_term + totalSpY_neg) : ridgeSp / 2;
        const s_outer_pos = (numPos > 0) ? +(ridgeSp / 2 + numPos * pvW_term + totalSpY_pos) : -ridgeSp / 2;
        blockLength_sloped_mm = s_outer_pos - s_outer_neg;
    } else {
        blockLength_sloped_mm = state.arrJ * pvW_term + totalSpY;
    }
    
    const blockLength_m = blockLength_sloped_mm / 1000;
    return Number(blockLength_m.toFixed(1));
}

function updateArrPSliderRange() {
    if (!elements.arrP || !elements.arrPSlider) return;
    
    const isPortrait = state.pvOrient === 'portrait';
    const pvW_term = isPortrait ? state.pvL : state.pvW; // in mm
    
    const isSpecialRoofSlopeFlatLandscape = 
        state.siteType === 'roof-slope' && 
        Math.abs(state.tilt - state.roofTilt) < 0.01 && 
        state.pvOrient === 'landscape';

    let totalSpY = 0;
    for (let r = 1; r < state.arrJ; r++) {
        totalSpY += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
    }
    
    let blockLength_sloped_mm = 0;
    if (state.pitchStyle === 'double' || state.pitchStyle === 'double-v') {
        const ridgeSp = (state.siteType === 'roof-slope') ? 1200 : 200; // dynamic ridge spacing in mm
        const numNeg = Math.ceil(state.arrJ / 2);
        const numPos = Math.floor(state.arrJ / 2);
        
        let totalSpY_neg = 0;
        for (let r = 1; r < numNeg; r++) {
            totalSpY_neg += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
        }
        let totalSpY_pos = 0;
        for (let r = 1; r < numPos; r++) {
            totalSpY_pos += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
        }

        const s_outer_neg = (numNeg > 0) ? -(ridgeSp / 2 + numNeg * pvW_term + totalSpY_neg) : ridgeSp / 2;
        const s_outer_pos = (numPos > 0) ? +(ridgeSp / 2 + numPos * pvW_term + totalSpY_pos) : -ridgeSp / 2;
        blockLength_sloped_mm = s_outer_pos - s_outer_neg;
    } else {
        blockLength_sloped_mm = state.arrJ * pvW_term + totalSpY;
    }
    
    const blockLength_m = blockLength_sloped_mm / 1000;
    const minP = 1.0 * blockLength_m;
    const maxP = 2.5 * blockLength_m;
    
    elements.arrP.min = minP.toFixed(1);
    elements.arrP.max = maxP.toFixed(1);
    elements.arrP.step = "0.1";
    
    elements.arrPSlider.min = minP.toFixed(1);
    elements.arrPSlider.max = maxP.toFixed(1);
    elements.arrPSlider.step = "0.1";
    
    if (state.arrP < minP) {
        state.arrP = Number(minP.toFixed(1));
    } else if (state.arrP > maxP) {
        state.arrP = Number(maxP.toFixed(1));
    } else {
        state.arrP = Number(state.arrP.toFixed(1));
    }
    elements.arrP.value = state.arrP;
    elements.arrPSlider.value = state.arrP;
}

function latLngToLocal(latlng, referenceLat, referenceLng, azimuth) {
    const thetaRad = (-azimuth * Math.PI) / 180;
    const cosTheta = Math.cos(thetaRad);
    const sinTheta = Math.sin(thetaRad);
    
    const metersPerLatDegree = 111320;
    const latRad = (referenceLat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const ry = (latlng.lat - referenceLat) * metersPerLatDegree;
    const rx = (latlng.lng - referenceLng) * metersPerLngDegree;
    
    const localX = rx * cosTheta + ry * sinTheta;
    const localZ = rx * sinTheta - ry * cosTheta;
    return { x: localX, z: localZ };
}

function getShiftedLayoutCoords(params) {
    const config = params || state;
    const isPortrait = config.pvOrient === 'portrait';
    const pvW_term = isPortrait ? config.pvL : config.pvW;
    const pvL_term = isPortrait ? config.pvW : config.pvL;
    const pvL = pvL_term / 1000;
    const pvW = pvW_term / 1000;
    const spX = config.spX / 1000;
    const spY = config.spY / 1000;
    const tilt = config.tilt;
    const roofTilt = config.roofTilt || 0;
    const totalTiltRad = (tilt * Math.PI) / 180;
    const pitchStyle = config.pitchStyle || 'single';
    const siteType = config.siteType;
    const arrI = config.arrI;
    const arrJ = config.arrJ;
    const m = siteType === 'roof-slope' ? 1 : config.arrM;
    const arrP = config.arrP;
    const azimuth = config.azimuth;
    
    const refLat = config.lat !== undefined ? config.lat : state.lat;
    const refLng = config.lng !== undefined ? config.lng : state.lng;

    const isSpecialRoofSlopeFlatLandscape = 
        siteType === 'roof-slope' && 
        Math.abs(tilt - roofTilt) < 0.01 && 
        config.pvOrient === 'landscape';

    let totalSpX = 0;
    for (let c = 1; c < arrI; c++) {
        totalSpX += (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 0.75 : spX;
    }
    const arrayWidth = arrI * pvL + totalSpX;
    
    let totalSpY = 0;
    for (let r = 1; r < arrJ; r++) {
        totalSpY += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
    }

    const ridgeSp = (siteType === 'roof-slope') ? 1.2 : 0.2;
    
    let arrayLength = 0;
    let zOffset = 0;
    let halfLen = 0;
    let numNeg = 0;
    let numPos = 0;
    
    const isDoublePitch = (pitchStyle === 'double' || pitchStyle === 'double-v');
    
    if (isDoublePitch) {
        const azimuthRad = (azimuth * Math.PI) / 180;
        const isSouthSlopeZNeg = (Math.cos(azimuthRad) <= 0);
        const numSouth = (arrJ % 2 !== 0) ? (arrJ + 1) / 2 : arrJ / 2;
        const numNorth = arrJ - numSouth;
        numNeg = isSouthSlopeZNeg ? numSouth : numNorth;
        numPos = isSouthSlopeZNeg ? numNorth : numSouth;
        
        let totalSpY_neg = 0;
        for (let r = 1; r < numNeg; r++) {
            totalSpY_neg += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
        }
        let totalSpY_pos = 0;
        for (let r = 1; r < numPos; r++) {
            totalSpY_pos += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
        }
        
        const s_outer_neg = (numNeg > 0) ? -(ridgeSp / 2 + numNeg * pvW + totalSpY_neg) : (ridgeSp / 2);
        const s_outer_pos = (numPos > 0) ? +(ridgeSp / 2 + numPos * pvW + totalSpY_pos) : -(ridgeSp / 2);
        arrayLength = s_outer_pos - s_outer_neg;
        zOffset = (s_outer_pos + s_outer_neg) / 2 * Math.cos(totalTiltRad);
        halfLen = (arrayLength * Math.cos(totalTiltRad)) / 2;
    } else {
        arrayLength = arrJ * pvW + totalSpY;
        zOffset = 0;
        halfLen = (arrayLength * Math.cos(totalTiltRad)) / 2;
    }
    
    // Project all walkways to local coordinate space
    const activeWalkways = exclusionPolygons.filter(p => p.isWalkway).map(p => {
        const latlngs = getOuterRingLatLngs(p);
        if (!latlngs || latlngs.length < 2) return null;
        const A_local = latLngToLocal(latlngs[0], refLat, refLng, azimuth);
        const B_local = latLngToLocal(latlngs[1], refLat, refLng, azimuth);
        
        const dx = B_local.x - A_local.x;
        const dz = B_local.z - A_local.z;
        const isXAligned = Math.abs(dx) >= Math.abs(dz);
        
        const localA = { x: A_local.x, z: A_local.z };
        const localB = { x: B_local.x, z: B_local.z };
        
        if (isXAligned) {
            if (Math.abs(dx) > 0 && Math.abs(dz) / Math.abs(dx) < 0.268) {
                const avgZ = (localA.z + localB.z) / 2;
                localA.z = avgZ;
                localB.z = avgZ;
            }
        } else {
            if (Math.abs(dz) > 0 && Math.abs(dx) / Math.abs(dz) < 0.268) {
                const avgX = (localA.x + localB.x) / 2;
                localA.x = avgX;
                localB.x = avgX;
            }
        }
        
        return {
            A: localA,
            B: localB,
            isXAligned: isXAligned,
            width: p.walkwayWidth || 0.5,
            minX: Math.min(localA.x, localB.x),
            maxX: Math.max(localA.x, localB.x),
            minZ: Math.min(localA.z, localB.z),
            maxZ: Math.max(localA.z, localB.z)
        };
    }).filter(w => w !== null);

    const coords = [];
    for (let g = 0; g < m; g++) {
        coords[g] = { neg: [], pos: [], single: [] };
    }

    const pvW_z = pvW * Math.cos(totalTiltRad);
    
    // Precalculate unshifted normal X coordinates per column c
    const normalX_coords = [];
    let curX_normal = -arrayWidth / 2 + pvL / 2;
    normalX_coords[0] = curX_normal;
    for (let c = 1; c < arrI; c++) {
        const gapX = (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 0.75 : spX;
        curX_normal += (pvL + gapX);
        normalX_coords[c] = curX_normal;
    }

    let bound_z_center = 0;
    let hasCustomBoundZ = false;
    if (customSiteBoundary) {
        const latlngs = getOuterRingLatLngs(customSiteBoundary);
        if (latlngs && latlngs.length >= 3) {
            let minZ_b = Infinity, maxZ_b = -Infinity;
            for (let i = 0; i < latlngs.length; i++) {
                const pt = latLngToLocal(latlngs[i], refLat, refLng, azimuth);
                minZ_b = Math.min(minZ_b, pt.z);
                maxZ_b = Math.max(maxZ_b, pt.z);
            }
            if (minZ_b !== Infinity && maxZ_b !== -Infinity) {
                bound_z_center = (minZ_b + maxZ_b) / 2;
                hasCustomBoundZ = true;
            }
        }
    }

    // Step 1: Precalculate Z coordinates for each column c
    for (let c = 0; c < arrI; c++) {
        const localX_normal = normalX_coords[c];
        
        const moduleSequence = [];
        if (isDoublePitch) {
            for (let g = 0; g < m; g++) {
                const blockZ = (g - (m - 1) / 2) * arrP;
                let currentZ_neg = -(ridgeSp / 2 + pvW / 2);
                for (let r = 0; r < numNeg; r++) {
                    if (r > 0) {
                        const gapY = (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
                        currentZ_neg -= (pvW + gapY);
                    }
                    const s = currentZ_neg;
                    const centerZ = hasCustomBoundZ ? bound_z_center : -zOffset;
                    const rowZ_normal = s * Math.cos(totalTiltRad) + centerZ + blockZ;
                    moduleSequence.push({ g, isNeg: true, r, z_normal: rowZ_normal });
                }
                let currentZ_pos = +(ridgeSp / 2 + pvW / 2);
                for (let r = 0; r < numPos; r++) {
                    if (r > 0) {
                        const gapY = (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
                        currentZ_pos += (pvW + gapY);
                    }
                    const s = currentZ_pos;
                    const centerZ = hasCustomBoundZ ? bound_z_center : -zOffset;
                    const rowZ_normal = s * Math.cos(totalTiltRad) + centerZ + blockZ;
                    moduleSequence.push({ g, isNeg: false, r, z_normal: rowZ_normal });
                }
            }
        } else {
            for (let g = 0; g < m; g++) {
                const blockZ = (g - (m - 1) / 2) * arrP;
                let currentLocalZ = -halfLen + pvW / 2;
                for (let r = 0; r < arrJ; r++) {
                    if (r > 0) {
                        const gapY = (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 0.6 : spY;
                        currentLocalZ += (pvW + gapY);
                    }
                    const rowZ_normal = currentLocalZ * Math.cos(totalTiltRad) + blockZ;
                    moduleSequence.push({ g, isNeg: false, r, z_normal: rowZ_normal });
                }
            }
        }
        
        moduleSequence.sort((a, b) => a.z_normal - b.z_normal);
        
        let prevActualZ = null;
        
        for (let i = 0; i < moduleSequence.length; i++) {
            const mod = moduleSequence[i];
            const z_normal = mod.z_normal;
            
            if (i === 0) {
                mod.z_actual = z_normal;
            } else {
                const step_normal = z_normal - moduleSequence[i - 1].z_normal;
                let step_actual = step_normal;
                
                const prevTopEdgeZ = prevActualZ + pvW_z / 2;
                const currentTopEdgeZ = prevActualZ + step_normal + pvW_z / 2;
                
                let hasCrossing = false;
                let crossingWidth = 0.5;
                for (const w of activeWalkways) {
                    if (w.isXAligned) {
                        if (localX_normal >= w.minX && localX_normal <= w.maxX) {
                            const z_intersect = w.A.z + (localX_normal - w.A.x) * (w.B.z - w.A.z) / (w.B.x - w.A.x);
                            if (z_intersect > prevTopEdgeZ && z_intersect <= currentTopEdgeZ) {
                                hasCrossing = true;
                                crossingWidth = w.width;
                                break;
                            }
                        }
                    }
                }
                
                if (hasCrossing) {
                    const normalGap = (isSpecialRoofSlopeFlatLandscape && (mod.r % 10 === 0)) ? 0.6 : spY;
                    step_actual += (crossingWidth - normalGap) * Math.cos(totalTiltRad);
                }
                
                mod.z_actual = prevActualZ + step_actual;
            }
            
            prevActualZ = mod.z_actual;
        }
        
        for (const mod of moduleSequence) {
            const { g, isNeg, r } = mod;
            const key = isDoublePitch ? (isNeg ? 'neg' : 'pos') : 'single';
            if (!coords[g][key][r]) coords[g][key][r] = [];
            if (!coords[g][key][r][c]) coords[g][key][r][c] = {};
            coords[g][key][r][c].rowZ = mod.z_actual;
        }
    }

    // Step 2: Calculate X coordinates per row
    if (isDoublePitch) {
        for (let g = 0; g < m; g++) {
            for (let r = 0; r < numNeg; r++) {
                const rowZ_actual = coords[g]?.['neg']?.[r]?.[0]?.rowZ || 0;
                let prevActualX = null;
                for (let c = 0; c < arrI; c++) {
                    const localX_normal = normalX_coords[c];
                    let localX_val = localX_normal;
                    
                    if (c > 0) {
                        const normalGap = (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 0.75 : spX;
                        const step_normal = pvL + normalGap;
                        let step_actual = step_normal;
                        const prevRightEdgeX = prevActualX + pvL / 2;
                        const currentRightEdgeX = prevActualX + step_normal + pvL / 2;
                        
                        let hasCrossing = false;
                        let crossingWidth = 0.5;
                        for (const w of activeWalkways) {
                            if (!w.isXAligned) {
                                if (rowZ_actual >= w.minZ && rowZ_actual <= w.maxZ) {
                                    const x_intersect = w.A.x + (rowZ_actual - w.A.z) * (w.B.x - w.A.x) / (w.B.z - w.A.z);
                                    if (x_intersect > prevRightEdgeX && x_intersect <= currentRightEdgeX) {
                                        hasCrossing = true;
                                        crossingWidth = w.width;
                                        break;
                                    }
                                }
                            }
                        }
                        if (hasCrossing) {
                            step_actual += (crossingWidth - normalGap);
                        }
                        localX_val = prevActualX + step_actual;
                    }
                    
                    if (!coords[g]) coords[g] = {};
                    if (!coords[g]['neg']) coords[g]['neg'] = [];
                    if (!coords[g]['neg'][r]) coords[g]['neg'][r] = [];
                    if (!coords[g]['neg'][r][c]) coords[g]['neg'][r][c] = {};
                    coords[g]['neg'][r][c].localX = localX_val;
                    prevActualX = localX_val;
                }
            }
            for (let r = 0; r < numPos; r++) {
                const rowZ_actual = coords[g]?.['pos']?.[r]?.[0]?.rowZ || 0;
                let prevActualX = null;
                for (let c = 0; c < arrI; c++) {
                    const localX_normal = normalX_coords[c];
                    let localX_val = localX_normal;
                    
                    if (c > 0) {
                        const normalGap = (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 0.75 : spX;
                        const step_normal = pvL + normalGap;
                        let step_actual = step_normal;
                        const prevRightEdgeX = prevActualX + pvL / 2;
                        const currentRightEdgeX = prevActualX + step_normal + pvL / 2;
                        
                        let hasCrossing = false;
                        let crossingWidth = 0.5;
                        for (const w of activeWalkways) {
                            if (!w.isXAligned) {
                                if (rowZ_actual >= w.minZ && rowZ_actual <= w.maxZ) {
                                    const x_intersect = w.A.x + (rowZ_actual - w.A.z) * (w.B.x - w.A.x) / (w.B.z - w.A.z);
                                    if (x_intersect > prevRightEdgeX && x_intersect <= currentRightEdgeX) {
                                        hasCrossing = true;
                                        crossingWidth = w.width;
                                        break;
                                    }
                                }
                            }
                        }
                        if (hasCrossing) {
                            step_actual += (crossingWidth - normalGap);
                        }
                        localX_val = prevActualX + step_actual;
                    }
                    
                    if (!coords[g]) coords[g] = {};
                    if (!coords[g]['pos']) coords[g]['pos'] = [];
                    if (!coords[g]['pos'][r]) coords[g]['pos'][r] = [];
                    if (!coords[g]['pos'][r][c]) coords[g]['pos'][r][c] = {};
                    coords[g]['pos'][r][c].localX = localX_val;
                    prevActualX = localX_val;
                }
            }
        }
    } else {
        for (let g = 0; g < m; g++) {
            for (let r = 0; r < arrJ; r++) {
                const rowZ_actual = coords[g]?.['single']?.[r]?.[0]?.rowZ || 0;
                let prevActualX = null;
                for (let c = 0; c < arrI; c++) {
                    const localX_normal = normalX_coords[c];
                    let localX_val = localX_normal;
                    
                    if (c > 0) {
                        const normalGap = (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 0.75 : spX;
                        const step_normal = pvL + normalGap;
                        let step_actual = step_normal;
                        const prevRightEdgeX = prevActualX + pvL / 2;
                        const currentRightEdgeX = prevActualX + step_normal + pvL / 2;
                        
                        let hasCrossing = false;
                        let crossingWidth = 0.5;
                        for (const w of activeWalkways) {
                            if (!w.isXAligned) {
                                if (rowZ_actual >= w.minZ && rowZ_actual <= w.maxZ) {
                                    const x_intersect = w.A.x + (rowZ_actual - w.A.z) * (w.B.x - w.A.x) / (w.B.z - w.A.z);
                                    if (x_intersect > prevRightEdgeX && x_intersect <= currentRightEdgeX) {
                                        hasCrossing = true;
                                        crossingWidth = w.width;
                                        break;
                                    }
                                }
                            }
                        }
                        if (hasCrossing) {
                            step_actual += (crossingWidth - normalGap);
                        }
                        localX_val = prevActualX + step_actual;
                    }
                    
                    if (!coords[g]) coords[g] = {};
                    if (!coords[g]['single']) coords[g]['single'] = [];
                    if (!coords[g]['single'][r]) coords[g]['single'][r] = [];
                    if (!coords[g]['single'][r][c]) coords[g]['single'][r][c] = {};
                    coords[g]['single'][r][c].localX = localX_val;
                    prevActualX = localX_val;
                }
            }
        }
    }

    return coords;
}

function getMaxPossibleArrI() {
    if (customSiteBoundary) {
        const latlngs = getOuterRingLatLngs(customSiteBoundary);
        if (latlngs && latlngs.length >= 3) {
            let minX = Infinity, maxX = -Infinity;
            const refLat = state.lat;
            const refLng = state.lng;
            const azimuth = parseFloat(state.azimuth) || 180;
            for (const pt of latlngs) {
                const local = latLngToLocal(pt, refLat, refLng, azimuth);
                if (local.x < minX) minX = local.x;
                if (local.x > maxX) maxX = local.x;
            }
            const widthX = Math.max(0.1, maxX - minX);
            const isPortrait = state.pvOrient === 'portrait';
            const pvW_m = (isPortrait ? state.pvW : state.pvL) / 1000;
            const spX_m = (parseFloat(state.spX) || 20) / 1000;
            return Math.max(1, Math.min(1000, Math.ceil((widthX + spX_m) / (pvW_m + spX_m))));
        }
    }
    return 80;
}

function getMaxPossibleArrJ() {
    if (customSiteBoundary) {
        const latlngs = getOuterRingLatLngs(customSiteBoundary);
        if (latlngs && latlngs.length >= 3) {
            let minZ = Infinity, maxZ = -Infinity;
            const refLat = state.lat;
            const refLng = state.lng;
            const azimuth = parseFloat(state.azimuth) || 180;
            for (const pt of latlngs) {
                const local = latLngToLocal(pt, refLat, refLng, azimuth);
                if (local.z < minZ) minZ = local.z;
                if (local.z > maxZ) maxZ = local.z;
            }
            const lengthY = Math.max(0.1, maxZ - minZ);
            const isPortrait = state.pvOrient === 'portrait';
            const pvL_m = (isPortrait ? state.pvL : state.pvW) / 1000;
            const spY_m = (parseFloat(state.spY) || 20) / 1000;
            return Math.max(1, Math.min(1000, Math.ceil((lengthY + spY_m) / (pvL_m + spY_m))));
        }
    }
    return (state.siteType === 'roof-slope') ? 24 : 12;
}

function updateAllSliderNodesHighlight() {
    const targets = {
        arrI: state.arrI,
        arrJ: state.arrJ,
        arrM: state.arrM,
        spX: state.spX,
        spY: state.spY,
        tilt: state.tilt,
        roofTilt: state.roofTilt,
        roofH: state.roofH,
        supportH: state.supportH,
        azimuth: state.azimuth,
        sunMonth: state.sunMonth,
        sunHour: state.sunHour
    };
    
    document.querySelectorAll('.slider-nodes-container, .azimuth-nodes-container').forEach(container => {
        const targetKey = container.getAttribute('data-target') || 'azimuth';
        if (targetKey === 'arrP') {
            const baseP = getBaseArrP();
            const currentRatio = state.arrP / (baseP || 1);
            container.querySelectorAll('.slider-node-btn').forEach(btn => {
                const mult = parseFloat(btn.getAttribute('data-mult')) || (btn.getAttribute('data-val') === '1x' ? 1.0 : btn.getAttribute('data-val') === '1.3x' ? 1.3 : btn.getAttribute('data-val') === '1.6x' ? 1.6 : 1.0);
                if (Math.abs(currentRatio - mult) < 0.08) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        } else {
            const currentVal = targets[targetKey];
            if (currentVal !== undefined && currentVal !== null) {
                container.querySelectorAll('.slider-node-btn, .azimuth-node-btn').forEach(btn => {
                    const rawVal = btn.getAttribute('data-val');
                    let nodeVal = parseFloat(rawVal);
                    if (rawVal === 'max') {
                        if (targetKey === 'arrI') nodeVal = getMaxPossibleArrI();
                        else if (targetKey === 'arrJ') nodeVal = getMaxPossibleArrJ();
                    }
                    if (!isNaN(nodeVal) && Math.abs(currentVal - nodeVal) < 0.25) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        }
    });
}

function updateAzimuthNodesHighlight(val) {
    updateAllSliderNodesHighlight();
}

function calculateOutputs() {
    handleSiteTypeChangeUI();
    updateArrPSliderRange();
    updateAllSliderNodesHighlight();
    
    const m = state.siteType === 'roof-slope' ? 1 : state.arrM;
    const totalPossible = state.arrI * state.arrJ * m;
    
    let excludedCount = 0;
    if (exclusionPolygons.length > 0 || obstaclePolygons.length > 0 || customSiteBoundary) {
        const layoutCoords = getShiftedLayoutCoords(state);
        const isPortrait = state.pvOrient === 'portrait';
        const pvW_term = isPortrait ? state.pvL : state.pvW;
        const pvL_term = isPortrait ? state.pvW : state.pvL;
        const pvL = pvL_term / 1000;
        const pvW = pvW_term / 1000;
        const spX = state.spX / 1000;
        const spY = state.spY / 1000;
        const tilt = state.tilt;
        const totalTilt = tilt;
        const totalTiltRad = (totalTilt * Math.PI) / 180;
        
        let numNeg = 0;
        let numPos = 0;
        const isDoublePitch = (state.pitchStyle === 'double' || state.pitchStyle === 'double-v');
        if (isDoublePitch) {
            const azimuthRad = (state.azimuth * Math.PI) / 180;
            const isSouthSlopeZNeg = (Math.cos(azimuthRad) <= 0);
            const numSouth = (state.arrJ % 2 !== 0) ? (state.arrJ + 1) / 2 : state.arrJ / 2;
            const numNorth = state.arrJ - numSouth;
            numNeg = isSouthSlopeZNeg ? numSouth : numNorth;
            numPos = isSouthSlopeZNeg ? numNorth : numSouth;
        }
        
        for (let g = 0; g < m; g++) {
            if (isDoublePitch) {
                for (let r = 0; r < numNeg; r++) {
                    for (let c = 0; c < state.arrI; c++) {
                        const coord = layoutCoords[g]?.['neg']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                        if (isModuleExcluded(coord.localX, coord.rowZ, state)) {
                            excludedCount++;
                        }
                    }
                }
                for (let r = 0; r < numPos; r++) {
                    for (let c = 0; c < state.arrI; c++) {
                        const coord = layoutCoords[g]?.['pos']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                        if (isModuleExcluded(coord.localX, coord.rowZ, state)) {
                            excludedCount++;
                        }
                    }
                }
            } else {
                for (let r = 0; r < state.arrJ; r++) {
                    for (let c = 0; c < state.arrI; c++) {
                        const coord = layoutCoords[g]?.['single']?.[r]?.[c] || { localX: 0, rowZ: 0 };
                        if (isModuleExcluded(coord.localX, coord.rowZ, state)) {
                            excludedCount++;
                        }
                    }
                }
            }
        }
    }
    
    state.totalCount = totalPossible - excludedCount;
    state.totalPower = ((state.totalCount * state.pvP) / 1000).toFixed(2);
    
    const isPortrait = state.pvOrient === 'portrait';
    const pvL_term = isPortrait ? state.pvW : state.pvL;
    const pvW_term = isPortrait ? state.pvL : state.pvW;
    
    const isSpecialRoofSlopeFlatLandscape = 
        state.siteType === 'roof-slope' && 
        Math.abs(state.tilt - state.roofTilt) < 0.01 && 
        state.pvOrient === 'landscape';

    let totalSpX = 0;
    for (let c = 1; c < state.arrI; c++) {
        totalSpX += (isSpecialRoofSlopeFlatLandscape && c % 20 === 0) ? 750 : state.spX;
    }
    const totalW_mm = state.arrI * pvL_term + totalSpX;
    state.dimW = (totalW_mm / 1000).toFixed(2);

    let totalSpY = 0;
    for (let r = 1; r < state.arrJ; r++) {
        totalSpY += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
    }
    
    let blockLength_sloped_mm = 0;
    const isDoublePitch = (state.pitchStyle === 'double' || state.pitchStyle === 'double-v');
    if (isDoublePitch) {
        const ridgeSp = (state.siteType === 'roof-slope') ? 1200 : 200;
        const numNeg = Math.ceil(state.arrJ / 2);
        const numPos = Math.floor(state.arrJ / 2);
        
        let totalSpY_neg = 0;
        for (let r = 1; r < numNeg; r++) {
            totalSpY_neg += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
        }
        let totalSpY_pos = 0;
        for (let r = 1; r < numPos; r++) {
            totalSpY_pos += (isSpecialRoofSlopeFlatLandscape && r % 10 === 0) ? 600 : state.spY;
        }

        const s_outer_neg = (numNeg > 0) ? -(ridgeSp / 2 + numNeg * pvW_term + totalSpY_neg) : ridgeSp / 2;
        const s_outer_pos = (numPos > 0) ? +(ridgeSp / 2 + numPos * pvW_term + totalSpY_pos) : -ridgeSp / 2;
        blockLength_sloped_mm = s_outer_pos - s_outer_neg;
    } else {
        blockLength_sloped_mm = state.arrJ * pvW_term + totalSpY;
    }
    
    const totalTilt = state.tilt;
    const rad = (totalTilt * Math.PI) / 180;
    const blockLength_horizontal_mm = blockLength_sloped_mm * Math.cos(rad);
    
    const pitch_mm = state.arrP * 1000;
    const totalLength_horizontal_mm = (m - 1) * pitch_mm + blockLength_horizontal_mm;
    
    state.dimH = (totalLength_horizontal_mm / 1000).toFixed(2);
    
    elements.totalCount.value = state.totalCount;
    elements.totalPower.value = state.totalPower;
    elements.dimW.value = state.dimW;
    elements.dimH.value = state.dimH;
    updateSiteArea();
}

function updateAllVisuals(forceImmediate = false) {
    updateCoverage(state.lat, state.lng, parseFloat(state.dimW), parseFloat(state.dimH), state.azimuth, state.pitchStyle);
    
    if (forceImmediate) {
        if (throttled3DTimeout) {
            clearTimeout(throttled3DTimeout);
            throttled3DTimeout = null;
        }
        run3DUpdate();
    } else {
        triggerThrottled3DUpdate();
    }
}

function triggerThrottled3DUpdate() {
    const now = Date.now();
    const timeSinceLastUpdate = now - last3DUpdateTime;
    const throttleDelay = 80; // 80ms throttle is ~12 FPS, very responsive but smooth
    
    if (throttled3DTimeout) {
        return;
    }
    
    if (timeSinceLastUpdate >= throttleDelay) {
        run3DUpdate();
    } else {
        throttled3DTimeout = setTimeout(() => {
            run3DUpdate();
            throttled3DTimeout = null;
        }, throttleDelay - timeSinceLastUpdate);
    }
}

function run3DUpdate() {
    last3DUpdateTime = Date.now();
    if (!scene) return;
    updateViewer({
        siteType: state.siteType,
        pitchStyle: state.pitchStyle,
        pvOrient: state.pvOrient,
        pvL: state.pvL,
        pvW: state.pvW,
        arrI: state.arrI,
        arrJ: state.arrJ,
        arrM: state.arrM,
        arrP: state.arrP,
        spX: state.spX,
        spY: state.spY,
        tilt: state.tilt,
        roofTilt: state.roofTilt,
        roofH: state.roofH,
        supportH: state.supportH,
        azimuth: state.azimuth,
        lat: state.lat,
        lng: state.lng
    });
    
    // Update solar shadows simulation based on date/time/coords
    updateSunPosition(state.lat, state.lng, state.sunMonth, state.sunHour);
}

function handleMarkerDrag(newLat, newLng) {
    state.lat = parseFloat(newLat.toFixed(6));
    state.lng = parseFloat(newLng.toFixed(6));
    
    const dmsLat = convertToDMS(state.lat, true);
    const dmsLng = convertToDMS(state.lng, false);
    elements.coords.value = `${dmsLat} ${dmsLng}`;
    
    updateCoverage(state.lat, state.lng, parseFloat(state.dimW), parseFloat(state.dimH), state.azimuth, state.pitchStyle);
}

function initTouchScrollProtection() {
    const shield3D = document.getElementById('touch-shield-3d');
    const shieldMap = document.getElementById('touch-shield-map');
    const btnLock3D = document.getElementById('btn-touch-lock-3d');
    const btnLockMap = document.getElementById('btn-touch-lock-map');
    
    let is3DUnlocked = false;
    let isMapUnlocked = false;

    function updateShields() {
        const isMobile = window.innerWidth <= 768;
        if (shield3D) {
            if (isMobile && !is3DUnlocked) shield3D.classList.add('active');
            else shield3D.classList.remove('active');
        }
        if (shieldMap) {
            if (isMobile && !isMapUnlocked) shieldMap.classList.add('active');
            else shieldMap.classList.remove('active');
        }
    }

    if (shield3D && btnLock3D) {
        function toggle3D(e) {
            if (e) e.stopPropagation();
            is3DUnlocked = !is3DUnlocked;
            if (is3DUnlocked) {
                shield3D.classList.remove('active');
                btnLock3D.classList.add('unlocked');
                btnLock3D.innerHTML = '🔒 鎖定視圖';
            } else {
                shield3D.classList.add('active');
                btnLock3D.classList.remove('unlocked');
                btnLock3D.innerHTML = '🔓 解鎖 (旋轉 3D)';
            }
        }
        shield3D.addEventListener('click', toggle3D);
        btnLock3D.addEventListener('click', toggle3D);
    }

    if (shieldMap && btnLockMap) {
        function toggleMap(e) {
            if (e) e.stopPropagation();
            isMapUnlocked = !isMapUnlocked;
            if (isMapUnlocked) {
                shieldMap.classList.remove('active');
                btnLockMap.classList.add('unlocked');
                btnLockMap.innerHTML = '🔒 鎖定地圖';
            } else {
                shieldMap.classList.add('active');
                btnLockMap.classList.remove('unlocked');
                btnLockMap.innerHTML = '🔓 解鎖 (平移地圖)';
            }
        }
        shieldMap.addEventListener('click', toggleMap);
        btnLockMap.addEventListener('click', toggleMap);
    }

    window.addEventListener('resize', updateShields);
    updateShields();
}

/* ==========================================================================
   5. ?啗﹝???UI ?謕??秋撒???祆??鈭佇???(Spreadsheet UI Binding & Event Listeners)
   ========================================================================== */
/**
 * ?桀?? Excel ?啗﹝??萄??鈭? UI ??對?????哨?颲??蹓??幡 */
function setupEventListeners() {
    const inputs = [
        { el: elements.siteName, key: 'siteName', type: 'string' },
        { el: elements.pvL, key: 'pvL', type: 'float' },
        { el: elements.pvW, key: 'pvW', type: 'float' },
        { el: elements.pvP, key: 'pvP', type: 'float' },
        { el: elements.arrI, key: 'arrI', type: 'int' },
        { el: elements.arrJ, key: 'arrJ', type: 'int' },
        { el: elements.arrM, key: 'arrM', type: 'int' },
        { el: elements.arrP, key: 'arrP', type: 'float' },
        { el: elements.spX, key: 'spX', type: 'float' },
        { el: elements.spY, key: 'spY', type: 'float' },
        { el: elements.tilt, key: 'tilt', type: 'float' },
        { el: elements.roofTilt, key: 'roofTilt', type: 'float' },
        { el: elements.roofH, key: 'roofH', type: 'float' },
        { el: elements.supportH, key: 'supportH', type: 'float' },
        { el: elements.azimuth, key: 'azimuth', type: 'float' }
    ];
    
    inputs.forEach(item => {
        item.el.addEventListener('input', () => {
            let val = item.el.value;
            if (item.type === 'float') {
                val = parseFloat(val) || 0;
            } else if (item.type === 'int') {
                val = parseInt(val) || 0;
            }
            
            state[item.key] = val;
            
            // Sync sliders if values changed from text input
            if (item.key === 'tilt') {
                elements.tiltSlider.value = val;
                if (state.siteType === 'roof-slope') {
                    elements.roofTilt.value = val;
                    if (elements.roofTiltSlider) elements.roofTiltSlider.value = val;
                    state.roofTilt = val;
                }
                updateSupportHLockState();
            } else if (item.key === 'roofTilt') {
                elements.roofTiltSlider.value = val;
                if (state.siteType === 'roof-slope') {
                    elements.tilt.value = val;
                    if (elements.tiltSlider) elements.tiltSlider.value = val;
                    state.tilt = val;
                }
                updateSupportHLockState();
            } else if (item.key === 'roofH') {
                elements.roofHSlider.value = val;
            } else if (item.key === 'supportH') {
                elements.supportHSlider.value = val;
            } else if (item.key === 'azimuth') {
                elements.azimuthSlider.value = val;
                updateAzimuthNodesHighlight(val);
                if (customSiteBoundary) {
                    inferParametersFromSiteBoundary(customSiteBoundary, true);
                    return;
                }
            } else if (item.key === 'arrI') {
                elements.arrISlider.value = val;
            } else if (item.key === 'arrJ') {
                elements.arrJSlider.value = val;
            } else if (item.key === 'arrM') {
                elements.arrMSlider.value = val;
                handleSiteTypeChangeUI();
            } else if (item.key === 'spX') {
                if (elements.spXSlider) elements.spXSlider.value = val;
            } else if (item.key === 'spY') {
                if (elements.spYSlider) elements.spYSlider.value = val;
            }
            
            calculateOutputs();
            updateAllVisuals();
        });
    });
    
    const updatePitchStyleUI = (val) => {
        if (state.siteType === 'roof-slope' && val === 'double-v') {
            val = 'double';
        }
        state.pitchStyle = val;
        if (elements.pitchStyle) elements.pitchStyle.value = val;
        if (elements.chkPitchSingle) elements.chkPitchSingle.checked = (val === 'single');
        if (elements.chkPitchDouble) elements.chkPitchDouble.checked = (val === 'double');
        if (elements.chkPitchDoubleV) elements.chkPitchDoubleV.checked = (val === 'double-v');
        
        if (customSiteBoundary) {
            inferParametersFromSiteBoundary(customSiteBoundary);
        } else {
            calculateOutputs();
            updateAllVisuals();
        }
    };
    
    ['chkPitchSingle', 'chkPitchDouble', 'chkPitchDoubleV'].forEach(key => {
        if (elements[key]) {
            const getVal = () => key === 'chkPitchSingle' ? 'single' : (key === 'chkPitchDouble' ? 'double' : 'double-v');
            elements[key].addEventListener('change', () => {
                if (elements[key].checked) updatePitchStyleUI(getVal());
            });
            elements[key].addEventListener('click', () => {
                updatePitchStyleUI(getVal());
            });
        }
    });
    
    if (elements.pitchStyle) {
        elements.pitchStyle.addEventListener('change', (e) => {
            updatePitchStyleUI(e.target.value);
        });
    }
    
    elements.coords.addEventListener('input', () => {
        const parsed = parseDMS(elements.coords.value);
        if (parsed) {
            state.lat = parsed.lat;
            state.lng = parsed.lng;
            updateMarker(state.lat, state.lng);
            updateAllVisuals();
        }
    });
    
    elements.siteType.addEventListener('change', (e) => {
        state.siteType = e.target.value;
        
        if (state.siteType === 'roof-slope') {
            // Slope Roof (Pitched):
            // Default to Landscape, x=20mm, y=26mm, install tilt = 8, roof tilt = 8, roof height = 10m
            state.pvOrient = 'landscape';
            state.spX = 20;
            state.spY = 26;
            state.tilt = 8;
            state.roofTilt = 8;
            state.roofH = 10;
            state.arrM = 1;
            
            elements.pvOrient.value = 'landscape';
            elements.spX.value = 20;
            if (elements.spXSlider) elements.spXSlider.value = 20;
            elements.spY.value = 26;
            if (elements.spYSlider) elements.spYSlider.value = 26;
            elements.tilt.value = 8;
            elements.tiltSlider.value = 8;
            elements.roofTilt.value = 8;
            elements.roofTiltSlider.value = 8;
            elements.roofH.value = 10;
            elements.roofHSlider.value = 10;
            elements.arrM.value = 1;
            if (elements.arrMSlider) elements.arrMSlider.value = 1;
        } else {
            // Ground mount or Flat roof:
            // Default to Portrait, x=20mm, y=20mm, install tilt = 6, roof tilt = 0
            state.pvOrient = 'portrait';
            state.spX = 20;
            state.spY = 20;
            state.tilt = 6;
            state.roofTilt = 0;
            
            elements.pvOrient.value = 'portrait';
            elements.spX.value = 20;
            if (elements.spXSlider) elements.spXSlider.value = 20;
            elements.spY.value = 20;
            if (elements.spYSlider) elements.spYSlider.value = 20;
            elements.tilt.value = 6;
            elements.tiltSlider.value = 6;
            elements.roofTilt.value = 0;
            elements.roofTiltSlider.value = 0;
            
            if (state.siteType === 'roof-flat') {
                state.roofH = 10;
                elements.roofH.value = 10;
                if (elements.roofHSlider) elements.roofHSlider.value = 10;
            } else {
                state.roofH = 0;
                elements.roofH.value = 0;
                if (elements.roofHSlider) elements.roofHSlider.value = 0;
            }

            if (!customSiteBoundary) {
                state.arrJ = 4;
                elements.arrJ.value = 4;
                if (elements.arrJSlider) elements.arrJSlider.value = 4;
                state.azimuth = 180;
                elements.azimuth.value = 180;
                if (elements.azimuthSlider) elements.azimuthSlider.value = 180;
            }
        }
        
        handleSiteTypeChangeUI();
        updateSupportHLockState(); // Lock or unlock support height based on tilt and siteType
        if (customSiteBoundary) {
            inferParametersFromSiteBoundary(customSiteBoundary);
        } else {
            calculateOutputs();
            updateAllVisuals();
        }
    });
    
    elements.pvOrient.addEventListener('change', (e) => {
        state.pvOrient = e.target.value;
        if (customSiteBoundary) {
            inferParametersFromSiteBoundary(customSiteBoundary);
        } else {
            calculateOutputs();
            updateAllVisuals();
        }
    });
    
    // Slider inputs linked to number inputs
    elements.tiltSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        elements.tilt.value = val;
        state.tilt = val;
        if (state.siteType === 'roof-slope') {
            elements.roofTilt.value = val;
            if (elements.roofTiltSlider) elements.roofTiltSlider.value = val;
            state.roofTilt = val;
        }
        updateSupportHLockState();
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.roofTiltSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        elements.roofTilt.value = val;
        state.roofTilt = val;
        if (state.siteType === 'roof-slope') {
            elements.tilt.value = val;
            if (elements.tiltSlider) elements.tiltSlider.value = val;
            state.tilt = val;
        }
        updateSupportHLockState();
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.roofHSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        elements.roofH.value = val;
        state.roofH = val;
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.supportHSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        elements.supportH.value = val;
        state.supportH = val;
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.azimuthSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        elements.azimuth.value = val;
        state.azimuth = val;
        updateAzimuthNodesHighlight(val);
        if (customSiteBoundary) {
            inferParametersFromSiteBoundary(customSiteBoundary, true);
        } else {
            calculateOutputs();
            updateAllVisuals();
        }
    });
    
    elements.arrISlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 1;
        elements.arrI.value = val;
        state.arrI = val;
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.arrJSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 1;
        elements.arrJ.value = val;
        state.arrJ = val;
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.arrMSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 1;
        elements.arrM.value = val;
        state.arrM = val;
        handleSiteTypeChangeUI();
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.arrPSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 1.0;
        const roundedVal = Number(val.toFixed(1));
        elements.arrP.value = roundedVal;
        state.arrP = roundedVal;
        calculateOutputs();
        updateAllVisuals();
    });
    
    if (elements.spXSlider) {
        elements.spXSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            elements.spX.value = val;
            state.spX = val;
            calculateOutputs();
            updateAllVisuals();
        });
    }
    
    if (elements.spYSlider) {
        elements.spYSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value) || 0;
            elements.spY.value = val;
            state.spY = val;
            calculateOutputs();
            updateAllVisuals();
        });
    }
    
    if (elements.slider3DShadows) {
        elements.slider3DShadows.addEventListener('input', (e) => {
            const val = e.target.value;
            elements.slider3DShadows.setAttribute('value', val);
            state.showShadows = (val === '1');
            if (sunLight) {
                sunLight.castShadow = state.showShadows;
            }
        });
    }
    
    if (elements.slider3DSupports) {
        elements.slider3DSupports.addEventListener('input', (e) => {
            const val = e.target.value;
            elements.slider3DSupports.setAttribute('value', val);
            state.showSupports = (val === '1');
            const supGroup = scene ? scene.getObjectByName('supportGroup') : null;
            if (supGroup) {
                supGroup.visible = state.showSupports;
            } else {
                updateViewer(state);
            }
        });
    }
    
    // Helper function to link plus/minus buttons to sliders and numbers
    function setupSliderStepButtons(minusBtnId, plusBtnId, numberInputId, sliderInputId, step, min, max, stateKey) {
        const minusBtn = document.getElementById(minusBtnId);
        const plusBtn = document.getElementById(plusBtnId);
        const numInput = document.getElementById(numberInputId);
        const sliderInput = document.getElementById(sliderInputId);
        if (!minusBtn || !plusBtn) return;
        
        minusBtn.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch(e){} }
            const minVal = parseFloat(numInput.getAttribute('min')) !== null && !isNaN(parseFloat(numInput.getAttribute('min'))) ? parseFloat(numInput.getAttribute('min')) : min;
            let val = (parseFloat(numInput.value) || 0) - step;
            if (val < minVal) val = minVal;
            val = Number(val.toFixed(2));
            numInput.value = val;
            sliderInput.value = val;
            state[stateKey] = val;
            if (stateKey === 'tilt' || stateKey === 'roofTilt') {
                if (state.siteType === 'roof-slope') {
                    if (stateKey === 'tilt') {
                        elements.roofTilt.value = val;
                        if (elements.roofTiltSlider) elements.roofTiltSlider.value = val;
                        state.roofTilt = val;
                    } else {
                        elements.tilt.value = val;
                        if (elements.tiltSlider) elements.tiltSlider.value = val;
                        state.tilt = val;
                    }
                }
                updateSupportHLockState();
            }
            if (stateKey === 'arrM') handleSiteTypeChangeUI();
            if (stateKey === 'azimuth') updateAzimuthNodesHighlight(val);
            if (stateKey === 'azimuth' && customSiteBoundary) {
                inferParametersFromSiteBoundary(customSiteBoundary, true);
            } else {
                calculateOutputs();
                updateAllVisuals();
            }
        });
        
        plusBtn.addEventListener('click', () => {
            if (navigator.vibrate) { try { navigator.vibrate(10); } catch(e){} }
            const maxVal = parseFloat(numInput.getAttribute('max')) !== null && !isNaN(parseFloat(numInput.getAttribute('max'))) ? parseFloat(numInput.getAttribute('max')) : max;
            let val = (parseFloat(numInput.value) || 0) + step;
            if (val > maxVal) val = maxVal;
            val = Number(val.toFixed(2));
            numInput.value = val;
            sliderInput.value = val;
            state[stateKey] = val;
            if (stateKey === 'tilt' || stateKey === 'roofTilt') {
                if (state.siteType === 'roof-slope') {
                    if (stateKey === 'tilt') {
                        elements.roofTilt.value = val;
                        if (elements.roofTiltSlider) elements.roofTiltSlider.value = val;
                        state.roofTilt = val;
                    } else {
                        elements.tilt.value = val;
                        if (elements.tiltSlider) elements.tiltSlider.value = val;
                        state.tilt = val;
                    }
                }
                updateSupportHLockState();
            }
            if (stateKey === 'arrM') handleSiteTypeChangeUI();
            if (stateKey === 'azimuth') updateAzimuthNodesHighlight(val);
            if (stateKey === 'azimuth' && customSiteBoundary) {
                inferParametersFromSiteBoundary(customSiteBoundary, true);
            } else {
                calculateOutputs();
                updateAllVisuals();
            }
        });
    }
    
    setupSliderStepButtons('btn-tilt-minus', 'btn-tilt-plus', 'val-tilt', 'val-tilt-slider', 1, 0, 60, 'tilt');
    setupSliderStepButtons('btn-roof-minus', 'btn-roof-plus', 'val-roof-tilt', 'val-roof-tilt-slider', 1, 0, 45, 'roofTilt');
    setupSliderStepButtons('btn-roof-h-minus', 'btn-roof-h-plus', 'val-roof-h', 'val-roof-h-slider', 0.5, -Infinity, Infinity, 'roofH');
    setupSliderStepButtons('btn-support-minus', 'btn-support-plus', 'val-support-h', 'val-support-h-slider', 50, -Infinity, Infinity, 'supportH');
    setupSliderStepButtons('btn-azimuth-minus', 'btn-azimuth-plus', 'val-azimuth', 'val-azimuth-slider', 0.5, 0, 360, 'azimuth');
    setupSliderStepButtons('btn-azimuth-large-minus', 'btn-azimuth-large-plus', 'val-azimuth', 'val-azimuth-slider', 15, 0, 360, 'azimuth');
    setupSliderStepButtons('btn-arr-i-minus', 'btn-arr-i-plus', 'val-arr-i', 'val-arr-i-slider', 1, 1, 1000, 'arrI');
    setupSliderStepButtons('btn-arr-j-minus', 'btn-arr-j-plus', 'val-arr-j', 'val-arr-j-slider', 1, 1, 1000, 'arrJ');
    setupSliderStepButtons('btn-arr-m-minus', 'btn-arr-m-plus', 'val-arr-m', 'val-arr-m-slider', 1, 1, 50, 'arrM');
    setupSliderStepButtons('btn-arr-p-minus', 'btn-arr-p-plus', 'val-arr-p', 'val-arr-p-slider', 0.1, 1, 30, 'arrP');
    setupSliderStepButtons('btn-sp-x-minus', 'btn-sp-x-plus', 'val-sp-x', 'val-sp-x-slider', 1, 0, 1000, 'spX');
    setupSliderStepButtons('btn-sp-y-minus', 'btn-sp-y-plus', 'val-sp-y', 'val-sp-y-slider', 1, 0, 2000, 'spY');
    
    // Universal click handler for all shortcut slider node buttons
    document.querySelectorAll('.slider-nodes-container, .azimuth-nodes-container').forEach(container => {
        const targetKey = container.getAttribute('data-target') || 'azimuth';
        container.querySelectorAll('.slider-node-btn, .azimuth-node-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if (btn.disabled) return;
                if (navigator.vibrate) { try { navigator.vibrate(10); } catch(e){} }
                const rawVal = btn.getAttribute('data-val');
                let targetVal = parseFloat(rawVal);
                if (rawVal === 'max') {
                    if (targetKey === 'arrI') targetVal = getMaxPossibleArrI();
                    else if (targetKey === 'arrJ') targetVal = getMaxPossibleArrJ();
                }
                if (!isNaN(targetVal)) {
                    if (targetKey === 'arrI') {
                        elements.arrI.value = targetVal;
                        elements.arrISlider.value = targetVal;
                        state.arrI = targetVal;
                    } else if (targetKey === 'arrJ') {
                        elements.arrJ.value = targetVal;
                        elements.arrJSlider.value = targetVal;
                        state.arrJ = targetVal;
                    } else if (targetKey === 'arrM') {
                        elements.arrM.value = targetVal;
                        elements.arrMSlider.value = targetVal;
                        state.arrM = targetVal;
                        handleSiteTypeChangeUI();
                    } else if (targetKey === 'arrP') {
                        const mult = parseFloat(btn.getAttribute('data-mult')) || (btn.getAttribute('data-val') === '1x' ? 1.0 : btn.getAttribute('data-val') === '1.3x' ? 1.3 : btn.getAttribute('data-val') === '1.6x' ? 1.6 : 1.0);
                        const baseP = getBaseArrP();
                        const newP = Number((mult * baseP).toFixed(1));
                        state.arrP = newP;
                        if (elements.arrP) elements.arrP.value = newP;
                        if (elements.arrPSlider) elements.arrPSlider.value = newP;
                    } else if (targetKey === 'spX') {
                        elements.spX.value = targetVal;
                        elements.spXSlider.value = targetVal;
                        state.spX = targetVal;
                    } else if (targetKey === 'spY') {
                        elements.spY.value = targetVal;
                        elements.spYSlider.value = targetVal;
                        state.spY = targetVal;
                    } else if (targetKey === 'tilt') {
                        elements.tilt.value = targetVal;
                        elements.tiltSlider.value = targetVal;
                        state.tilt = targetVal;
                        if (state.siteType === 'roof-slope') {
                            elements.roofTilt.value = targetVal;
                            if (elements.roofTiltSlider) elements.roofTiltSlider.value = targetVal;
                            state.roofTilt = targetVal;
                        }
                    } else if (targetKey === 'roofTilt') {
                        elements.roofTilt.value = targetVal;
                        elements.roofTiltSlider.value = targetVal;
                        state.roofTilt = targetVal;
                        if (state.siteType === 'roof-slope') {
                            elements.tilt.value = targetVal;
                            if (elements.tiltSlider) elements.tiltSlider.value = targetVal;
                            state.tilt = targetVal;
                        }
                    } else if (targetKey === 'roofH') {
                        elements.roofH.value = targetVal;
                        elements.roofHSlider.value = targetVal;
                        state.roofH = targetVal;
                    } else if (targetKey === 'supportH') {
                        elements.supportH.value = targetVal;
                        elements.supportHSlider.value = targetVal;
                        state.supportH = targetVal;
                    } else if (targetKey === 'azimuth') {
                        elements.azimuth.value = targetVal;
                        elements.azimuthSlider.value = targetVal;
                        state.azimuth = targetVal;
                    } else if (targetKey === 'sunMonth') {
                        elements.sunMonthSlider.value = targetVal;
                        elements.sunMonthSlider.dispatchEvent(new Event('input'));
                        return;
                    } else if (targetKey === 'sunHour') {
                        elements.sunHourSlider.value = targetVal;
                        elements.sunHourSlider.dispatchEvent(new Event('input'));
                        return;
                    }
                    
                    if (targetKey === 'tilt' || targetKey === 'roofTilt') {
                        updateSupportHLockState();
                    }
                    
                    if (targetKey === 'azimuth' && customSiteBoundary) {
                        inferParametersFromSiteBoundary(customSiteBoundary, true);
                    } else {
                        calculateOutputs();
                        updateAllVisuals();
                    }
                }
            });
        });
    });
    
    // Sun simulator slider events
    elements.sunMonthSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value) || 12;
        state.sunMonth = val;
        
        const seasons = [
            "", 
            "1/21", 
            "2/21", 
            "3/21 (春分)", 
            "4/21", 
            "5/21", 
            "6/21 (夏至)", 
            "7/21", 
            "8/21", 
            "9/21 (秋分)", 
            "10/21", 
            "11/21", 
            "12/21 (冬至)"
        ];
        elements.sunMonthVal.innerText = seasons[val];
        
        updateSunPosition(state.lat, state.lng, state.sunMonth, state.sunHour);
        updateAllSliderNodesHighlight();
    });
    
    elements.sunHourSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 15.0;
        state.sunHour = val;
        
        const hh = Math.floor(val);
        const minsFraction = val - hh;
        let mm = "00";
        if (Math.abs(minsFraction - 0.25) < 0.01) mm = "15";
        else if (Math.abs(minsFraction - 0.5) < 0.01) mm = "30";
        else if (Math.abs(minsFraction - 0.75) < 0.01) mm = "45";
        
        elements.sunHourVal.innerText = `${hh.toString().padStart(2, '0')}:${mm}`;
        
        updateSunPosition(state.lat, state.lng, state.sunMonth, state.sunHour);
        updateAllSliderNodesHighlight();
    });

    // Sun simulator button click listeners
    const btnSunMonthMinus = document.getElementById('btn-sun-month-minus');
    const btnSunMonthPlus = document.getElementById('btn-sun-month-plus');
    const btnSunHourMinus = document.getElementById('btn-sun-hour-minus');
    const btnSunHourPlus = document.getElementById('btn-sun-hour-plus');
    
    if (btnSunMonthMinus && btnSunMonthPlus) {
        btnSunMonthMinus.addEventListener('click', () => {
            let val = parseInt(elements.sunMonthSlider.value) - 1;
            if (val < 1) val = 1;
            elements.sunMonthSlider.value = val;
            elements.sunMonthSlider.dispatchEvent(new Event('input'));
        });
        btnSunMonthPlus.addEventListener('click', () => {
            let val = parseInt(elements.sunMonthSlider.value) + 1;
            if (val > 12) val = 12;
            elements.sunMonthSlider.value = val;
            elements.sunMonthSlider.dispatchEvent(new Event('input'));
        });
    }
    
    if (btnSunHourMinus && btnSunHourPlus) {
        btnSunHourMinus.addEventListener('click', () => {
            let val = parseFloat(elements.sunHourSlider.value) - 0.25;
            if (val < 6.0) val = 6.0;
            elements.sunHourSlider.value = val;
            elements.sunHourSlider.dispatchEvent(new Event('input'));
        });
        btnSunHourPlus.addEventListener('click', () => {
            let val = parseFloat(elements.sunHourSlider.value) + 0.25;
            if (val > 18.0) val = 18.0;
            elements.sunHourSlider.value = val;
            elements.sunHourSlider.dispatchEvent(new Event('input'));
        });
    }
    
    elements.pvSelect.addEventListener('change', (e) => {
        state.pvPreset = e.target.value;
        
        if (state.pvPreset !== 'custom') {
            const preset = pvPresets[state.pvPreset];
            state.pvL = preset.l;
            state.pvW = preset.w;
            state.pvP = preset.p;
            
            elements.pvL.value = preset.l;
            elements.pvW.value = preset.w;
            elements.pvP.value = preset.p;
        }
        
        handlePvPresetChangeUI();
        calculateOutputs();
        updateAllVisuals();
    });
    
    elements.btnViewReset.addEventListener('click', resetCamera);
    elements.btnViewTop.addEventListener('click', topView);
    elements.btnViewSide.addEventListener('click', sideView);
    elements.btnViewFit.addEventListener('click', zoomToFit);
    
    elements.btnMapCenter.addEventListener('click', () => {
        centerMap(state.lat, state.lng);
    });
    
    // Geolocation GPS tracking button
    elements.btnMapMyLocation.addEventListener("click", () => {
        if (!navigator.geolocation) {
            alert("\u60a8\u7684\u700f\u89bd\u5668\u4e0d\u652f\u63f4\u5730\u7406\u5b9a\u4f4d\u529f\u80fd\uff0c\u6216\u6b64\u529f\u80fd\u5df2\u88ab\u700f\u89bd\u5668\u5c01\u9396\uff08\u8acb\u78ba\u8a8d\u7db2\u5740\u662f\u5426\u70ba HTTPS \u6216\u662f localhost\uff09\uff01");
            return;
        }
        
        elements.btnMapMyLocation.disabled = true;
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const newLat = position.coords.latitude;
                const newLng = position.coords.longitude;
                
                state.lat = parseFloat(newLat.toFixed(6));
                state.lng = parseFloat(newLng.toFixed(6));
                
                const dmsLat = convertToDMS(state.lat, true);
                const dmsLng = convertToDMS(state.lng, false);
                elements.coords.value = dmsLat + " " + dmsLng;
                
                updateMarker(state.lat, state.lng);
                centerMap(state.lat, state.lng);
                updateAllVisuals();
                
                elements.btnMapMyLocation.disabled = false;
            },
            (error) => {
                console.error("Geolocation error:", error);
                let msg = "\u5b9a\u4f4d\u5931\u6557\uff1a\u8acb\u6aa2\u67e5\u88dd\u7f6e\u6b0a\u9650\u8207\u7db2\u8def\u9023\u7dda\u72c0\u614b\u3002";
                if (window.location.protocol === "file:") {
                    msg += "\n\n\u63d0\u793a\uff1a\u700f\u89bd\u5668\u57fa\u65bc\u5b89\u5168\u6027\u9650\u5236\uff0c\u76f4\u63a5\u958b\u555f\u672c\u6a5f\u6a94\u6848 (file://) \u6642\u901a\u5e38\u6703\u963b\u64cb GPS \u5b9a\u4f4d\u3002\u5efa\u8b70\u5728\u7db2\u5740\u5217\u4f7f\u7528 HTTPS \u6216\u900f\u904e Local Server \u958b\u555f\uff01";
                }
                alert(msg);
                elements.btnMapMyLocation.disabled = false;
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
    
function showToast(message, type) {
    if (!type) type = "success";
    let toast = document.getElementById("pv-toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "pv-toast";
        toast.className = "pv-toast-notification";
        document.body.appendChild(toast);
    }
    
    const icon = type === "success" ? "\u2705" : "\u26a0\ufe0f";
    toast.className = "pv-toast-notification " + type;
    toast.innerHTML = "<span style=\"font-size: 1.1rem;\">" + icon + "</span><span>" + message + "</span>";
    
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });
    
    if (toast._timer) clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3200);
}

    if (elements.btnSaveDefault) {
        elements.btnSaveDefault.addEventListener("click", async () => {
            if (navigator.vibrate) { try { navigator.vibrate(15); } catch(e){} }
            const defaults = {
                siteName: (elements.siteName ? elements.siteName.value : state.siteName) || "\u66dc\u6607\u7da0\u80fd No.1",
                siteType: elements.siteType.value,
                pitchStyle: elements.pitchStyle.value,
                pvOrient: elements.pvOrient.value,
                pvPreset: elements.pvSelect.value,
                pvL: parseInt(elements.pvL.value) || 1722,
                pvW: parseInt(elements.pvW.value) || 1134,
                pvP: parseInt(elements.pvP.value) || 450,
                arrI: parseInt(elements.arrI.value) || 20,
                arrJ: parseInt(elements.arrJ.value) || 4,
                arrM: parseInt(elements.arrM.value) || 1,
                arrP: parseFloat(elements.arrP.value) || 1.0,
                spX: parseInt(elements.spX.value) || 20,
                spY: parseInt(elements.spY.value) || 20,
                tilt: parseFloat(elements.tilt.value) || 6,
                roofTilt: parseFloat(elements.roofTilt.value) || 0,
                roofH: parseFloat(elements.roofH.value) || 0,
                supportH: parseFloat(elements.supportH.value) || 2000,
                azimuth: parseFloat(elements.azimuth.value) || 180,
                coords: elements.coords.value,
                lat: state.lat,
                lng: state.lng,
                sunMonth: parseInt(elements.sunMonthSlider.value) || 12,
                sunHour: parseFloat(elements.sunHourSlider.value) || 9.0
            };
            
            localStorage.setItem("solar_layout_custom_defaults", JSON.stringify(defaults));
            
            try {
                const res = await fetch("/api/save-defaults", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(defaults, null, 4)
                });
                
                if (res.ok) {
                    showToast("\u5df2\u6210\u529f\u5beb\u5165\u6848\u5834 defaults.json\uff0c\u4e0b\u6b21\u958b\u555f\u5c07\u76f4\u63a5\u4ee5\u6b64\u7d44\u8a2d\u5b9a\u503c\u70ba\u9810\u8a2d\uff01", "success");
                    return;
                }
            } catch (err) {
                console.warn("POST /api/save-defaults \u5931\u6557\uff0c\u4f7f\u7528 LocalStorage:", err);
            }
            
            showToast("\u5df2\u5132\u5b58\u76ee\u524d\u53c3\u6578\u8a2d\u5b9a\u81f3\u700f\u89bd\u5668\u9810\u8a2d\uff01", "success");
        });
    }
    
    elements.btnReset.addEventListener("click", () => {
        if (confirm("\u78ba\u5b9a\u8981\u9084\u539f\u6240\u6709\u8a2d\u8a08\u53c3\u6578\u70ba\u9810\u8a2d\u503c\u55ce\uff1f")) {
            let defaults = {
                siteName: "??蝬 1?",
                siteType: "ground",
                pitchStyle: "single",
                pvOrient: "portrait",
                pvPreset: "preset-vsun450",
                pvL: 1722,
                pvW: 1134,
                pvP: 450,
                arrI: 20,
                arrJ: 4,
                arrM: 1,
                arrP: 1.0,
                spX: 20,
                spY: 20,
                tilt: 6,
                roofTilt: 0,
                roofH: 10.0,
                supportH: 2000,
                azimuth: 180.0,
                coords: "23簞52'12.7\"N 120簞31'22.8\"E",
                lat: 23.870194444444444,
                lng: 120.523,
                sunMonth: 12,
                sunHour: 15.0
            };
            
            const saved = localStorage.getItem('solar_layout_custom_defaults');
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.sunMonth === 6) parsed.sunMonth = 12;
                    defaults = { ...defaults, ...parsed };
                } catch (e) {
                    console.error("Error parsing custom defaults: ", e);
                }
            }
            
            applyDefaultsIntoDOM(defaults);
            
            if (elements.sunMonthSlider) elements.sunMonthSlider.dispatchEvent(new Event('input'));
            if (elements.sunHourSlider) elements.sunHourSlider.dispatchEvent(new Event('input'));
            
            // Clear active selection first to avoid style/popup issues on removed layers
            clearActivePolygonSelection();
            
            // Clear site boundary
            if (customSiteBoundary) {
                map.removeLayer(customSiteBoundary);
                customSiteBoundary = null;
            }
            clearSiteBoundaryDrawingState();
            
            // Clear exclusion polygons
            exclusionPolygons.forEach(p => map.removeLayer(p));
            exclusionPolygons = [];
            clearExclusionDrawingState();
            exitExclusionDrawMode();
            
            // Clear obstacle polygons
            obstaclePolygons.forEach(p => map.removeLayer(p));
            obstaclePolygons = [];
            clearObstacleDrawingState();
            exitObstacleDrawMode();
            
            // Reset planning mode states
            setPlanningModeState('site', 'locked');
            setPlanningModeState('exclusion', 'locked');
            setPlanningModeState('obstacle', 'locked');
            
            syncStateFromDOM();
            handleSiteTypeChangeUI();
            updateSupportHLockState();
            calculateOutputs();
            updateMarker(state.lat, state.lng);
            centerMap(state.lat, state.lng);
            updateAllVisuals();
        }
    });
    
    elements.btnExportJson.addEventListener('click', async () => {
        const siteName = (state && state.siteName) ? state.siteName.trim() : '??蝬獢';
        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hhmmss = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const fileName = `${siteName}_${yyyymmdd}_${hhmmss}.json`;
        
        const jsonContent = JSON.stringify(state, null, 4);
        await saveFileWithPicker(jsonContent, fileName, 'application/json');
    });
    
    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
        btnExportPdf.addEventListener('click', exportSlideshowPDF);
    }
    
    // ------------------------------------------
    // Measurement Tape Event Listeners
    // ------------------------------------------
    const btnMeasure = document.getElementById('btn-measure');
    if (btnMeasure) {
        btnMeasure.addEventListener('click', toggleMeasureMode);
    }
    
    if (elements.btnMapMeasure) {
        elements.btnMapMeasure.addEventListener('click', toggleMapMeasureMode);
    }
    
    // Planning controls event listeners
    if (elements.btnSiteBoundary) {
        elements.btnSiteBoundary.addEventListener('click', () => {
            const next = siteBoundaryState === 'locked' ? 'edit' : 'locked';
            switchPlanningMode('site', next);
        });
    }
    
    if (elements.btnExclusionZone) {
        elements.btnExclusionZone.addEventListener('click', () => {
            const next = exclusionState === 'locked' ? 'edit' : 'locked';
            switchPlanningMode('exclusion', next);
        });
    }
    
    if (elements.btnObstacleZone) {
        elements.btnObstacleZone.addEventListener('click', () => {
            const next = obstacleState === 'locked' ? 'edit' : 'locked';
            switchPlanningMode('obstacle', next);
        });
    }
    
    
    if (elements.btnRedrawSiteTrigger) {
        elements.btnRedrawSiteTrigger.addEventListener('click', () => {
            if (customSiteBoundary) {
                map.removeLayer(customSiteBoundary);
                customSiteBoundary = null;
            }
            clearSiteBoundaryDrawingState();
            updateSiteBoundaryDrawState();
            updateMarkerDragStates();
        });
    }

    if (elements.btnAddExclusionTrigger) {
        elements.btnAddExclusionTrigger.addEventListener('click', () => {
            elements.btnAddExclusionTrigger.style.display = 'none';
            enterExclusionDrawMode();
        });
    }
    
    if (elements.btnAddObstacleTrigger) {
        elements.btnAddObstacleTrigger.addEventListener('click', () => {
            elements.btnAddObstacleTrigger.style.display = 'none';
            enterObstacleDrawMode();
        });
    }
    
    const btnSiteCancel = document.getElementById('btn-site-cancel');
    if (btnSiteCancel) {
        btnSiteCancel.addEventListener('click', () => {
            switchPlanningMode('site', 'locked');
        });
    }

    if (elements.btnExCancel) {
        elements.btnExCancel.addEventListener('click', () => {
            switchPlanningMode('exclusion', 'locked');
        });
    }
    
    if (elements.btnObsCancel) {
        elements.btnObsCancel.addEventListener('click', () => {
            switchPlanningMode('obstacle', 'locked');
        });
    }
    
    // Helper to register label clicks
    const registerLabelClicks = (editId, lockId, mode) => {
        const lblEdit = document.getElementById(editId);
        const lblLock = document.getElementById(lockId);
        if (lblEdit) {
            lblEdit.addEventListener('click', () => {
                switchPlanningMode(mode, 'edit');
            });
        }
        if (lblLock) {
            lblLock.addEventListener('click', () => {
                switchPlanningMode(mode, 'locked');
            });
        }
    };
    
    registerLabelClicks('lbl-site-edit', 'lbl-site-lock', 'site');
    registerLabelClicks('lbl-ex-edit', 'lbl-ex-lock', 'exclusion');
    registerLabelClicks('lbl-obs-edit', 'lbl-obs-lock', 'obstacle');
    
    // Helper for slider click and drag (supports mobile touch, drag, input, and change events)
    const setupToggleSlider = (sliderElement, mode, getStateFunc) => {
        if (!sliderElement) return;
        
        const syncSliderChange = () => {
            const val = parseInt(sliderElement.value);
            const targetState = (val === 0) ? 'edit' : 'locked';
            if (getStateFunc() !== targetState) {
                switchPlanningMode(mode, targetState);
            }
        };

        sliderElement.addEventListener('click', (e) => {
            const currentState = getStateFunc();
            const next = currentState === 'locked' ? 'edit' : 'locked';
            switchPlanningMode(mode, next);
        });
        sliderElement.addEventListener('change', syncSliderChange);
        sliderElement.addEventListener('input', syncSliderChange);
    };
    
    setupToggleSlider(elements.sliderSite, 'site', () => siteBoundaryState);
    setupToggleSlider(elements.sliderExclusion, 'exclusion', () => exclusionState);
    setupToggleSlider(elements.sliderObstacle, 'obstacle', () => obstacleState);
    
    const obsHInput = document.getElementById('val-obs-h');
    const obsHSlider = document.getElementById('val-obs-h-slider');
    if (obsHInput && obsHSlider) {
        obsHSlider.addEventListener('input', () => {
            const val = parseFloat(obsHSlider.value) || 5.0;
            obsHInput.value = val.toFixed(1);
            if (activeSelectedPolygon && activeSelectedPolygon.isObstacle) {
                activeSelectedPolygon.obstacleHeight = val;
                const handle = document.querySelector('.toolbox-drag-handle');
                if (handle) handle.innerHTML = `障礙物 (${val.toFixed(1)}m) ⋮⋮`;
                calculateOutputs();
                updateAllVisuals(true);
            }
        });
        obsHInput.addEventListener('input', () => {
            let val = parseFloat(obsHInput.value) || 5.0;
            if (val >= 1 && val <= 20) {
                obsHSlider.value = val;
            }
            if (activeSelectedPolygon && activeSelectedPolygon.isObstacle) {
                activeSelectedPolygon.obstacleHeight = val;
                const handle = document.querySelector('.toolbox-drag-handle');
                if (handle) handle.innerHTML = `障礙物 (${val.toFixed(1)}m) ⋮⋮`;
                calculateOutputs();
                updateAllVisuals(true);
            }
        });
        obsHInput.addEventListener('change', () => {
            let val = parseFloat(obsHInput.value) || 5.0;
            val = Math.max(0.5, Math.min(100, val));
            obsHInput.value = val.toFixed(1);
            if (val >= 1 && val <= 20) {
                obsHSlider.value = val;
            }
            if (activeSelectedPolygon && activeSelectedPolygon.isObstacle) {
                activeSelectedPolygon.obstacleHeight = val;
                const handle = document.querySelector('.toolbox-drag-handle');
                const onRoofLabel = (activeSelectedPolygon.isOnRoof !== false && state.siteType !== 'ground') ? ' [建物上]' : '';
                if (handle) handle.innerHTML = `障礙物 (${val.toFixed(1)}m)${onRoofLabel} ⋮⋮`;
                calculateOutputs();
                updateAllVisuals(true);
            }
        });
    }
    
    const obsOnRoofChk = document.getElementById('chk-obs-on-roof');
    if (obsOnRoofChk) {
        obsOnRoofChk.addEventListener('change', () => {
            if (activeSelectedPolygon && activeSelectedPolygon.isObstacle) {
                activeSelectedPolygon.isOnRoof = obsOnRoofChk.checked;
                const handle = document.querySelector('.toolbox-drag-handle');
                const onRoofLabel = (activeSelectedPolygon.isOnRoof && state.siteType !== 'ground') ? ' [建物上]' : '';
                const hVal = (activeSelectedPolygon.obstacleHeight || 5.0).toFixed(1);
                if (handle) handle.innerHTML = `障礙物 (${hVal}m)${onRoofLabel} ⋮⋮`;
                calculateOutputs();
                updateAllVisuals(true);
            }
        });
    }
    
    const btnNormal = document.getElementById('btn-view-normal');
    if (btnNormal) {
        btnNormal.addEventListener('click', toggleNormalMode);
    }
    
    const chkX = document.getElementById('chk-lock-x');
    const chkY = document.getElementById('chk-lock-y');
    const chkZ = document.getElementById('chk-lock-z');
    if (chkX && chkY && chkZ) {
        chkX.addEventListener('change', () => { if (chkX.checked) { chkY.checked = false; chkZ.checked = false; } });
        chkY.addEventListener('change', () => { if (chkY.checked) { chkX.checked = false; chkZ.checked = false; } });
        chkZ.addEventListener('change', () => { if (chkZ.checked) { chkX.checked = false; chkY.checked = false; } });
    }
    
    initTouchScrollProtection();
    
    const canvas3D = renderer.domElement;
    
    // Use browser native click event to bypass OrbitControls drag event eating, 
    // ensuring 100% responsive point selection in capture phase.
    canvas3D.addEventListener('click', (e) => {
        if (e.button !== 0) return; // Only LEFT button click
        
        const rect = canvas3D.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        if (isNormalMode) {
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // Collect meshes to click on (ignoring helpers, ground, measurement elements)
            const targets = [];
            scene.traverse(node => {
                if (node.isMesh && node !== ground && node !== snapIndicator && (!node.name || !node.name.startsWith('measure')) && node.geometry) {
                    targets.push(node);
                }
            });
            
            const intersects = raycaster.intersectObjects(targets, true);
            if (intersects.length > 0) {
                const intersect = intersects[0];
                if (intersect.face) {
                    // 1. Get face normal and transform to world space
                    const normal = intersect.face.normal.clone();
                    const worldNormal = normal.transformDirection(intersect.object.matrixWorld).normalize();
                    
                    // 2. Compute bounding box center and size
                    const box = new THREE.Box3();
                    pvGroup.traverse(node => {
                        if (node.isMesh && node.visible && node !== snapIndicator) {
                            box.expandByObject(node);
                        }
                    });
                    if (box.isEmpty()) box.setFromObject(pvGroup);
                    
                    const center = new THREE.Vector3();
                    box.getCenter(center);
                    
                    const size = new THREE.Vector3();
                    box.getSize(size);
                    const maxDim = Math.max(size.x, size.y, size.z);
                    
                    // 3. Compute fit distance based on fov and aspect
                    const fov = camera.fov;
                    const aspect = camera.aspect;
                    const fovRad = (fov * Math.PI) / 180;
                    const distanceVert = (maxDim / 2) / Math.tan(fovRad / 2);
                    const distanceHoriz = (maxDim / 2) / (Math.tan(fovRad / 2) * aspect);
                    let distance = Math.max(distanceVert, distanceHoriz) * 1.15; // 15% margin margin
                    distance = Math.max(5, Math.min(200, distance));
                    
                    // 4. Position camera along the normal vector and focus on bounding box center
                    camera.position.copy(center).add(worldNormal.multiplyScalar(distance));
                    controls.target.copy(center);
                    controls.update();
                }
            }
            exitNormalMode();
            return;
        }
        
        if (isMeasureMode) {
            const snap = findSnapPoint(mouse);
            if (snap && snap.point) {
                handleMeasureClick(snap.point.clone());
            }
        }
    }, true);
    
    canvas3D.addEventListener('mousemove', (e) => {
        if (!isMeasureMode) return;
        
        const rect = canvas3D.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        const snap = findSnapPoint(mouse);
        if (snap) {
            snappedPoint = snap.point;
            snapIndicator.position.copy(snappedPoint);
            snapIndicator.visible = true;
            
            // Visual feedback on snapping type (Solid core color & opacity feedback)
            if (snap.type === 'endpoint') {
                snapIndicator.material.color.setHex(0x22c55e); // Green
                snapIndicator.material.opacity = 0.85;
            } else if (snap.type === 'midpoint') {
                snapIndicator.material.color.setHex(0x0ea5e9); // Blue
                snapIndicator.material.opacity = 0.85;
            } else if (snap.type === 'center') {
                snapIndicator.material.color.setHex(0xeab308); // Yellow
                snapIndicator.material.opacity = 0.85;
            } else {
                snapIndicator.material.color.setHex(0xa8a29e); // Gray
                snapIndicator.material.opacity = 0.45;
            }
            
            if (measurePoints.length === 1) {
                updateRubberband(measurePoints[0], snappedPoint);
            }
        } else {
            snappedPoint = null;
            snapIndicator.visible = false;
        }
    }, true);
    
    // Press Esc to exit measure mode and clear dimensions
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (isRightAngleSnapActive) {
                isRightAngleSnapBypassed = true;
                isRightAngleSnapActive = false;
                clearRightAngleIndicator();
                if (lastMouseMoveEvent) {
                    if (isSiteBoundaryDrawMode) handleSiteBoundaryMouseMove(lastMouseMoveEvent);
                    else if (isObstacleDrawMode) handleObstacleMouseMove(lastMouseMoveEvent);
                    else if (isExclusionDrawMode && currentExclusionTool === 'polygon') handleExclusionMouseMove(lastMouseMoveEvent);
                }
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            if (isMeasureMode) {
                exitMeasureMode();
            }
            if (isMapMeasureMode) {
                exitMapMeasureMode();
            }
            if (isSiteBoundaryDrawMode) {
                clearSiteBoundaryDrawingState();
                updateSiteBoundaryDrawState();
            }
            if (isExclusionDrawMode) {
                clearExclusionDrawingState();
                exitExclusionDrawMode();
            }
            if (isObstacleDrawMode) {
                clearObstacleDrawingState();
                exitObstacleDrawMode();
            }
        }
        if (e.key === 'Delete' || e.key === 'Del') {
            if (activeSelectedPolygon) {
                const poly = activeSelectedPolygon;
                map.removeLayer(poly);
                if (poly === customSiteBoundary) {
                    customSiteBoundary = null;
                    if (siteBoundaryState === 'edit') {
                        clearSiteBoundaryDrawingState();
                        updateSiteBoundaryDrawState();
                    }
                    updateMarkerDragStates();
                } else if (poly.isObstacle) {
                    obstaclePolygons = obstaclePolygons.filter(p => p !== poly);
                } else {
                    if (poly.isSubstation) {
                        clearSubstationEditHandles();
                    }
                    exclusionPolygons = exclusionPolygons.filter(p => p !== poly);
                }
                activeSelectedPolygon = null;
                map.closePopup();
                calculateOutputs();
                updateAllVisuals(true);
            }
        }
    });
    
    // Custom zoom to mouse pointer (wheel event)
    canvas3D.addEventListener('wheel', (e) => {
        if (!camera || !controls || !scene) return;
        
        if (customActiveCamera && customActiveCamera.isOrthographicCamera) {
            const factor = e.deltaY > 0 ? 0.92 : 1.08;
            customActiveCamera.zoom *= factor;
            if (customActiveCamera.zoom < 0.1) customActiveCamera.zoom = 0.1;
            if (customActiveCamera.zoom > 50) customActiveCamera.zoom = 50;
            customActiveCamera.updateProjectionMatrix();
            controls.update();
            return;
        }
        
        const rect = canvas3D.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        
        // 1. Raycast to find the 3D point under cursor
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        // Raycast against targets (excluding markers, helpers)
        const targets = [];
        scene.traverse(node => {
            if (node.isMesh && node !== ground && node !== snapIndicator && (!node.name || !node.name.startsWith('measure')) && node.geometry) {
                targets.push(node);
            }
        });
        
        const intersects = raycaster.intersectObjects(targets, true);
        let targetPoint = null;
        
        if (intersects.length > 0) {
            targetPoint = intersects[0].point.clone();
        } else {
            // Raycast against ground plane (y=0) if no mesh hit
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            const intersection = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(plane, intersection)) {
                targetPoint = intersection.clone();
            }
        }
        
        if (!targetPoint) return;
        
        // 2. Calculate zoom factor
        const zoomIntensity = 0.08;
        const factor = e.deltaY > 0 ? (1 + zoomIntensity) : (1 - zoomIntensity);
        
        // 3. Zoom limit constraints (min 0.05m for ultra close-up detail, max 4000m distance)
        const currentDistance = camera.position.distanceTo(controls.target);
        const newDistance = currentDistance * factor;
        if (newDistance < 0.05 || newDistance > 4000) return;
        
        // 4. Transform camera position and controls target around targetPoint
        const camOffset = new THREE.Vector3().subVectors(camera.position, targetPoint).multiplyScalar(factor);
        camera.position.copy(targetPoint).add(camOffset);
        
        const targetOffset = new THREE.Vector3().subVectors(controls.target, targetPoint).multiplyScalar(factor);
        controls.target.copy(targetPoint).add(targetOffset);
        
        controls.update();
        e.preventDefault();
    }, { passive: false, capture: true });
    
    // Smooth Touch Pinch-to-Zoom for Mobile and Tablet devices with ultra-close 0.05m limit
    let touchStartDist = 0;
    let touchStartMidPoint = null;

    canvas3D.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            touchStartDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            
            const rect = canvas3D.getBoundingClientRect();
            const midX = (t1.clientX + t2.clientX) / 2;
            const midY = (t1.clientY + t2.clientY) / 2;
            
            const mouse = new THREE.Vector2(
                ((midX - rect.left) / rect.width) * 2 - 1,
                -((midY - rect.top) / rect.height) * 2 + 1
            );
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const targets = [];
            scene.traverse(node => {
                if (node.isMesh && node !== ground && node !== snapIndicator && (!node.name || !node.name.startsWith('measure')) && node.geometry) {
                    targets.push(node);
                }
            });
            
            const intersects = raycaster.intersectObjects(targets, true);
            if (intersects.length > 0) {
                touchStartMidPoint = intersects[0].point.clone();
            } else {
                const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
                const intersection = new THREE.Vector3();
                if (raycaster.ray.intersectPlane(plane, intersection)) {
                    touchStartMidPoint = intersection.clone();
                } else {
                    touchStartMidPoint = controls.target.clone();
                }
            }
        }
    }, { passive: false });

    canvas3D.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && touchStartDist > 0 && touchStartMidPoint) {
            e.preventDefault();
            const t1 = e.touches[0];
            const t2 = e.touches[1];
            const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            if (currentDist > 0) {
                const ratio = touchStartDist / currentDist;
                touchStartDist = currentDist; // Continuous smooth zoom
                
                const currentDistance = camera.position.distanceTo(controls.target);
                const newDistance = currentDistance * ratio;
                if (newDistance >= 0.05 && newDistance <= 4000) {
                    const camOffset = new THREE.Vector3().subVectors(camera.position, touchStartMidPoint).multiplyScalar(ratio);
                    camera.position.copy(touchStartMidPoint).add(camOffset);
                    
                    const targetOffset = new THREE.Vector3().subVectors(controls.target, touchStartMidPoint).multiplyScalar(ratio);
                    controls.target.copy(touchStartMidPoint).add(targetOffset);
                    
                    controls.update();
                }
            }
        }
    }, { passive: false });

    canvas3D.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            touchStartDist = 0;
            touchStartMidPoint = null;
        }
    });
    
    // Wire up events for the map location search box
    if (elements.mapSearchBtn) {
        elements.mapSearchBtn.addEventListener('click', performAddressSearch);
    }
    if (elements.mapSearchInput) {
        elements.mapSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performAddressSearch();
            }
        });
    }
    
    // Wire up events for the floating exclusion tools panel
    setupExclusionToolEvents();
}

async function performAddressSearch() {
    const query = elements.mapSearchInput ? elements.mapSearchInput.value.trim() : "";
    if (!query) return;
    
    if (elements.mapSearchBtn) elements.mapSearchBtn.disabled = true;
    
    // 1. Direct Coordinates Parsing (e.g. "23.8732, 120.5264" or "23.8732 120.5264" or DMS)
    const coordMatch = query.match(/(-?[\d.]+)\s*[,/|\s]\s*(-?[\d.]+)/);
    if (coordMatch) {
        const p1 = parseFloat(coordMatch[1]);
        const p2 = parseFloat(coordMatch[2]);
        if (!isNaN(p1) && !isNaN(p2)) {
            let lat = p1, lng = p2;
            if (p1 > 90 || p1 < -90) { lat = p2; lng = p1; } // Swap if user entered [lng, lat]
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                state.lat = parseFloat(lat.toFixed(6));
                state.lng = parseFloat(lng.toFixed(6));
                const dmsLat = convertToDMS(state.lat, true);
                const dmsLng = convertToDMS(state.lng, false);
                if (elements.coords) elements.coords.value = `${dmsLat} ${dmsLng}`;
                updateMarker(state.lat, state.lng);
                centerMap(state.lat, state.lng);
                updateAllVisuals();
                if (elements.mapSearchBtn) elements.mapSearchBtn.disabled = false;
                return;
            }
        }
    }
    
    let resultLat = null, resultLng = null, displayName = "";
    
    // 2. Engine 1: Photon Geocoding API (Fast, CORS friendly, high rate-limit)
    try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
        const res = await fetch(photonUrl);
        if (res.ok) {
            const data = await res.json();
            if (data && data.features && data.features.length > 0) {
                const feat = data.features[0];
                const coords = feat.geometry.coordinates; // [lng, lat]
                resultLng = parseFloat(coords[0]);
                resultLat = parseFloat(coords[1]);
                const p = feat.properties || {};
                displayName = [p.name, p.district, p.city, p.state, p.country].filter(Boolean).join(', ') || query;
            }
        }
    } catch (e) {
        console.warn("Photon geocode fallback: ", e);
    }
    
    // 3. Engine 2: OpenStreetMap Nominatim API (Fallback)
    if (resultLat === null || resultLng === null) {
        try {
            const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=tw&accept-language=zh-TW`;
            const res = await fetch(nomUrl);
            if (res.ok) {
                const data = await res.json();
                if (data && data.length > 0) {
                    resultLat = parseFloat(data[0].lat);
                    resultLng = parseFloat(data[0].lon);
                    displayName = data[0].display_name;
                }
            }
        } catch (e) {
            console.warn("Nominatim geocode fallback: ", e);
        }
    }
    
    // 4. Handle Result & Map Update
    try {
        if (resultLat !== null && resultLng !== null && !isNaN(resultLat) && !isNaN(resultLng)) {
            state.lat = parseFloat(resultLat.toFixed(6));
            state.lng = parseFloat(resultLng.toFixed(6));
            
            const dmsLat = convertToDMS(state.lat, true);
            const dmsLng = convertToDMS(state.lng, false);
            if (elements.coords) elements.coords.value = `${dmsLat} ${dmsLng}`;
            
            updateMarker(state.lat, state.lng);
            centerMap(state.lat, state.lng);
            updateAllVisuals();
            
            if (displayName && elements.mapSearchInput) {
                elements.mapSearchInput.value = displayName;
            }
        } else {
            alert("查無此地址或關鍵字，請嘗試輸入更完整的行政區與路名，或直接輸入經緯度座標！");
        }
    } catch (error) {
        console.error("Error during geocoding:", error);
        alert("地址搜尋服務暫時無法使用，請直接於試算表輸入經緯度或在地圖上手動點擊定位！");
    } finally {
        if (elements.mapSearchBtn) {
            elements.mapSearchBtn.disabled = false;
        }
    }
}
function setupSplitter() {
    const splitter = document.getElementById('workspace-splitter');
    const view3d = document.getElementById('view-wrapper-3d');
    const viewMap = document.getElementById('view-wrapper-map');
    const rightWorkspace = document.querySelector('.workspace-right');
    
    if (!splitter || !view3d || !rightWorkspace) return;
    
    let isDragging = false;
    
    const startDrag = (e) => {
        isDragging = true;
        splitter.classList.add('dragging');
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        if (e.cancelable) e.preventDefault();
    };
    
    const doDrag = (clientY) => {
        const workspaceRect = rightWorkspace.getBoundingClientRect();
        const relativeY = clientY - workspaceRect.top;
        
        // Limit heights (e.g. min 150px, max workspaceHeight - 150px)
        const minHeight = 150;
        const maxHeight = workspaceRect.height - 150;
        let newHeight = Math.max(minHeight, Math.min(maxHeight, relativeY));
        
        view3d.style.height = `${newHeight}px`;
        view3d.style.flex = 'none'; // Disable flex grow/shrink for 3D to keep exact height
        
        // Trigger Three.js canvas resize
        if (renderer && camera) {
            const canvas = renderer.domElement;
            const container = canvas.parentElement;
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        
        // Trigger Leaflet map container recalculation immediately
        if (map) {
            map.invalidateSize();
        }
    };
    
    const endDrag = () => {
        if (isDragging) {
            isDragging = false;
            splitter.classList.remove('dragging');
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            
            // Finalize map size update
            if (map) map.invalidateSize();
        }
    };
    
    // Mouse events
    splitter.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', (e) => {
        if (isDragging) doDrag(e.clientY);
    });
    window.addEventListener('mouseup', endDrag);
    
    // Touch events
    splitter.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length > 0) {
            doDrag(e.touches[0].clientY);
            if (e.cancelable) e.preventDefault();
        }
    }, { passive: false });
    window.addEventListener('touchend', endDrag);
}

function initInstructionsHighlight() {
    const steps = document.querySelectorAll('.step-item');
    steps.forEach(step => {
        const stepNum = parseInt(step.getAttribute('data-step'));
        if (isNaN(stepNum)) return;
        
        const getTargetSelector = () => {
            switch (stepNum) {
                case 1: // 星期一
                    return '.map-search-box';
                case 2: // 星期二
                    return '#btn-site-boundary';
                case 3: // 星期三
                    return '.spreadsheet-container';
                case 4: // 星期四
                    return '#btn-exclusion-zone';
                case 5: // 星期五
                    return '#btn-obstacle-zone';
                default:
                    return null;
            }
        };
        
        const triggerFlash = (active) => {
            const selector = getTargetSelector();
            if (!selector) return;
            
            const el = document.querySelector(selector);
            if (!el) return;
            
            if (active) {
                el.classList.add('element-flash');
                
                // 防止左側 sidebar 水平滾動衝突
                if (selector.startsWith('#btn-') || selector === '.spreadsheet-container') {
                    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                el.classList.remove('element-flash');
            }
        };
        
        step.addEventListener('mouseenter', () => triggerFlash(true));
        step.addEventListener('mouseleave', () => triggerFlash(false));
        
        // 觸控手勢保護
        step.addEventListener('touchstart', (e) => {
            // 檢查觸控點
            document.querySelectorAll('.element-flash').forEach(el => el.classList.remove('element-flash'));
            triggerFlash(true);
            
            // 雙指觸控手勢處理
            setTimeout(() => triggerFlash(false), 2000);
        }, { passive: true });
    });
}

let parallelGuidePolyline = null;
let isParallelSnapActive = false;
let isPerpendicularSnapActive = false;

function clearRightAngleIndicator() {
    if (rightAngleIndicatorPolyline) {
        if (map) {
            try { map.removeLayer(rightAngleIndicatorPolyline); } catch (e) {}
        }
        rightAngleIndicatorPolyline = null;
    }
    if (parallelGuidePolyline) {
        if (map) {
            try { map.removeLayer(parallelGuidePolyline); } catch (e) {}
        }
        parallelGuidePolyline = null;
    }
}

function updateSnapMarkerVisual(snapCheck) {
    if (!snapCheck) {
        if (mapSnapMarker && map) {
            map.removeLayer(mapSnapMarker);
            mapSnapMarker = null;
        }
        return;
    }
    
    const latlng = snapCheck.latlng;
    const isEndpoint = snapCheck.type === 'endpoint';
    
    const iconHtml = isEndpoint 
        ? '<div class="snap-icon-endpoint" style="width: 14px; height: 14px;"></div>'
        : '<div class="snap-icon-midpoint" style="width: 12px; height: 12px;"></div>';
        
    const snapIcon = L.divIcon({
        className: 'custom-snap-marker',
        html: iconHtml,
        iconSize: isEndpoint ? [14, 14] : [12, 12],
        iconAnchor: isEndpoint ? [7, 7] : [6, 6]
    });
    
    if (!mapSnapMarker) {
        mapSnapMarker = L.marker(latlng, {
            icon: snapIcon,
            interactive: false,
            zIndexOffset: 2000
        }).addTo(map);
    } else {
        mapSnapMarker.setIcon(snapIcon);
        mapSnapMarker.setLatLng(latlng);
    }
}

function snapToPreviousSegmentRightAngle(pointsArray, currentLatLng) {
    if (pointsArray.length < 1) {
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        clearRightAngleIndicator();
        return currentLatLng;
    }
    
    const P2 = pointsArray[pointsArray.length - 1];
    const P3 = currentLatLng;
    
    const metersPerLatDegree = 111320;
    const latRad = (P2.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const dy_curr = (P3.lat - P2.lat) * metersPerLatDegree;
    const dx_curr = (P3.lng - P2.lng) * metersPerLngDegree;
    let distance = Math.sqrt(dx_curr * dx_curr + dy_curr * dy_curr);
    
    if (distance < 0.1) {
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        clearRightAngleIndicator();
        return P3;
    }
    
    if (isRightAngleSnapBypassed) {
        isRightAngleSnapActive = false;
        isRectangleSnapActive = false;
        isParallelSnapActive = false;
        isPerpendicularSnapActive = false;
        clearRightAngleIndicator();
        return P3;
    }
    
    const angle_curr_rad = Math.atan2(dx_curr, dy_curr);
    const angle_curr_deg = (angle_curr_rad * 180 / Math.PI + 360) % 360;
    
    // ----------------------------------------------------
    // Candidate 1: Previous segment of current polygon (Right Angle / Rectangle Snapping)
    // ----------------------------------------------------
    if (pointsArray.length >= 2) {
        const P1 = pointsArray[pointsArray.length - 2];
        const dy_prev = (P2.lat - P1.lat) * metersPerLatDegree;
        const dx_prev = (P2.lng - P1.lng) * metersPerLngDegree;
        const angle_prev_rad = Math.atan2(dx_prev, dy_prev);
        const angle_prev_deg = (angle_prev_rad * 180 / Math.PI + 360) % 360;
        
        const targets = [
            (angle_prev_deg + 90) % 360,
            (angle_prev_deg + 270) % 360
        ];
        
        let minDiff = Infinity;
        let closestTarget = null;
        targets.forEach(t => {
            let diff = Math.abs(angle_curr_deg - t);
            if (diff > 180) diff = 360 - diff;
            if (diff < minDiff) {
                minDiff = diff;
                closestTarget = t;
            }
        });
        
        if (minDiff <= 3.5) {
            isRightAngleSnapActive = true;
            isPerpendicularSnapActive = true;
            isParallelSnapActive = false;
            
            // --- Rectangle Snapping / Inference ---
            if (pointsArray.length === 3) {
                const P0 = pointsArray[0];
                const dy0 = (P1.lat - P0.lat) * metersPerLatDegree;
                const dx0 = (P1.lng - P0.lng) * metersPerLngDegree;
                const len0 = Math.sqrt(dx0 * dx0 + dy0 * dy0);
                const len_prev = Math.sqrt(dx_prev * dx_prev + dy_prev * dy_prev);
                
                const dot = dx0 * dx_prev + dy0 * dy_prev;
                const cosTheta = dot / (len0 * len_prev);
                const thetaDeg = Math.acos(Math.max(-1, Math.min(1, cosTheta))) * 180 / Math.PI;
                
                if (Math.abs(thetaDeg - 90) <= 6 && len0 > 0.1) {
                    const diff = Math.abs(distance - len0);
                    const threshold = Math.max(3.5, len0 * 0.20);
                    if (diff <= threshold) {
                        distance = len0;
                        isRectangleSnapActive = true;
                    } else {
                        isRectangleSnapActive = false;
                    }
                } else {
                    isRectangleSnapActive = false;
                }
            } else {
                isRectangleSnapActive = false;
            }
            
            const snappedRad = (closestTarget * Math.PI) / 180;
            const snapDy = distance * Math.cos(snappedRad);
            const snapDx = distance * Math.sin(snappedRad);
            const snapLatLng = L.latLng(P2.lat + snapDy / metersPerLatDegree, P2.lng + snapDx / metersPerLngDegree);
            
            // --- DRAW RIGHT ANGLE SYMBOL INDICATOR (Scaled ~10% of length, Sparkling Magenta) ---
            const len1 = Math.sqrt(dx_prev * dx_prev + dy_prev * dy_prev);
            const len2 = distance;
            if (len1 > 0.1 && len2 > 0.1 && map) {
                const scale = 0.10; // 10% of length
                const d = Math.max(0.4, Math.min(3.5, len2 * scale));
                
                const v1x = (-dx_prev / len1) * d;
                const v1y = (-dy_prev / len1) * d;
                const v2x = (snapDx / len2) * d;
                const v2y = (snapDy / len2) * d;
                
                const A = L.latLng(P2.lat + v1y / metersPerLatDegree, P2.lng + v1x / metersPerLngDegree);
                const B = L.latLng(P2.lat + (v1y + v2y) / metersPerLatDegree, P2.lng + (v1x + v2x) / metersPerLngDegree);
                const C = L.latLng(P2.lat + v2y / metersPerLatDegree, P2.lng + v2x / metersPerLngDegree);
                
                if (rightAngleIndicatorPolyline) {
                    rightAngleIndicatorPolyline.setLatLngs([A, B, C]);
                    rightAngleIndicatorPolyline.setStyle({
                        color: 'rgba(255, 0, 128, 1)',
                        weight: isRectangleSnapActive ? 3.0 : 2.0
                    });
                } else {
                    rightAngleIndicatorPolyline = L.polyline([A, B, C], {
                        color: 'rgba(255, 0, 128, 1)',
                        weight: isRectangleSnapActive ? 3.0 : 2.0,
                        interactive: false
                    }).addTo(map);
                }
            }
            if (parallelGuidePolyline && map) {
                map.removeLayer(parallelGuidePolyline);
                parallelGuidePolyline = null;
            }
            return snapLatLng;
        }
    }
    
    // ----------------------------------------------------
    // Candidate 2: Reference "Site Boundary" Edges (Parallel & Perpendicular Snapping)
    // ----------------------------------------------------
    const targetBoundary = customSiteBoundary || coveragePolygon;
    if (targetBoundary) {
        const ring = getOuterRingLatLngs(targetBoundary);
        if (ring && ring.length >= 3) {
            let bestParallelDiff = Infinity;
            let bestParallelTarget = null;
            let bestParallelEdge = null;
            
            let bestPerpDiff = Infinity;
            let bestPerpTarget = null;
            let bestPerpEdge = null;
            
            for (let i = 0; i < ring.length; i++) {
                const S1 = ring[i];
                const S2 = ring[(i + 1) % ring.length];
                const sDy = (S2.lat - S1.lat) * metersPerLatDegree;
                const sDx = (S2.lng - S1.lng) * metersPerLngDegree;
                const sAngle = (Math.atan2(sDx, sDy) * 180 / Math.PI + 360) % 360;
                
                // Parallel targets: sAngle and sAngle + 180
                const parTargets = [sAngle, (sAngle + 180) % 360];
                for (const t of parTargets) {
                    let diff = Math.abs(angle_curr_deg - t);
                    if (diff > 180) diff = 360 - diff;
                    if (diff < bestParallelDiff) {
                        bestParallelDiff = diff;
                        bestParallelTarget = t;
                        bestParallelEdge = [S1, S2];
                    }
                }
                
                // Perpendicular targets: sAngle + 90 and sAngle + 270
                const perpTargets = [(sAngle + 90) % 360, (sAngle + 270) % 360];
                for (const t of perpTargets) {
                    let diff = Math.abs(angle_curr_deg - t);
                    if (diff > 180) diff = 360 - diff;
                    if (diff < bestPerpDiff) {
                        bestPerpDiff = diff;
                        bestPerpTarget = t;
                        bestPerpEdge = [S1, S2];
                    }
                }
            }
            
            // Priority: Parallel if within 3.5 deg
            if (bestParallelDiff <= 3.5) {
                isParallelSnapActive = true;
                isPerpendicularSnapActive = false;
                isRightAngleSnapActive = false;
                isRectangleSnapActive = false;
                
                const snappedRad = (bestParallelTarget * Math.PI) / 180;
                const snapDy = distance * Math.cos(snappedRad);
                const snapDx = distance * Math.sin(snappedRad);
                const snapLatLng = L.latLng(P2.lat + snapDy / metersPerLatDegree, P2.lng + snapDx / metersPerLngDegree);
                
                // Draw parallel guide line along matched site boundary edge in sparkling magenta
                if (bestParallelEdge && map) {
                    if (parallelGuidePolyline) {
                        parallelGuidePolyline.setLatLngs(bestParallelEdge);
                        parallelGuidePolyline.setStyle({
                            color: 'rgba(255, 0, 128, 1)',
                            weight: 2.5,
                            dashArray: '6, 4'
                        });
                    } else {
                        parallelGuidePolyline = L.polyline(bestParallelEdge, {
                            color: 'rgba(255, 0, 128, 1)',
                            weight: 2.5,
                            dashArray: '6, 4',
                            interactive: false
                        }).addTo(map);
                    }
                }
                if (rightAngleIndicatorPolyline && map) {
                    map.removeLayer(rightAngleIndicatorPolyline);
                    rightAngleIndicatorPolyline = null;
                }
                return snapLatLng;
            }
            
            // Priority: Perpendicular to site boundary edge if within 3.5 deg
            if (bestPerpDiff <= 3.5) {
                isPerpendicularSnapActive = true;
                isParallelSnapActive = false;
                isRightAngleSnapActive = true;
                isRectangleSnapActive = false;
                
                const snappedRad = (bestPerpTarget * Math.PI) / 180;
                const snapDy = distance * Math.cos(snappedRad);
                const snapDx = distance * Math.sin(snappedRad);
                const snapLatLng = L.latLng(P2.lat + snapDy / metersPerLatDegree, P2.lng + snapDx / metersPerLngDegree);
                
                // Draw perpendicular guide / right angle symbol (10% scale, sparkling magenta)
                const scale = 0.10;
                const d = Math.max(0.4, Math.min(3.5, distance * scale));
                const sDy = (bestPerpEdge[1].lat - bestPerpEdge[0].lat) * metersPerLatDegree;
                const sDx = (bestPerpEdge[1].lng - bestPerpEdge[0].lng) * metersPerLngDegree;
                const sLen = Math.sqrt(sDx * sDx + sDy * sDy) || 1;
                
                const v1x = (sDx / sLen) * d;
                const v1y = (sDy / sLen) * d;
                const v2x = (snapDx / distance) * d;
                const v2y = (snapDy / distance) * d;
                
                const A = L.latLng(P2.lat + v1y / metersPerLatDegree, P2.lng + v1x / metersPerLngDegree);
                const B = L.latLng(P2.lat + (v1y + v2y) / metersPerLatDegree, P2.lng + (v1x + v2x) / metersPerLngDegree);
                const C = L.latLng(P2.lat + v2y / metersPerLatDegree, P2.lng + v2x / metersPerLngDegree);
                
                if (rightAngleIndicatorPolyline) {
                    rightAngleIndicatorPolyline.setLatLngs([A, B, C]);
                    rightAngleIndicatorPolyline.setStyle({
                        color: 'rgba(255, 0, 128, 1)',
                        weight: 2.0
                    });
                } else {
                    rightAngleIndicatorPolyline = L.polyline([A, B, C], {
                        color: 'rgba(255, 0, 128, 1)',
                        weight: 2.0,
                        interactive: false
                    }).addTo(map);
                }
                
                if (parallelGuidePolyline && map) {
                    map.removeLayer(parallelGuidePolyline);
                    parallelGuidePolyline = null;
                }
                return snapLatLng;
            }
        }
    }
    
    // No angle snap matched
    isRightAngleSnapBypassed = false;
    isRightAngleSnapActive = false;
    isRectangleSnapActive = false;
    isParallelSnapActive = false;
    isPerpendicularSnapActive = false;
    clearRightAngleIndicator();
    return P3;
}

// ==========================================
// 4. EXCLUSION PRIMITIVES & SNAP HELPERS
// ==========================================
function checkVertexSnapping(mouseLatLng) {
    let snapResult = null;
    let minPixels = 16;
    
    if (!map) return null;
    const mousePoint = map.latLngToContainerPoint(mouseLatLng);
    
    // 1. Snap to first point of currently drawing polygon / obstacle / site boundary
    if (siteBoundaryPoints.length > 0) {
        const firstPt = map.latLngToContainerPoint(siteBoundaryPoints[0]);
        const dist = mousePoint.distanceTo(firstPt);
        if (dist < minPixels) {
            snapResult = { latlng: siteBoundaryPoints[0], type: 'endpoint' };
            minPixels = dist;
        }
    }
    if (exclusionPoints.length > 0) {
        const firstPt = map.latLngToContainerPoint(exclusionPoints[0]);
        const dist = mousePoint.distanceTo(firstPt);
        if (dist < minPixels) {
            snapResult = { latlng: exclusionPoints[0], type: 'endpoint' };
            minPixels = dist;
        }
    }
    if (obstaclePoints.length > 0) {
        const firstPt = map.latLngToContainerPoint(obstaclePoints[0]);
        const dist = mousePoint.distanceTo(firstPt);
        if (dist < minPixels) {
            snapResult = { latlng: obstaclePoints[0], type: 'endpoint' };
            minPixels = dist;
        }
    }
    
    // 2. Snap to corners (endpoints) and edge midpoints of coveragePolygon or customSiteBoundary ("範圍"邊線端點與中點)
    const targetBoundary = customSiteBoundary || coveragePolygon;
    if (targetBoundary) {
        const latlngs = getOuterRingLatLngs(targetBoundary);
        if (latlngs) {
            // Corners (endpoints)
            for (const corner of latlngs) {
                const pt = map.latLngToContainerPoint(corner);
                const dist = mousePoint.distanceTo(pt);
                if (dist < minPixels) {
                    snapResult = { latlng: corner, type: 'endpoint' };
                    minPixels = dist;
                }
            }
            // Edge midpoints
            for (let i = 0; i < latlngs.length; i++) {
                const p1 = latlngs[i];
                const p2 = latlngs[(i + 1) % latlngs.length];
                const midpoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
                
                const pt = map.latLngToContainerPoint(midpoint);
                const dist = mousePoint.distanceTo(pt);
                if (dist < minPixels) {
                    snapResult = { latlng: midpoint, type: 'midpoint' };
                    minPixels = dist;
                }
            }
        }
    }
    
    // 3. Snap to corners (endpoints) and edge midpoints of existing yellow exclusion polygons
    exclusionPolygons.forEach(poly => {
        const latlngs = getOuterRingLatLngs(poly) || [];
        for (const vertex of latlngs) {
            const pt = map.latLngToContainerPoint(vertex);
            const dist = mousePoint.distanceTo(pt);
            if (dist < minPixels) {
                snapResult = { latlng: vertex, type: 'endpoint' };
                minPixels = dist;
            }
        }
        for (let i = 0; i < latlngs.length; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[(i + 1) % latlngs.length];
            const midpoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
            const pt = map.latLngToContainerPoint(midpoint);
            const dist = mousePoint.distanceTo(pt);
            if (dist < minPixels) {
                snapResult = { latlng: midpoint, type: 'midpoint' };
                minPixels = dist;
            }
        }
    });
    
    // 4. Snap to corners (endpoints) and edge midpoints of existing red obstacle polygons
    obstaclePolygons.forEach(poly => {
        const latlngs = getOuterRingLatLngs(poly) || [];
        for (const vertex of latlngs) {
            const pt = map.latLngToContainerPoint(vertex);
            const dist = mousePoint.distanceTo(pt);
            if (dist < minPixels) {
                snapResult = { latlng: vertex, type: 'endpoint' };
                minPixels = dist;
            }
        }
        for (let i = 0; i < latlngs.length; i++) {
            const p1 = latlngs[i];
            const p2 = latlngs[(i + 1) % latlngs.length];
            const midpoint = L.latLng((p1.lat + p2.lat) / 2, (p1.lng + p2.lng) / 2);
            const pt = map.latLngToContainerPoint(midpoint);
            const dist = mousePoint.distanceTo(pt);
            if (dist < minPixels) {
                snapResult = { latlng: midpoint, type: 'midpoint' };
                minPixels = dist;
            }
        }
    });
    
    return snapResult;
}

function snapAngleToLayout(angleDeg, azimuth) {
    const targets = [azimuth, azimuth + 90, azimuth + 180, azimuth + 270];
    let closestTarget = azimuth;
    let minDiff = Infinity;
    
    const normTargets = targets.map(t => (t % 360 + 360) % 360);
    
    normTargets.forEach(t => {
        let diff = Math.abs(angleDeg - t);
        if (diff > 180) diff = 360 - diff;
        if (diff < minDiff) {
            minDiff = diff;
            closestTarget = t;
        }
    });
    
    // Snaps if angle is within 15 degrees of target
    if (minDiff < 15) {
        return { snapped: true, angle: closestTarget };
    }
    return { snapped: false, angle: angleDeg };
}

function snapLatLngToLayoutAxes(lastLatLng, currentLatLng, azimuth) {
    const metersPerLatDegree = 111320;
    const latRad = (lastLatLng.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const dy = (currentLatLng.lat - lastLatLng.lat) * metersPerLatDegree;
    const dx = (currentLatLng.lng - lastLatLng.lng) * metersPerLngDegree;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 0.1) return currentLatLng;
    
    let angleRad = Math.atan2(dx, dy);
    let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
    
    const snapResult = snapAngleToLayout(angleDeg, azimuth);
    if (snapResult.snapped) {
        const snappedRad = (snapResult.angle * Math.PI) / 180;
        const snapDy = distance * Math.cos(snappedRad);
        const snapDx = distance * Math.sin(snappedRad);
        
        const snapLat = lastLatLng.lat + snapDy / metersPerLatDegree;
        const snapLng = lastLatLng.lng + snapDx / metersPerLngDegree;
        return L.latLng(snapLat, snapLng);
    }
    return currentLatLng;
}

function getPathwayVertices(A, B, width) {
    const metersPerLatDegree = 111320;
    const latRad = (A.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const dy = (B.lat - A.lat) * metersPerLatDegree;
    const dx = (B.lng - A.lng) * metersPerLngDegree;
    const L_len = Math.sqrt(dx * dx + dy * dy);
    
    if (L_len < 0.1) return [];
    
    const ux = dx / L_len;
    const uy = dy / L_len;
    
    const vx = -uy;
    const vy = ux;
    
    const halfW = width / 2;
    
    const points = [
        { lat: A.lat + (halfW * vy) / metersPerLatDegree, lng: A.lng + (halfW * vx) / metersPerLngDegree },
        { lat: B.lat + (halfW * vy) / metersPerLatDegree, lng: B.lng + (halfW * vx) / metersPerLngDegree },
        { lat: B.lat - (halfW * vy) / metersPerLatDegree, lng: B.lng - (halfW * vx) / metersPerLngDegree },
        { lat: A.lat - (halfW * vy) / metersPerLatDegree, lng: A.lng - (halfW * vx) / metersPerLngDegree }
    ];
    
    return points.map(p => L.latLng(p.lat, p.lng));
}

function getSubstationVertices(center, angleDeg, width, length) {
    const metersPerLatDegree = 111320;
    const latRad = (center.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const angleRad = (angleDeg * Math.PI) / 180;
    const dirY = { dy: Math.cos(angleRad), dx: Math.sin(angleRad) };
    const dirX = { dy: Math.cos(angleRad + Math.PI/2), dx: Math.sin(angleRad + Math.PI/2) };
    
    const halfW = width / 2;
    const halfL = length / 2;
    
    const offsets = [
        { x: -halfW, y: halfL },  // Top-Left
        { x: halfW, y: halfL },   // Top-Right
        { x: halfW, y: -halfL },  // Bottom-Right
        { x: -halfW, y: -halfL }  // Bottom-Left
    ];
    
    return offsets.map(o => {
        const dyMeters = o.y * dirY.dy + o.x * dirX.dy;
        const dxMeters = o.y * dirY.dx + o.x * dirX.dx;
        
        const lat = center.lat + dyMeters / metersPerLatDegree;
        const lng = center.lng + dxMeters / metersPerLngDegree;
        return L.latLng(lat, lng);
    });
}

function projectLatLng(center, angleDeg, distance) {
    const metersPerLatDegree = 111320;
    const latRad = (center.lat * Math.PI) / 180;
    const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
    
    const angleRad = (angleDeg * Math.PI) / 180;
    const dy = distance * Math.cos(angleRad);
    const dx = distance * Math.sin(angleRad);
    
    return L.latLng(center.lat + dy / metersPerLatDegree, center.lng + dx / metersPerLngDegree);
}


/* ==========================================================================
   7. AI ?箸?頛芸?霅 (AI Lasso Contour Detection)
   ========================================================================== */


function makePanelDraggable(panel, handle) {
    if (!panel || !handle) return;
    
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    
    handle.style.cursor = 'move';
    handle.style.userSelect = 'none';
    handle.style.touchAction = 'none';
    
    const onPointerDown = (e) => {
        if (e.button && e.button !== 0) return;
        if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
        
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        initialLeft = panel.offsetLeft;
        initialTop = panel.offsetTop;
        
        try { panel.setPointerCapture(e.pointerId); } catch(err){}
        panel.style.transition = 'none';
        e.stopPropagation();
    };
    
    const onPointerMove = (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        
        const parent = panel.parentElement;
        if (parent) {
            const maxL = parent.clientWidth - panel.offsetWidth - 4;
            const maxT = parent.clientHeight - panel.offsetHeight - 4;
            newLeft = Math.max(4, Math.min(Math.max(4, maxL), newLeft));
            newTop = Math.max(4, Math.min(Math.max(4, maxT), newTop));
        }
        
        panel.style.left = `${newLeft}px`;
        panel.style.top = `${newTop}px`;
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        
        e.stopPropagation();
    };

    const onPointerUp = (e) => {
        if (!isDragging) return;
        isDragging = false;
        try { panel.releasePointerCapture(e.pointerId); } catch(err){}
        e.stopPropagation();
    };
    
    handle.addEventListener('pointerdown', onPointerDown);
    panel.addEventListener('pointermove', onPointerMove);
    panel.addEventListener('pointerup', onPointerUp);
    panel.addEventListener('pointercancel', onPointerUp);
}

function initDraggablePanels() {
    makePanelDraggable(document.getElementById('site-tool-panel'), document.getElementById('site-tool-header'));
    makePanelDraggable(document.getElementById('exclusion-tool-panel'), document.getElementById('exclusion-tool-header'));
    makePanelDraggable(document.getElementById('obstacle-tool-panel'), document.getElementById('obstacle-tool-header'));
}



function selectExclusionTool(toolName) {
    currentExclusionTool = toolName;
    
    clearExclusionDrawingState();
    clearSubstationEditHandles();
    if (exclusionPreviewPolygon) {
        map.removeLayer(exclusionPreviewPolygon);
        exclusionPreviewPolygon = null;
    }
    
    const btns = {
        'polygon': 'btn-ex-polygon',
        'walkway': 'btn-ex-walkway',
        'pathway-1': 'btn-ex-path-1',
        'pathway-2': 'btn-ex-path-2',
        'pathway-4': 'btn-ex-path-4',
        'substation': 'btn-ex-substation'
    };
    
    Object.keys(btns).forEach(key => {
        const btn = document.getElementById(btns[key]);
        if (btn) {
            if (key === toolName) {
                btn.style.background = 'rgba(255, 255, 255, 0.15)';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.background = 'transparent';
                btn.style.fontWeight = 'normal';
            }
        }
    });
    
    if (map) {
        if (toolName === 'polygon') {
            map.dragging.enable();
            map.getContainer().style.cursor = 'url("images/draw_pencil.svg") 2 30, crosshair';
        } else if (toolName === 'walkway' || toolName.startsWith('pathway')) {
            map.dragging.enable();
            map.getContainer().style.cursor = 'crosshair';
        } else if (toolName === 'substation') {
            map.dragging.enable();
            map.getContainer().style.cursor = 'cell';
        }
    }
}

function makeSubstationEditable(poly) {
    clearSubstationEditHandles();
    
    activeSubstationPoly = poly;
    const center = poly.substationCenter;
    const angle = poly.substationAngle;
    const rectW = poly.rectWidth || 4;
    const rectL = poly.rectLength || 5;
    
    const centerIcon = L.divIcon({
        className: 'substation-center-handle',
        html: '<div style="background-color: rgba(59, 130, 246, 1); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); cursor: move;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
    
    substationCenterMarker = L.marker(center, {
        icon: centerIcon,
        draggable: true,
        zIndexOffset: 1000
    }).addTo(map);
    
    const rotateHandleDist = Math.max(3.0, (rectL / 2) + 1.5);
    const rotateHandleLatLng = projectLatLng(center, angle, rotateHandleDist);
    const rotateIcon = L.divIcon({
        className: 'substation-rotate-handle',
        html: '<div style="background-color: rgba(251, 191, 36, 1); width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5); cursor: pointer;"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7]
    });
    
    substationRotationMarker = L.marker(rotateHandleLatLng, {
        icon: rotateIcon,
        draggable: true,
        zIndexOffset: 1000
    }).addTo(map);
    
    substationConnectLine = L.polyline([center, rotateHandleLatLng], {
        color: 'rgba(251, 191, 36, 1)',
        weight: 2,
        dashArray: '3, 3',
        interactive: false
    }).addTo(map);
    
    substationCenterMarker.on('drag', (e) => {
        const newCenter = e.target.getLatLng();
        poly.substationCenter = newCenter;
        
        const vertices = getSubstationVertices(newCenter, poly.substationAngle, poly.rectWidth || 4, poly.rectLength || 5);
        poly.setLatLngs(vertices);
        
        const newRotateLatLng = projectLatLng(newCenter, poly.substationAngle, Math.max(3.0, ((poly.rectLength || 5) / 2) + 1.5));
        substationRotationMarker.setLatLng(newRotateLatLng);
        substationConnectLine.setLatLngs([newCenter, newRotateLatLng]);
        
        calculateOutputs();
        updateAllVisuals();
    });
    
    substationCenterMarker.on('dragend', () => {
        calculateOutputs();
        updateAllVisuals(true);
    });
    
    substationRotationMarker.on('drag', (e) => {
        const handleLatLng = e.target.getLatLng();
        const currentCenter = poly.substationCenter;
        
        const metersPerLatDegree = 111320;
        const latRad = (currentCenter.lat * Math.PI) / 180;
        const metersPerLngDegree = metersPerLatDegree * Math.cos(latRad);
        
        const dy = (handleLatLng.lat - currentCenter.lat) * metersPerLatDegree;
        const dx = (handleLatLng.lng - currentCenter.lng) * metersPerLngDegree;
        
        let angleRad = Math.atan2(dx, dy);
        let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;
        
        const snapResult = snapAngleToLayout(angleDeg, state.azimuth);
        let finalAngle = snapResult.angle;
        
        poly.substationAngle = finalAngle;
        
        const vertices = getSubstationVertices(currentCenter, finalAngle, poly.rectWidth || 4, poly.rectLength || 5);
        poly.setLatLngs(vertices);
        
        const newRotateLatLng = projectLatLng(currentCenter, finalAngle, Math.max(3.0, ((poly.rectLength || 5) / 2) + 1.5));
        substationRotationMarker.setLatLng(newRotateLatLng);
        substationConnectLine.setLatLngs([currentCenter, newRotateLatLng]);
        
        calculateOutputs();
        updateAllVisuals();
    });
    
    substationRotationMarker.on('dragend', () => {
        calculateOutputs();
        updateAllVisuals(true);
    });
}

function clearSubstationEditHandles() {
    if (substationCenterMarker) { map.removeLayer(substationCenterMarker); substationCenterMarker = null; }
    if (substationRotationMarker) { map.removeLayer(substationRotationMarker); substationRotationMarker = null; }
    if (substationConnectLine) { map.removeLayer(substationConnectLine); substationConnectLine = null; }
    activeSubstationPoly = null;
}

function setupExclusionToolEvents() {
    const btnExPolygon = document.getElementById('btn-ex-polygon');
    
    if (btnExPolygon) btnExPolygon.addEventListener('click', () => selectExclusionTool('polygon'));
}


// Background Address Cache for Instant PDF Exports
const addressCache = {
    key: '',
    shortAddress: ''
};

function getShortAddressHelper(addr) {
    if (!addr || addr === "\u672a\u6307\u5b9a\u5730\u5740") return "\u672a\u6307\u5b9a";
    const cleanAddr = addr.replace(/^\d+/, "").replace(/^(\u53f0\u7063|\u81fa\u7063|\u4e2d\u83ef\u6c11\u570b)/, "").trim();
    const match = cleanAddr.match(/([^\s\u7e23\u5e02]+(?:\u7e23|\u5e02))([^\s\u9109\u93ae\u5e02\u5340]+(?:\u9109|\u93ae|\u5e02|\u5340))/);
    if (match) {
        return match[1] + match[2];
    }
    return cleanAddr.substring(0, 10);
}

async function prefetchReverseGeocode(lat, lng) {
    if (!lat || !lng) return;
    const key = lat.toFixed(5) + "_" + lng.toFixed(5);
    if (addressCache.key === key && addressCache.shortAddress) return;
    
    try {
        const revRes = await fetch("https://nominatim.openstreetmap.org/reverse?format=json&lat=" + lat + "&lon=" + lng + "&accept-language=zh-TW", {
            headers: { "User-Agent": "PV-Super-Solar-Planner/1.0" }
        });
        const revData = await revRes.json();
        if (revData && revData.address) {
            const addr = revData.address;
            const cityOrCounty = addr.county || addr.city || addr.town || "";
            const districtOrTown = addr.town || addr.suburb || addr.city_district || addr.district || "";
            
            const cleanCity = cityOrCounty.replace(/^(\u53f0\u7063|\u81fa\u7063|\u4e2d\u83ef\u6c11\u570b)/, "").trim();
            const cleanDist = districtOrTown.trim();
            
            if (cleanCity && cleanDist) {
                addressCache.shortAddress = cleanCity + cleanDist;
            } else if (revData.display_name) {
                addressCache.shortAddress = getShortAddressHelper(revData.display_name);
            }
        } else if (revData && revData.display_name) {
            addressCache.shortAddress = getShortAddressHelper(revData.display_name);
        }
        addressCache.key = key;
    } catch (err) {
        console.warn("Background reverse geocoding prefetch failed:", err);
    }
}
function showExportModeChoiceModal() {
    return new Promise((resolve) => {
        const oldModal = document.getElementById('export-mode-modal');
        if (oldModal) oldModal.remove();

        const overlay = document.createElement('div');
        overlay.id = 'export-mode-modal';
        overlay.className = 'export-mode-modal-overlay';
        overlay.innerHTML = `
            <div class="export-mode-modal-card">
                <div class="export-mode-modal-header">
                    <div class="export-mode-modal-title">
                        <span>📊</span> 匯出案場評估簡報 (PDF)
                    </div>
                    <button class="export-mode-close-btn" id="btn-export-mode-cancel">✕</button>
                </div>
                <div class="export-mode-modal-body">
                    <p class="export-mode-modal-desc">
                        請選擇簡報第 2 頁 4 張 3D 視角圖片（放大圖、透視圖、上視圖、側視圖）的擷取方式：
                    </p>
                    <div class="export-mode-options">
                        <button type="button" class="export-mode-opt-card" id="btn-export-mode-auto">
                            <div class="export-mode-opt-icon">⚡</div>
                            <div class="export-mode-opt-content">
                                <div class="export-mode-opt-header">
                                    <span class="export-mode-opt-title">自動截圖</span>
                                    <span class="export-mode-opt-badge badge-recommended">推薦 / 快速</span>
                                </div>
                                <div class="export-mode-opt-text">
                                    由系統全自動最佳化視角並高速擷取 4 張標準工程擬真圖。
                                </div>
                            </div>
                        </button>
                        <button type="button" class="export-mode-opt-card" id="btn-export-mode-manual">
                            <div class="export-mode-opt-icon">📷</div>
                            <div class="export-mode-opt-content">
                                <div class="export-mode-opt-header">
                                    <span class="export-mode-opt-title">手動截圖</span>
                                    <span class="export-mode-opt-badge badge-custom">互動取景</span>
                                </div>
                                <div class="export-mode-opt-text">
                                    進入 3D 視窗取景框，依序手動旋轉、平移、縮放自訂 4 張照片視角（側視圖自動啟用平行投影）。
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
                <div class="export-mode-modal-footer">
                    <button class="export-mode-btn-cancel" id="btn-export-mode-bottom-cancel">取消</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const cleanup = (result) => {
            overlay.remove();
            resolve(result);
        };

        document.getElementById('btn-export-mode-auto').onclick = () => cleanup('auto');
        document.getElementById('btn-export-mode-manual').onclick = () => cleanup('manual');
        document.getElementById('btn-export-mode-cancel').onclick = () => cleanup(null);
        document.getElementById('btn-export-mode-bottom-cancel').onclick = () => cleanup(null);
        overlay.onclick = (e) => {
            if (e.target === overlay) cleanup(null);
        };
    });
}

async function capture3DViewsForPresentation(mode = 'auto') {
    const targetWidth = 2040;
    const targetHeight = 928;
    const captureAspect = targetWidth / targetHeight;
    
    const savedPos = camera.position.clone();
    const savedTarget = controls.target.clone();
    const originalWidth = renderer.domElement.clientWidth;
    const originalHeight = renderer.domElement.clientHeight;
    const originalPixelRatio = renderer.getPixelRatio();
    
    const sceneBounds = getSceneBoundsInfo();
    const sceneCenter = sceneBounds.center;
    const sceneSize = sceneBounds.size;
    
    const fovRad = (camera.fov * Math.PI) / 180;
    const maxHoriz = Math.max(sceneSize.x, sceneSize.z, 2.0);
    const maxVert = Math.max(sceneSize.y, 2.0);
    
    const distVert = (maxVert / 2) / Math.tan(fovRad / 2);
    const distHoriz = (maxHoriz / 2) / (Math.tan(fovRad / 2) * captureAspect);
    const distDiag = (Math.hypot(sceneSize.x, sceneSize.z) / 2) / Math.tan(fovRad / 2);
    const tightDist = Math.max(distVert, distHoriz, distDiag * 0.72) * 1.10;
    
    const isGroundSite = state.siteType === 'ground';
    const baseRoofH = isGroundSite ? 0 : (state.roofH || 0);
    const maxSupportH = (state.supportH !== undefined ? state.supportH : 2000) / 1000;
    const arrayCenterY = baseRoofH + maxSupportH * 0.5 + 0.3;
    const arrayCenter = new THREE.Vector3(sceneCenter.x, arrayCenterY, sceneCenter.z);

    // Common setup for Side View Orthographic Camera and materials
    const sideAzimuthRad = (state.azimuth * Math.PI) / 180;
    const sideDir = new THREE.Vector3(Math.cos(sideAzimuthRad), 0, Math.sin(sideAzimuthRad)).normalize();
    const isSidePortrait = (state.pvOrient || 'portrait') === 'portrait';
    const pvSlopeDim = (isSidePortrait ? (state.pvL || 1722) : (state.pvW || 1134)) / 1000;
    const tiltAngleRad = ((state.tilt !== undefined ? state.tilt : 6) * Math.PI) / 180;
    const sideSpY_m = (state.spY || 20) / 1000;
    
    const numRowsToShow = Math.min(state.arrJ || 4, 10);
    const modulePitchZ = pvSlopeDim * Math.cos(tiltAngleRad) + sideSpY_m;
    const spanDepth = numRowsToShow * modulePitchZ;
    const targetViewDepth = Math.max(spanDepth * 1.25, 4.0);
    const maxStructureTopY = baseRoofH + maxSupportH + (spanDepth * Math.sin(tiltAngleRad)) + 0.3;
    
    const isBreakView = !isGroundSite && (baseRoofH > 1.5);
    const groundLevelY = isBreakView ? (baseRoofH - 1.1) : 0;
    const structureHeightAboveGround = maxStructureTopY - groundLevelY;
    
    let orthoHalfH = Math.max(structureHeightAboveGround * 0.75, 2.2);
    let orthoHalfW = orthoHalfH * captureAspect;
    if (orthoHalfW < targetViewDepth / 2) {
        orthoHalfW = (targetViewDepth / 2) * 1.10;
        orthoHalfH = orthoHalfW / captureAspect;
    }
    
    const sideCenterY = groundLevelY + orthoHalfH * 0.56;
    const sideTarget = new THREE.Vector3(sceneCenter.x, sideCenterY, sceneCenter.z);
    
    const sideOrthoCamera = new THREE.OrthographicCamera(
        -orthoHalfW, orthoHalfW,
        orthoHalfH, -orthoHalfH,
        0.1, 2000
    );
    sideOrthoCamera.position.copy(sideTarget).addScaledVector(sideDir, 250);
    sideOrthoCamera.lookAt(sideTarget);
    sideOrthoCamera.updateProjectionMatrix();

    // Side view Materials
    const sideMatPanel = new THREE.MeshBasicMaterial({ color: 0x1d4ed8 });
    const sideMatSupport = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const sideMatBuilding = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const sideMatGround = new THREE.MeshBasicMaterial({ color: 0x22c55e });
    const sideMatBreakLine = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    
    const savedSideMaterials = new Map();
    const savedMeshVisibilities = new Map();
    const temporarySideObjects = [];
    const prevObstacleVis = obstacleGroup ? obstacleGroup.visible : true;

    const applySideViewSceneModifications = () => {
        if (obstacleGroup) obstacleGroup.visible = false;
        
        savedSideMaterials.clear();
        savedMeshVisibilities.clear();
        temporarySideObjects.length = 0;
        
        scene.traverse(node => {
            if (node.isMesh || node.isInstancedMesh) {
                savedSideMaterials.set(node, node.material);
                
                if (isBreakView && (node.material === materials.building)) {
                    savedMeshVisibilities.set(node, node.visible);
                    node.visible = false;
                } else if (node.parent && (node.parent.name === 'supportGroup' || (typeof supportGroup !== 'undefined' && node.parent === supportGroup))) {
                    node.material = sideMatSupport;
                } else if (node.material === materials.panelFace || node.material === materials.frame) {
                    node.material = sideMatPanel;
                } else if (node.material === materials.roofTile) {
                    node.material = sideMatBuilding;
                } else if (node === ground) {
                    node.material = sideMatGround;
                }
            }
        });
        
        const buildingWidth = Math.max(sceneSize.x * 1.5, 12.0);
        const buildingDepth = Math.max(targetViewDepth * 1.5, 10.0);
        
        if (isBreakView) {
            const topBoxH = 0.50;
            const topMesh = new THREE.Mesh(
                new THREE.BoxGeometry(buildingWidth, topBoxH, buildingDepth),
                sideMatBuilding
            );
            topMesh.position.set(sceneCenter.x, baseRoofH - topBoxH / 2, sceneCenter.z);
            scene.add(topMesh);
            temporarySideObjects.push(topMesh);
            
            const breakZStart = sceneCenter.z - targetViewDepth * 0.9;
            const breakZEnd = sceneCenter.z + targetViewDepth * 0.9;
            const numZigs = 18;
            
            const topBreakPoints = [];
            const topBreakY = baseRoofH - topBoxH;
            for (let i = 0; i <= numZigs; i++) {
                const t = i / numZigs;
                const z = breakZStart + (breakZEnd - breakZStart) * t;
                const yOff = (i % 2 === 0 ? 0.05 : -0.05);
                topBreakPoints.push(new THREE.Vector3(sceneCenter.x, topBreakY + yOff, z));
            }
            const topBreakLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(topBreakPoints), sideMatBreakLine);
            scene.add(topBreakLine);
            temporarySideObjects.push(topBreakLine);
            
            const botBreakY = baseRoofH - 0.70;
            const botBreakPoints = [];
            for (let i = 0; i <= numZigs; i++) {
                const t = i / numZigs;
                const z = breakZStart + (breakZEnd - breakZStart) * t;
                const yOff = (i % 2 === 0 ? 0.05 : -0.05);
                botBreakPoints.push(new THREE.Vector3(sceneCenter.x, botBreakY + yOff, z));
            }
            const botBreakLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(botBreakPoints), sideMatBreakLine);
            scene.add(botBreakLine);
            temporarySideObjects.push(botBreakLine);
            
            const botBoxH = 0.40;
            const botMesh = new THREE.Mesh(
                new THREE.BoxGeometry(buildingWidth, botBoxH, buildingDepth),
                sideMatBuilding
            );
            botMesh.position.set(sceneCenter.x, groundLevelY + botBoxH / 2, sceneCenter.z);
            scene.add(botMesh);
            temporarySideObjects.push(botMesh);
        }
        
        const groundBoxThickness = 2.0;
        const groundElevationBox = new THREE.Mesh(
            new THREE.BoxGeometry(3000, groundBoxThickness, 3000),
            sideMatGround
        );
        groundElevationBox.position.set(sceneCenter.x, groundLevelY - groundBoxThickness / 2, sceneCenter.z);
        scene.add(groundElevationBox);
        temporarySideObjects.push(groundElevationBox);
        
        const groundTopLineMesh = new THREE.Mesh(
            new THREE.BoxGeometry(3000, 0.10, 3000),
            new THREE.MeshBasicMaterial({ color: 0x4ade80 })
        );
        groundTopLineMesh.position.set(sceneCenter.x, groundLevelY - 0.05, sceneCenter.z);
        scene.add(groundTopLineMesh);
        temporarySideObjects.push(groundTopLineMesh);
    };

    const restoreSideViewSceneModifications = () => {
        temporarySideObjects.forEach(obj => {
            scene.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
        });
        temporarySideObjects.length = 0;
        
        savedMeshVisibilities.forEach((origVis, mesh) => {
            mesh.visible = origVis;
        });
        
        savedSideMaterials.forEach((origMat, mesh) => {
            mesh.material = origMat;
        });
        
        if (obstacleGroup) obstacleGroup.visible = prevObstacleVis;
    };

    const captureExactFrame = (cam) => {
        const curW = renderer.domElement.clientWidth;
        const curH = renderer.domElement.clientHeight;
        renderer.setSize(targetWidth, targetHeight, false);
        
        if (cam.isPerspectiveCamera) {
            cam.aspect = captureAspect;
            cam.updateProjectionMatrix();
        }
        
        renderer.render(scene, cam);
        const dataUrl = renderer.domElement.toDataURL('image/jpeg', 0.92);
        
        renderer.setSize(curW, curH, true);
        if (cam.isPerspectiveCamera) {
            cam.aspect = curW / curH;
            cam.updateProjectionMatrix();
        }
        renderer.render(scene, cam);
        return dataUrl;
    };

    // -------------------------------------------------------------
    // Branch A: AUTO MODE (自動截圖)
    // -------------------------------------------------------------
    if (mode === 'auto') {
        renderer.setSize(targetWidth, targetHeight, false);
        camera.aspect = captureAspect;
        camera.updateProjectionMatrix();
        
        // 1. 放大圖 (Local Top View)
        const localWidth = Math.min(sceneSize.x, 14.0);
        const localDepth = Math.min(sceneSize.z, 7.5);
        const localTopDist = Math.max((localDepth / 2) / Math.tan(fovRad / 2), (localWidth / 2) / (Math.tan(fovRad / 2) * captureAspect)) * 1.10;
        camera.position.set(sceneCenter.x, (baseRoofH + maxSupportH + 1.0) + localTopDist, sceneCenter.z + 0.001);
        controls.target.copy(arrayCenter);
        camera.lookAt(arrayCenter);
        renderer.render(scene, camera);
        const localTopViewImg = renderer.domElement.toDataURL('image/jpeg', 0.90);
        
        // 2. 透視圖 (Home View)
        const isoDir = new THREE.Vector3(0.55, 0.50, 0.70).normalize();
        camera.position.copy(arrayCenter).addScaledVector(isoDir, tightDist);
        controls.target.copy(arrayCenter);
        camera.lookAt(arrayCenter);
        renderer.render(scene, camera);
        const homeViewImg = renderer.domElement.toDataURL('image/jpeg', 0.90);
        
        // 3. 上視圖 (Top View)
        const topDist = Math.max((sceneSize.z / 2) / Math.tan(fovRad / 2), (sceneSize.x / 2) / (Math.tan(fovRad / 2) * captureAspect)) * 1.10;
        camera.position.set(sceneCenter.x, (baseRoofH + maxSupportH + 1.0) + topDist, sceneCenter.z + 0.001);
        controls.target.copy(arrayCenter);
        camera.lookAt(arrayCenter);
        renderer.render(scene, camera);
        const topViewImg = renderer.domElement.toDataURL('image/jpeg', 0.90);
        
        // 4. 側視圖 (Side View - Orthographic)
        applySideViewSceneModifications();
        renderer.render(scene, sideOrthoCamera);
        const sideViewImg = renderer.domElement.toDataURL('image/jpeg', 0.92);
        restoreSideViewSceneModifications();
        
        // Restore canvas & camera
        renderer.setSize(originalWidth, originalHeight, true);
        renderer.setPixelRatio(originalPixelRatio);
        camera.aspect = originalWidth / originalHeight;
        camera.updateProjectionMatrix();
        camera.position.copy(savedPos);
        controls.target.copy(savedTarget);
        controls.update();
        renderer.render(scene, camera);
        
        return [localTopViewImg, homeViewImg, topViewImg, sideViewImg];
    }

    // -------------------------------------------------------------
    // Branch B: MANUAL MODE (手動截圖互動引導)
    // -------------------------------------------------------------
    const view3DWrapper = document.getElementById('view-wrapper-3d');
    if (view3DWrapper) {
        view3DWrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    const steps = [
        {
            key: 'localTop',
            name: '放大圖 (特寫)',
            tip: '局部放大特寫視角。請在框內旋轉、平移或縮放至理想畫面，確認後點擊「確認截圖」。',
            isOrtho: false,
            setDefault: () => {
                const localWidth = Math.min(sceneSize.x, 14.0);
                const localDepth = Math.min(sceneSize.z, 7.5);
                const localTopDist = Math.max((localDepth / 2) / Math.tan(fovRad / 2), (localWidth / 2) / (Math.tan(fovRad / 2) * captureAspect)) * 1.10;
                camera.position.set(sceneCenter.x, (baseRoofH + maxSupportH + 1.0) + localTopDist, sceneCenter.z + 0.001);
                controls.target.copy(arrayCenter);
                camera.lookAt(arrayCenter);
                controls.update();
            }
        },
        {
            key: 'home',
            name: '透視圖 (鳥瞰)',
            tip: '整體案場立體透視圖。可自由旋轉、平移至最具代表性之立體視角。',
            isOrtho: false,
            setDefault: () => {
                const isoDir = new THREE.Vector3(0.55, 0.50, 0.70).normalize();
                camera.position.copy(arrayCenter).addScaledVector(isoDir, tightDist);
                controls.target.copy(arrayCenter);
                camera.lookAt(arrayCenter);
                controls.update();
            }
        },
        {
            key: 'top',
            name: '上視圖 (平面)',
            tip: '正上方平面俯視圖（右上角將自動疊加指北針）。可平移、縮放對正。',
            isOrtho: false,
            setDefault: () => {
                const topDist = Math.max((sceneSize.z / 2) / Math.tan(fovRad / 2), (sceneSize.x / 2) / (Math.tan(fovRad / 2) * captureAspect)) * 1.10;
                camera.position.set(sceneCenter.x, (baseRoofH + maxSupportH + 1.0) + topDist, sceneCenter.z + 0.001);
                controls.target.copy(arrayCenter);
                camera.lookAt(arrayCenter);
                controls.update();
            }
        },
        {
            key: 'side',
            name: '側視圖 (平行投影)',
            tip: '正交平行投影側視圖，已自動切換正交相機並套用標示色與破裂視圖。可平移或縮放調整。',
            isOrtho: true,
            setDefault: () => {
                sideOrthoCamera.position.copy(sideTarget).addScaledVector(sideDir, 250);
                sideOrthoCamera.lookAt(sideTarget);
                sideOrthoCamera.zoom = 1.0;
                sideOrthoCamera.updateProjectionMatrix();
                controls.target.copy(sideTarget);
                controls.update();
            }
        }
    ];

    const capturedImages = [];

    // Create interactive overlay UI
    const overlayContainer = document.createElement('div');
    overlayContainer.id = 'manual-capture-overlay';
    overlayContainer.className = 'manual-capture-overlay-container';
    
    // Calculate framing box size based on 3D viewport dimensions
    const viewportW = renderer.domElement.clientWidth;
    const viewportH = renderer.domElement.clientHeight;
    let frameBoxW = Math.min(viewportW * 0.88, (viewportH - 100) * captureAspect);
    let frameBoxH = frameBoxW / captureAspect;
    if (frameBoxH > viewportH - 90) {
        frameBoxH = viewportH - 90;
        frameBoxW = frameBoxH * captureAspect;
    }

    overlayContainer.innerHTML = `
        <div class="manual-capture-top-bar">
            <div>
                <div class="manual-capture-step-title" id="mc-step-title">
                    <span class="mc-step-badge">第 1/4 步</span> 放大圖 (特寫)
                </div>
                <div class="manual-capture-step-tip" id="mc-step-tip">
                    💡 提示：局部放大特寫視角。請在框內旋轉、平移或縮放至理想畫面，確認後點擊右側綠色按鈕。
                </div>
            </div>
            <div class="manual-capture-actions">
                <div class="manual-capture-view-controls">
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-reset-cam" title="透視視角 (Perspective)">
                        <img src="images/perspective_view.svg" alt="透視視角" class="btn-icon" />
                    </button>
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-top" title="俯視視角 (Top View)">
                        <img src="images/top_view.svg" alt="俯視視角" class="btn-icon" />
                    </button>
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-side" title="側視視角 (Side View)">
                        <img src="images/side_view.svg" alt="側視視角" class="btn-icon" />
                    </button>
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-normal" title="Normal 視角 (點選表面以法向檢視)">
                        <img src="images/normal_view.svg" alt="法向視角" class="btn-icon" />
                    </button>
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-fit" title="Zoom to Fit (填滿畫面)">
                        <img src="images/zoom_to_fit.svg" alt="填滿畫面" class="btn-icon" />
                    </button>
                    <div class="manual-capture-divider"></div>
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-zoom-in" title="放大 (Zoom In)">
                        <span style="font-size: 1.25rem; font-weight: 700; line-height: 1; color: #38bdf8;">+</span>
                    </button>
                    <button type="button" class="manual-capture-view-btn" id="btn-mc-zoom-out" title="縮小 (Zoom Out)">
                        <span style="font-size: 1.25rem; font-weight: 700; line-height: 1; color: #38bdf8;">−</span>
                    </button>
                </div>
                <button type="button" class="manual-capture-btn-confirm" id="btn-mc-confirm">📸 確認截圖並進入下一張 ➔</button>
                <button type="button" class="manual-capture-btn-cancel" id="btn-mc-cancel">✖ 取消匯出</button>
            </div>
        </div>
        <div class="manual-capture-framing-box" id="mc-framing-box" style="width: ${frameBoxW}px; height: ${frameBoxH}px;">
            <div class="manual-capture-corner-tr"></div>
            <div class="manual-capture-corner-bl"></div>
            <div class="manual-capture-center-cross"></div>
        </div>
    `;

    const canvasParent = renderer.domElement.parentElement;
    canvasParent.style.position = 'relative';
    canvasParent.appendChild(overlayContainer);

    return new Promise((resolve) => {
        let currentStepIndex = 0;

        const updateStepUI = () => {
            const step = steps[currentStepIndex];
            const titleEl = document.getElementById('mc-step-title');
            const tipEl = document.getElementById('mc-step-tip');
            const confirmBtn = document.getElementById('btn-mc-confirm');
            
            if (titleEl) {
                titleEl.innerHTML = `<span class="mc-step-badge">第 ${currentStepIndex + 1}/4 步</span> ${step.name}`;
            }
            if (tipEl) {
                tipEl.innerHTML = `💡 提示：${step.tip}`;
            }
            if (confirmBtn) {
                confirmBtn.innerHTML = currentStepIndex === 3 ? '📸 確認截圖並生成簡報 ✔' : '📸 確認截圖並進入下一張 ➔';
            }

            if (step.isOrtho) {
                applySideViewSceneModifications();
                customActiveCamera = sideOrthoCamera;
                controls.object = sideOrthoCamera;
                step.setDefault();
            } else {
                restoreSideViewSceneModifications();
                customActiveCamera = null;
                controls.object = camera;
                step.setDefault();
            }
        };

        const cleanupManualFlow = () => {
            restoreSideViewSceneModifications();
            customActiveCamera = null;
            controls.object = camera;
            
            renderer.setSize(originalWidth, originalHeight, true);
            renderer.setPixelRatio(originalPixelRatio);
            camera.aspect = originalWidth / originalHeight;
            camera.updateProjectionMatrix();
            camera.position.copy(savedPos);
            controls.target.copy(savedTarget);
            controls.update();
            renderer.render(scene, camera);
            
            overlayContainer.remove();
        };

        document.getElementById('btn-mc-fit').onclick = () => {
            const step = steps[currentStepIndex];
            if (step.isOrtho) {
                sideOrthoCamera.zoom = 1.0;
                sideOrthoCamera.updateProjectionMatrix();
                controls.target.copy(sideTarget);
                controls.update();
            } else {
                zoomToFit();
            }
        };

        document.getElementById('btn-mc-top').onclick = () => {
            const step = steps[currentStepIndex];
            if (step.isOrtho) {
                sideOrthoCamera.position.set(sceneCenter.x, sceneCenter.y + 250, sceneCenter.z + 0.001);
                sideOrthoCamera.lookAt(sideTarget);
                sideOrthoCamera.updateProjectionMatrix();
                controls.target.copy(sideTarget);
                controls.update();
            } else {
                topView();
            }
        };

        document.getElementById('btn-mc-side').onclick = () => {
            const step = steps[currentStepIndex];
            if (step.isOrtho) {
                steps[3].setDefault();
            } else {
                sideView();
            }
        };

        const btnNormalMc = document.getElementById('btn-mc-normal');
        if (btnNormalMc) {
            btnNormalMc.onclick = () => {
                toggleNormalMode();
            };
        }

        document.getElementById('btn-mc-reset-cam').onclick = () => {
            const step = steps[currentStepIndex];
            if (step.isOrtho) {
                steps[3].setDefault();
            } else {
                resetCamera();
            }
        };

        document.getElementById('btn-mc-zoom-in').onclick = () => {
            const step = steps[currentStepIndex];
            if (step.isOrtho) {
                sideOrthoCamera.zoom *= 1.15;
                if (sideOrthoCamera.zoom > 50) sideOrthoCamera.zoom = 50;
                sideOrthoCamera.updateProjectionMatrix();
                controls.update();
            } else {
                const curDist = camera.position.distanceTo(controls.target);
                if (curDist > 0.5) {
                    const dir = new THREE.Vector3().subVectors(controls.target, camera.position).normalize();
                    camera.position.addScaledVector(dir, Math.max(curDist * 0.15, 0.2));
                    controls.update();
                }
            }
        };

        document.getElementById('btn-mc-zoom-out').onclick = () => {
            const step = steps[currentStepIndex];
            if (step.isOrtho) {
                sideOrthoCamera.zoom /= 1.15;
                if (sideOrthoCamera.zoom < 0.1) sideOrthoCamera.zoom = 0.1;
                sideOrthoCamera.updateProjectionMatrix();
                controls.update();
            } else {
                const curDist = camera.position.distanceTo(controls.target);
                const dir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
                camera.position.addScaledVector(dir, Math.max(curDist * 0.15, 0.2));
                controls.update();
            }
        };

        document.getElementById('btn-mc-cancel').onclick = () => {
            cleanupManualFlow();
            resolve(null);
        };

        document.getElementById('btn-mc-confirm').onclick = () => {
            const step = steps[currentStepIndex];
            const activeCam = step.isOrtho ? sideOrthoCamera : camera;
            const imgData = captureExactFrame(activeCam);
            capturedImages.push(imgData);
            
            currentStepIndex++;
            if (currentStepIndex < steps.length) {
                updateStepUI();
            } else {
                cleanupManualFlow();
                resolve(capturedImages);
            }
        };

        updateStepUI();
    });
}

async function exportSlideshowPDF() {
    // Step 1: Prompt user for Auto or Manual Screenshot mode
    const chosenMode = await showExportModeChoiceModal();
    if (!chosenMode) return; // User cancelled
    
    let captured3DViews = null;
    
    if (chosenMode === 'manual') {
        captured3DViews = await capture3DViewsForPresentation('manual');
        if (!captured3DViews) return; // User cancelled during manual framing
    }
    
    const loader = document.getElementById('viewer-loading');
    let title = null;
    if (loader) {
        loader.classList.add('active');
        title = loader.querySelector('.loading-title') || loader;
        if (title) title.innerText = '正在擷取 3D 視圖與地圖資料...';
    }
    
    try {
        const loadImageAsBase64 = (url) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = img.naturalWidth;
                        canvas.height = img.naturalHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } catch (err) {
                        console.warn("Failed to convert image to base64 due to canvas taint:", err);
                        resolve(null);
                    }
                };
                img.onerror = () => {
                    resolve(null);
                };
                img.src = url;
            });
        };
        
        const isFileProtocol = window.location.protocol === 'file:';
        const logoUrl = isFileProtocol ? 'images/pv_super_logo_light.png' : `images/pv_super_logo_light.png?t=${Date.now()}`;
        const logoBase64 = await loadImageAsBase64(logoUrl) || LOGO_PV_SUPER_BASE64;

        // 1. Capture 3D views (if auto mode)
        if (!captured3DViews) {
            captured3DViews = await capture3DViewsForPresentation('auto');
        }
        
        const [localTopViewImg, homeViewImg, topViewImg, sideViewImg] = captured3DViews;

        // 2. Capture Leaflet Map with site bounding box <= 70% of square image
        let mapImg = null;
        const originalCenter = map ? map.getCenter() : null;
        const originalZoom = map ? map.getZoom() : null;
        
        const leafletControls = document.querySelector('.leaflet-control-container');
        const leafletPopups = document.querySelector('.leaflet-popup-pane');
        const leafletMarkers = document.querySelector('.leaflet-marker-pane');
        const mapSearch = document.querySelector('.map-search-box');
        
        if (leafletControls) leafletControls.style.display = 'none';
        if (leafletPopups) leafletPopups.style.display = 'none';
        if (leafletMarkers) leafletMarkers.style.display = 'none';
        if (mapSearch) mapSearch.style.display = 'none';
        
        const hiddenMapLayers = [];
        const hideLayer = (layer) => {
            if (layer && map.hasLayer(layer)) {
                map.removeLayer(layer);
                hiddenMapLayers.push(layer);
            }
        };
        
        exclusionPolygons.forEach(hideLayer);
        obstaclePolygons.forEach(hideLayer);
        hideLayer(arrowHandleMarker);
        hideLayer(marker);
        hideLayer(substationCenterMarker);
        hideLayer(substationRotationMarker);
        
        // Calculate site bounds and expand so boundary occupies <= 65% ~ 70% of photo
        let targetBounds = null;
        if (customSiteBoundary && typeof customSiteBoundary.getBounds === 'function') {
            targetBounds = customSiteBoundary.getBounds();
        } else if (coveragePolygon && typeof coveragePolygon.getBounds === 'function') {
            targetBounds = coveragePolygon.getBounds();
        } else if (state.lat && state.lng) {
            const dLat = (parseFloat(state.dimH) || 50) / 111320;
            const dLng = (parseFloat(state.dimW) || 50) / (111320 * Math.cos(state.lat * Math.PI / 180));
            targetBounds = L.latLngBounds(
                [state.lat - dLat / 2, state.lng - dLng / 2],
                [state.lat + dLat / 2, state.lng + dLng / 2]
            );
        }
        
        if (map && targetBounds) {
            const targetCenter = targetBounds.getCenter();
            const ne = targetBounds.getNorthEast();
            const sw = targetBounds.getSouthWest();
            const latDiffMeters = Math.abs(ne.lat - sw.lat) * 111320;
            const lngDiffMeters = Math.abs(ne.lng - sw.lng) * (111320 * Math.cos(targetCenter.lat * Math.PI / 180));
            const maxSiteDimMeters = Math.max(latDiffMeters, lngDiffMeters, 20);
            
            // Set photo framing so the max site dimension occupies at most 65% (<= 70%) of photo width/height
            const photoDimMeters = maxSiteDimMeters / 0.65;
            const dLatPhoto = photoDimMeters / 111320;
            const dLngPhoto = photoDimMeters / (111320 * Math.cos(targetCenter.lat * Math.PI / 180));
            
            const expandedBounds = L.latLngBounds(
                [targetCenter.lat - dLatPhoto / 2, targetCenter.lng - dLngPhoto / 2],
                [targetCenter.lat + dLatPhoto / 2, targetCenter.lng + dLngPhoto / 2]
            );
            
            map.fitBounds(expandedBounds, { animate: false });
            await new Promise(resolve => setTimeout(resolve, 500));
        } else if (map && state.lat && state.lng) {
            map.panTo([state.lat, state.lng], { animate: false });
            await new Promise(resolve => setTimeout(resolve, 400));
        }
        
        try {
            if (title) title.innerText = '正在擷取高解析度航照影像...';
            const mapCanvas = await html2canvas(document.getElementById('leaflet-map'), {
                useCORS: true,
                logging: false,
                allowTaint: true,
                scale: 2.0
            });
            
            const w = mapCanvas.width;
            const h = mapCanvas.height;
            const squareSize = Math.min(w, h);
            const sx = (w - squareSize) / 2;
            const sy = (h - squareSize) / 2;
            
            const cropCanvas = document.createElement('canvas');
            cropCanvas.width = squareSize;
            cropCanvas.height = squareSize;
            const cropCtx = cropCanvas.getContext('2d');
            cropCtx.drawImage(mapCanvas, sx, sy, squareSize, squareSize, 0, 0, squareSize, squareSize);
            
            mapImg = cropCanvas.toDataURL('image/jpeg', 0.9);
        } catch (mapError) {
            console.warn('Map capturing failed, using fallback:', mapError);
            const placeholderCanvas = document.createElement('canvas');
            placeholderCanvas.width = 600;
            placeholderCanvas.height = 600;
            const ctx = placeholderCanvas.getContext('2d');
            ctx.fillStyle = 'rgba(30, 41, 59, 1)';
            ctx.fillRect(0, 0, 600, 600);
            ctx.fillStyle = 'rgba(239, 68, 68, 1)';
            ctx.font = 'bold 20px "Noto Serif TC", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('航照圖截取失敗', 300, 280);
            mapImg = placeholderCanvas.toDataURL('image/jpeg', 0.9);
        } finally {
            hiddenMapLayers.forEach(layer => {
                layer.addTo(map);
            });
            
            if (leafletControls) leafletControls.style.display = '';
            if (leafletPopups) leafletPopups.style.display = '';
            if (leafletMarkers) leafletMarkers.style.display = '';
            if (mapSearch) mapSearch.style.display = '';
            
            if (map && originalCenter && originalZoom !== null) {
                map.setView(originalCenter, originalZoom, { animate: false });
            }
        }
        
        // 3. Generate HTML elements for A4 landscape slides (1120x792)
        if (title) title.innerText = '正在生成簡報頁面...';
        
        const slideWrapper = document.createElement('div');
        slideWrapper.style.position = 'absolute';
        slideWrapper.style.left = '-9999px';
        slideWrapper.style.top = '-9999px';
        slideWrapper.style.width = '1120px';
        document.body.appendChild(slideWrapper);
        
        const createSlide = (htmlContent) => {
            const slide = document.createElement('div');
            slide.style.width = '1120px';
            slide.style.height = '792px';
            slide.style.background = 'rgba(15, 23, 42, 1)'; // Deep slate background matching PV Super theme
            slide.style.color = 'rgba(255, 255, 255, 1)';
            slide.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Microsoft JhengHei", "微軟正黑體", sans-serif';
            slide.style.boxSizing = 'border-box';
            slide.style.padding = '36px 44px';
            slide.style.position = 'relative';
            slide.style.display = 'flex';
            slide.style.flexDirection = 'column';
            slide.style.justifyContent = 'space-between';
            slide.innerHTML = htmlContent;
            slideWrapper.appendChild(slide);
            return slide;
        };
        
        // Helper to generate a compass overlay SVG
        const getCompassSVG = (rotationDeg) => `
        <div style="position: absolute; bottom: 12px; right: 12px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); border-radius: 50%; padding: 4px; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border: 1.5px solid rgba(255,255,255,0.25); z-index: 10;">
            <svg width="40" height="40" viewBox="0 0 40 40" style="transform: rotate(${rotationDeg}deg); transform-origin: center;">
                <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.5" />
                <!-- North Arrow (Red) -->
                <path d="M20,6 L23,20 L20,17 L17,20 Z" fill="rgba(0, 170, 255, 1)" />
                <!-- South Arrow (White) -->
                <path d="M20,34 L23,20 L20,17 L17,20 Z" fill="rgba(255, 255, 255, 1)" />
                <!-- N badge -->
                <circle cx="20" cy="6" r="4.5" fill="rgba(0, 170, 255, 1)" />
                <text x="20" y="8.2" font-size="6" font-family="sans-serif" font-weight="900" fill="rgba(255, 255, 255, 1)" text-anchor="middle">N</text>
            </svg>
        </div>
        `;
        
        // Extract design values for parameters display
        let siteTypeFriendly = '地面型';
        if (state.siteType === 'ground') siteTypeFriendly = '地面型';
        else if (state.siteType === 'roof-flat') siteTypeFriendly = '屋頂型：平屋頂';
        else if (state.siteType === 'roof-slope') {
            if (Math.abs(state.tilt - state.roofTilt) < 0.01) {
                siteTypeFriendly = '屋頂型：斜屋頂(平鋪)';
            } else {
                siteTypeFriendly = '屋頂型：斜屋頂(架高)';
            }
        }
        
        const pitchStyleFriendly = state.pitchStyle === 'single' ? '單斜' : (state.pitchStyle === 'double-v' ? '雙斜V' : '雙斜');
        const pvOrientFriendly = state.pvOrient === 'portrait' ? '長向傾斜 (直放)' : '短向傾斜 (橫放)';
        const selectedModel = elements.pvSelect ? elements.pvSelect.options[elements.pvSelect.selectedIndex].text : '自訂模組規格';
        const coordsStr = document.getElementById('val-coords') ? document.getElementById('val-coords').value : `${state.lat.toFixed(6)}° N, ${state.lng.toFixed(6)}° E`;
        
        const TAIWAN_DISTRICT_TO_COUNTY = {
            '中正區': '台北市', '大同區': '台北市', '中山區': '台北市', '松山區': '台北市', '大安區': '台北市',
            '萬華區': '台北市', '信義區': '台北市', '士林區': '台北市', '北投區': '台北市', '內湖區': '台北市',
            '南港區': '台北市', '文山區': '台北市',
            '板橋區': '新北市', '三重區': '新北市', '中和區': '新北市', '永和區': '新北市', '新莊區': '新北市',
            '新店區': '新北市', '樹林區': '新北市', '鶯歌區': '新北市', '三峽區': '新北市', '淡水區': '新北市',
            '汐止區': '新北市', '瑞芳區': '新北市', '土城區': '新北市', '蘆洲區': '新北市', '五股區': '新北市',
            '泰山區': '新北市', '林口區': '新北市', '深坑區': '新北市', '石碇區': '新北市', '坪林區': '新北市',
            '三芝區': '新北市', '石門區': '新北市', '八里區': '新北市', '平溪區': '新北市', '雙溪區': '新北市',
            '貢寮區': '新北市', '金山區': '新北市', '萬里區': '新北市', '烏來區': '新北市',
            '仁愛區': '基隆市', '安樂區': '基隆市', '暖暖區': '基隆市', '七堵區': '基隆市',
            '桃園區': '桃園市', '中壢區': '桃園市', '大溪區': '桃園市', '楊梅區': '桃園市', '蘆竹區': '桃園市',
            '大園區': '桃園市', '龜山區': '桃園市', '八德區': '桃園市', '龍潭區': '桃園市', '平鎮區': '桃園市',
            '新屋區': '桃園市', '觀音區': '桃園市', '復興區': '桃園市',
            '東區': '新竹市', '北區': '新竹市', '香山區': '新竹市',
            '竹北市': '新竹縣', '竹東鎮': '新竹縣', '新埔鎮': '新竹縣', '關西鎮': '新竹縣', '湖口鄉': '新竹縣',
            '新豐鄉': '新竹縣', '芎林鄉': '新竹縣', '橫山鄉': '新竹縣', '北埔鄉': '新竹縣', '寶山鄉': '新竹縣',
            '峨眉鄉': '新竹縣', '尖石鄉': '新竹縣', '五峰鄉': '新竹縣',
            '苗栗市': '苗栗縣', '頭份市': '苗栗縣', '竹南鎮': '苗栗縣', '後龍鎮': '苗栗縣', '通霄鎮': '苗栗縣',
            '苑裡鎮': '苗栗縣', '卓蘭鎮': '苗栗縣', '造橋鄉': '苗栗縣', '西湖鄉': '苗栗縣', '頭屋鄉': '苗栗縣',
            '公館鄉': '苗栗縣', '銅鑼鄉': '苗栗縣', '三義鄉': '苗栗縣', '大湖鄉': '苗栗縣', '獅潭鄉': '苗栗縣',
            '三灣鄉': '苗栗縣', '南庄鄉': '苗栗縣', '泰安鄉': '苗栗縣',
            '中區': '台中市', '南區': '台中市', '西區': '台中市', '北屯區': '台中市', '西屯區': '台中市',
            '南屯區': '台中市', '太平區': '台中市', '大里區': '台中市', '霧峰區': '台中市', '烏日區': '台中市',
            '豐原區': '台中市', '后里區': '台中市', '石岡區': '台中市', '東勢區': '台中市', '和平區': '台中市',
            '新社區': '台中市', '潭子區': '台中市', '大雅區': '台中市', '神岡區': '台中市', '大肚區': '台中市',
            '沙鹿區': '台中市', '龍井區': '台中市', '梧棲區': '台中市', '清水區': '台中市', '大甲區': '台中市',
            '外埔區': '台中市',
            '彰化市': '彰化縣', '員林市': '彰化縣', '和美鎮': '彰化縣', '鹿港鎮': '彰化縣', '溪湖鎮': '彰化縣',
            '二林鎮': '彰化縣', '田中鎮': '彰化縣', '北斗鎮': '彰化縣', '花壇鄉': '彰化縣', '芬園鄉': '彰化縣',
            '秀水鄉': '彰化縣', '福興鄉': '彰化縣', '線西鄉': '彰化縣', '伸港鄉': '彰化縣', '埔心鄉': '彰化縣',
            '大村鄉': '彰化縣', '埔鹽鄉': '彰化縣', '埤頭鄉': '彰化縣', '溪州鄉': '彰化縣', '竹塘鄉': '彰化縣',
            '田尾鄉': '彰化縣', '二水鄉': '彰化縣', '永靖鄉': '彰化縣', '社頭鄉': '彰化縣', '芳苑鄉': '彰化縣',
            '大城鄉': '彰化縣',
            '南投市': '南投縣', '埔里鎮': '南投縣', '草屯鎮': '南投縣', '竹山鎮': '南投縣', '集集鎮': '南投縣',
            '名間鄉': '南投縣', '鹿谷鄉': '南投縣', '中寮鄉': '南投縣', '魚池鄉': '南投縣', '國姓鄉': '南投縣',
            '水里鄉': '南投縣', '信義鄉': '南投縣', '仁愛鄉': '南投縣',
            '斗六市': '雲林縣', '斗南鎮': '雲林縣', '虎尾鎮': '雲林縣', '西螺鎮': '雲林縣', '土庫鎮': '雲林縣',
            '北港鎮': '雲林縣', '古坑鄉': '雲林縣', '大埤鄉': '雲林縣', '莿桐鄉': '雲林縣', '林內鄉': '雲林縣',
            '二崙鄉': '雲林縣', '崙背鄉': '雲林縣', '麥寮鄉': '雲林縣', '東勢鄉': '雲林縣', '褒忠鄉': '雲林縣',
            '臺西鄉': '雲林縣', '台西鄉': '雲林縣', '元長鄉': '雲林縣', '四湖鄉': '雲林縣', '口湖鄉': '雲林縣', '水林鄉': '雲林縣',
            '太保市': '嘉義縣', '朴子市': '嘉義縣', '布袋鎮': '嘉義縣', '大林鎮': '嘉義縣', '民雄鄉': '嘉義縣',
            '溪口鄉': '嘉義縣', '新港鄉': '嘉義縣', '六腳鄉': '嘉義縣', '東石鄉': '嘉義縣', '義竹鄉': '嘉義縣',
            '鹿草鄉': '嘉義縣', '水上鄉': '嘉義縣', '中埔鄉': '嘉義縣', '竹崎鄉': '嘉義縣', '梅山鄉': '嘉義縣',
            '番路鄉': '嘉義縣', '大埔鄉': '嘉義縣', '阿里山鄉': '嘉義縣',
            '中西區': '台南市', '安平區': '台南市', '安南區': '台南市', '永康區': '台南市', '歸仁區': '台南市',
            '新化區': '台南市', '左鎮區': '台南市', '玉井區': '台南市', '楠西區': '台南市', '南化區': '台南市',
            '仁德區': '台南市', '關廟區': '台南市', '龍崎區': '台南市', '官田區': '台南市', '麻豆區': '台南市',
            '佳里區': '台南市', '西港區': '台南市', '七股區': '台南市', '將軍區': '台南市', '學甲區': '台南市',
            '北門區': '台南市', '新營區': '台南市', '後壁區': '台南市', '白河區': '台南市', '東山區': '台南市',
            '六甲區': '台南市', '下營區': '台南市', '柳營區': '台南市', '鹽水區': '台南市', '善化區': '台南市',
            '大內區': '台南市', '山上區': '台南市', '新市區': '台南市', '安定區': '台南市',
            '新興區': '高雄市', '前金區': '高雄市', '苓雅區': '高雄市', '鹽埕區': '高雄市', '鼓山區': '高雄市',
            '旗津區': '高雄市', '前鎮區': '高雄市', '三民區': '高雄市', '楠梓區': '高雄市', '小港區': '高雄市',
            '左營區': '高雄市', '仁武區': '高雄市', '大社區': '高雄市', '岡山區': '高雄市', '路竹區': '高雄市',
            '阿蓮區': '高雄市', '田寮區': '高雄市', '燕巢區': '高雄市', '橋頭區': '高雄市', '梓官區': '高雄市',
            '彌陀區': '高雄市', '永安區': '高雄市', '湖內區': '高雄市', '鳳山區': '高雄市', '大寮區': '高雄市',
            '林園區': '高雄市', '鳥松區': '高雄市', '大樹區': '高雄市', '旗山區': '高雄市', '美濃區': '高雄市',
            '六龜區': '高雄市', '內門區': '高雄市', '杉林區': '高雄市', '甲仙區': '高雄市', '桃源區': '高雄市',
            '那瑪夏區': '高雄市', '茂林區': '高雄市', '茄萣區': '高雄市',
            '屏東市': '屏東縣', '潮州鎮': '屏東縣', '東港鎮': '屏東縣', '恆春鎮': '屏東縣', '萬丹鄉': '屏東縣',
            '長治鄉': '屏東縣', '麟洛鄉': '屏東縣', '九如鄉': '屏東縣', '里港鄉': '屏東縣', '鹽埔鄉': '屏東縣',
            '高樹鄉': '屏東縣', '萬巒鄉': '屏東縣', '內埔鄉': '屏東縣', '竹田鄉': '屏東縣', '新埤鄉': '屏東縣',
            '枋寮鄉': '屏東縣', '新園鄉': '屏東縣', '崁頂鄉': '屏東縣', '林邊鄉': '屏東縣', '南州鄉': '屏東縣',
            '佳冬鄉': '屏東縣', '琉球鄉': '屏東縣', '車城鄉': '屏東縣', '滿州鄉': '屏東縣', '枋山鄉': '屏東縣',
            '三地門鄉': '屏東縣', '霧臺鄉': '屏東縣', '瑪家鄉': '屏東縣', '泰武鄉': '屏東縣', '來義鄉': '屏東縣',
            '春日鄉': '屏東縣', '獅子鄉': '屏東縣', '牡丹鄉': '屏東縣',
            '宜蘭市': '宜蘭縣', '羅東鎮': '宜蘭縣', '蘇澳鎮': '宜蘭縣', '頭城鎮': '宜蘭縣', '礁溪鄉': '宜蘭縣',
            '壯圍鄉': '宜蘭縣', '員山鄉': '宜蘭縣', '冬山鄉': '宜蘭縣', '五結鄉': '宜蘭縣', '三星鄉': '宜蘭縣',
            '大同鄉': '宜蘭縣', '南澳鄉': '宜蘭縣',
            '花蓮市': '花蓮縣', '鳳林鎮': '花蓮縣', '玉里鎮': '花蓮縣', '新城鄉': '花蓮縣', '吉安鄉': '花蓮縣',
            '壽豐鄉': '花蓮縣', '光復鄉': '花蓮縣', '豐濱鄉': '花蓮縣', '瑞穗鄉': '花蓮縣', '富里鄉': '花蓮縣',
            '秀林鄉': '花蓮縣', '萬榮鄉': '花蓮縣', '卓溪鄉': '花蓮縣',
            '台東市': '台東縣', '成功鎮': '台東縣', '關山鎮': '台東縣', '卑南鄉': '台東縣', '大武鄉': '台東縣',
            '太麻里鄉': '台東縣', '東河鄉': '台東縣', '長濱鄉': '台東縣', '鹿野鄉': '台東縣', '池上鄉': '台東縣',
            '綠島鄉': '台東縣', '延平鄉': '台東縣', '海端鄉': '台東縣', '達仁鄉': '台東縣', '金峰鄉': '台東縣', '蘭嶼鄉': '台東縣',
            '馬公市': '澎湖縣', '湖西鄉': '澎湖縣', '白沙鄉': '澎湖縣', '西嶼鄉': '澎湖縣', '望安鄉': '澎湖縣', '七美鄉': '澎湖縣',
            '金城鎮': '金門縣', '金湖鎮': '金門縣', '金沙鎮': '金門縣', '金寧鄉': '金門縣', '烈嶼鄉': '金門縣', '烏坵鄉': '金門縣',
            '南竿鄉': '連江縣', '北竿鄉': '連江縣', '莒光鄉': '連江縣', '東引鄉': '連江縣'
        };

        const TAIWAN_ENG_MAP = {
            'zhubei': '竹北市', 'hsinchu': '新竹市', 'taipei': '台北市', 'new taipei': '新北市',
            'taoyuan': '桃園市', 'taichung': '台中市', 'tainan': '台南市', 'kaohsiung': '高雄市',
            'keelung': '基隆市', 'chiayi': '嘉義市', 'miaoli': '苗栗縣', 'changhua': '彰化縣',
            'nantou': '南投縣', 'yunlin': '雲林縣', 'pingtung': '屏東縣', 'yilan': '宜蘭縣',
            'hualien': '花蓮縣', 'taitung': '台東縣', 'penghu': '澎湖縣', 'kinmen': '金門縣'
        };

        const extractTaiwanAdminRegion = (text) => {
            if (!text) return '';
            const lower = text.toLowerCase();
            
            // Check English mapping
            for (const [eng, zh] of Object.entries(TAIWAN_ENG_MAP)) {
                if (lower.includes(eng)) {
                    if (TAIWAN_DISTRICT_TO_COUNTY[zh]) {
                        return `${TAIWAN_DISTRICT_TO_COUNTY[zh]}${zh}`;
                    }
                    return zh;
                }
            }
            
            // Check specific Chinese districts in reverse dictionary
            for (const [dist, county] of Object.entries(TAIWAN_DISTRICT_TO_COUNTY)) {
                if (text.includes(dist)) {
                    return `${county}${dist}`;
                }
            }
            
            let clean = text.replace(/台灣省|臺灣省|台灣|臺灣|中華民國|Taiwan Province|Taiwan/gi, ' ')
                            .replace(/^\d+/, '')
                            .trim();
            const match = clean.match(/([^\s,，縣市]+(?:縣|市))([^\s,，鄉鎮市區]+(?:鄉|鎮|市|區))/);
            if (match) {
                let c1 = match[1].replace(/^(省)/, '').trim();
                let c2 = match[2].trim();
                if (c1 && c2 && c1 !== c2) {
                    return `${c1}${c2}`;
                }
            }
            return '';
        };

        let shortAddressStr = '';
        const currentPosKey = `${state.lat.toFixed(5)}_${state.lng.toFixed(5)}`;
        
        // 1. Check in-memory cache
        if (addressCache.key === currentPosKey && addressCache.shortAddress && addressCache.shortAddress !== '未指定地址' && !addressCache.shortAddress.includes('台灣省') && !addressCache.shortAddress.includes('Zhubei')) {
            shortAddressStr = addressCache.shortAddress;
        }
        
        // 2. Check input search box
        if (!shortAddressStr) {
            const inputVal = elements.mapSearchInput ? elements.mapSearchInput.value : '';
            const fromInput = extractTaiwanAdminRegion(inputVal);
            if (fromInput) {
                shortAddressStr = fromInput;
            }
        }
        
        // 3. Try OSM Nominatim Reverse Geocoding with zoom=14 (Township level)
        if (!shortAddressStr) {
            try {
                const revRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${state.lat}&lon=${state.lng}&accept-language=zh-TW&zoom=14`, {
                    headers: { 'User-Agent': 'PV-Super-Solar-Planner/1.0' }
                });
                if (revRes.ok) {
                    const revData = await revRes.json();
                    if (revData && revData.address) {
                        const addr = revData.address;
                        const cleanVal = (v) => (v || '').replace(/台灣省|臺灣省|台灣|臺灣|Taiwan Province|Taiwan/gi, '').trim();
                        const cityOrCounty = cleanVal(addr.county || addr.city || addr.town || '');
                        const districtOrTown = cleanVal(addr.town || addr.suburb || addr.city_district || addr.district || '');
                        if (cityOrCounty && districtOrTown && cityOrCounty !== districtOrTown) {
                            shortAddressStr = extractTaiwanAdminRegion(`${cityOrCounty}${districtOrTown}`) || `${cityOrCounty}${districtOrTown}`;
                        } else if (revData.display_name) {
                            shortAddressStr = extractTaiwanAdminRegion(revData.display_name);
                        }
                    } else if (revData && revData.display_name) {
                        shortAddressStr = extractTaiwanAdminRegion(revData.display_name);
                    }
                }
            } catch (err) {
                console.warn('Nominatim reverse geocode error:', err);
            }
        }
        
        // 4. Try Photon Reverse Geocoding (Fallback)
        if (!shortAddressStr) {
            try {
                if (title) title.innerText = '正在獲取案場行政區位置...';
                const photonRes = await fetch(`https://photon.komoot.io/reverse?lat=${state.lat}&lon=${state.lng}`);
                if (photonRes.ok) {
                    const data = await photonRes.json();
                    if (data && data.features && data.features.length > 0) {
                        const p = data.features[0].properties || {};
                        const combined = [p.county, p.city, p.district, p.name, p.state].filter(Boolean).join(' ');
                        const extracted = extractTaiwanAdminRegion(combined);
                        if (extracted) {
                            shortAddressStr = extracted;
                        }
                    }
                }
            } catch (err) {
                console.warn('Photon reverse geocode error:', err);
            }
        }
        
        // 5. Fallback formatting
        if (!shortAddressStr) {
            shortAddressStr = `${state.lat >= 0 ? 'N' : 'S'}${Math.abs(state.lat).toFixed(4)}° / ${state.lng >= 0 ? 'E' : 'W'}${Math.abs(state.lng).toFixed(4)}°`;
        }
        
        addressCache.key = currentPosKey;
        addressCache.shortAddress = shortAddressStr;

        const addItem = (num, label, val, colSpan = 1) => `
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px 10px; display: flex; flex-direction: column; justify-content: center; ${colSpan > 1 ? `grid-column: span ${colSpan};` : ''}">
                <div style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${num}. ${label}</div>
                <div style="font-size: 0.88rem; font-weight: 700; color: #f8fafc; word-break: break-word; line-height: 1.25;" title="${val}">${val}</div>
            </div>
        `;

        const gridItems = [];
        gridItems.push(addItem('3', '坡向型式', pitchStyleFriendly));
        gridItems.push(addItem('4', 'PV 擺放選擇', pvOrientFriendly));
        gridItems.push(addItem('5', 'PV 模組規格', selectedModel, 2));
        gridItems.push(addItem('6', 'PV 長度 (L)', `${state.pvL} mm`));
        gridItems.push(addItem('7', 'PV 寬度 (W)', `${state.pvW} mm`));
        let azimuthDisplay = `${state.azimuth}°`;
        if (state.pitchStyle === 'double' || state.pitchStyle === 'double-v') {
            const curAz = parseFloat(state.azimuth) || 0;
            const oppAz = (curAz + 180) % 360;
            const a1 = Math.min(curAz, oppAz);
            const a2 = Math.max(curAz, oppAz);
            azimuthDisplay = `${a1}/${a2}°`;
        }
        gridItems.push(addItem('9', '方位角 (Azimuth)', azimuthDisplay));
        gridItems.push(addItem('10', '橫向排列片數 (i)', `${state.arrI} 片`));
        gridItems.push(addItem('11', '縱向排列片數 (j)', `${state.arrJ} 片`));
        
        if (state.siteType === 'ground' || (state.siteType === 'roof-flat' && state.arrM > 1)) {
            gridItems.push(addItem('12', '組列數量 (m)', `${state.arrM} 組`));
        }
        if ((state.siteType === 'ground' || state.siteType === 'roof-flat') && state.arrM > 1) {
            gridItems.push(addItem('13', '組列間距 (p)', `${state.arrP} m`));
        }
        
        gridItems.push(addItem('14', '橫向間距 x', `${state.spX} mm`));
        gridItems.push(addItem('15', '縱向間距 y', `${state.spY} mm`));
        gridItems.push(addItem('16', '安裝傾角 (θ)', `${state.tilt}°`));
        
        if (state.siteType === 'roof-slope') {
            gridItems.push(addItem('17', '屋頂傾角 (Roof θ)', `${state.roofTilt}°`));
        }
        if (state.siteType === 'roof-flat' || state.siteType === 'roof-slope') {
            gridItems.push(addItem('18', '屋頂高度 (H)', `${state.roofH} m`));
        }
        if (state.siteType !== 'roof-slope' || Math.abs(state.tilt - state.roofTilt) >= 0.01) {
            gridItems.push(addItem('19', '支架高度 (h)', `${state.supportH} mm`));
        }
        
        gridItems.push(addItem('20', '案場經緯度', coordsStr, 2));
        gridItems.push(addItem('23', '佔地寬度 (X)', `${state.dimW} m`));
        gridItems.push(addItem('24', '佔地長度 (Y)', `${state.dimH} m`));
        
        let areaVal = 0;
        if (customSiteBoundary && typeof customSiteBoundary.toGeoJSON === 'function' && window.turf) {
            areaVal = turf.area(customSiteBoundary.toGeoJSON());
        } else if (coveragePolygon && typeof coveragePolygon.toGeoJSON === 'function' && window.turf) {
            areaVal = turf.area(coveragePolygon.toGeoJSON());
        } else {
            areaVal = parseFloat(state.dimW) * parseFloat(state.dimH);
        }
        gridItems.push(addItem('25', '佔地面積', `${areaVal.toFixed(2)} m²`));

        // Fixed map sizing logic for Slide 3 (1:1 square ratio, aligned to 3:2 layout)
        const mapDisplayW = 570;
        const mapDisplayH = 570;
        
        // Slide 1: Site Information
        const slide1 = createSlide(`
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(51, 65, 85, 1); padding-bottom: 18px;">
                <div style="display: flex; align-items: center; gap: 16px;">
                    <img src="${LOGO_WEB_BASE64}" style="height: 50px; width: auto; object-fit: contain;">
                    <span style="font-size: 1.4rem; font-weight: bold; color: rgba(16, 185, 129, 1); letter-spacing: 0.5px;">曜昇綠能股份有限公司</span>
                </div>
                <div style="display: flex; align-items: center;">
                    <span style="font-size: 2.0rem; font-weight: 800; color: rgba(255, 255, 255, 1); letter-spacing: 1px;">案場評估簡報</span>
                </div>
            </div>
            
            <div style="display: flex; gap: 28px; margin-top: 20px; flex: 1; min-height: 0;">
                <!-- Left Side: 4 Highlighted Cards (1, 2, 21, 22) -->
                <div style="width: 300px; display: flex; flex-direction: column; gap: 10px; flex-shrink: 0;">
                    <div style="font-size: 0.88rem; font-weight: bold; color: rgba(56, 189, 248, 1); border-left: 3px solid rgba(56, 189, 248, 1); padding-left: 8px;">主要案場資訊</div>
                    
                    <!-- Card 1: 案場名稱 -->
                    <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 10px 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <div style="font-size: 0.72rem; color: rgba(148, 163, 184, 1); margin-bottom: 3px;">1. 案場名稱</div>
                        <div style="font-size: 1.15rem; font-weight: bold; color: rgba(56, 189, 248, 1); word-break: break-word; line-height: 1.3;" title="${state.siteName}">${state.siteName}</div>
                    </div>
                    
                    <!-- Card 2: 案場類型 -->
                    <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border: 1.5px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 10px 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <div style="font-size: 0.72rem; color: rgba(148, 163, 184, 1); margin-bottom: 3px;">2. 案場類型</div>
                        <div style="font-size: 1.05rem; font-weight: bold; color: rgba(255, 255, 255, 1); line-height: 1.3;">${siteTypeFriendly}</div>
                    </div>
                    
                    <!-- Card 21: 總片數 -->
                    <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border: 1.5px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 10px 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <div style="font-size: 0.72rem; color: rgba(203, 213, 225, 1); margin-bottom: 3px;">21. 總片數</div>
                        <div style="font-size: 1.3rem; font-weight: 800; color: rgba(16, 185, 129, 1); line-height: 1.2;">${state.totalCount} <span style="font-size: 0.8rem; font-weight: normal; color: rgba(148, 163, 184, 1);">片</span></div>
                    </div>
                    
                    <!-- Card 22: 設置量 -->
                    <div style="background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); border: 1.5px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 10px 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
                        <div style="font-size: 0.72rem; color: rgba(253, 230, 138, 1); margin-bottom: 3px;">22. 設置量</div>
                        <div style="font-size: 1.35rem; font-weight: 800; color: rgba(245, 158, 11, 1); line-height: 1.2;">${parseFloat(state.totalPower).toFixed(2)} <span style="font-size: 0.8rem; font-weight: normal; color: rgba(148, 163, 184, 1);">kWp</span></div>
                    </div>
                </div>
                
                <!-- Right Side: Grid for remaining 3~25 parameters -->
                <div style="flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="font-size: 0.88rem; font-weight: bold; color: rgba(16, 185, 129, 1); border-left: 3px solid rgba(16, 185, 129, 1); padding-left: 8px;">設計參數與輸出 (項次 3~25)</div>
                    
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 12px; background: rgba(30, 41, 59, 0.45); border: 1px solid rgba(51, 65, 85, 0.9); border-radius: 12px; padding: 12px 14px; flex: 1;">
                        ${gridItems.join('')}
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(51, 65, 85, 1); padding-top: 14px; font-size: 0.88rem; color: rgba(100, 116, 139, 1); margin-top: 8px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${logoBase64}" style="height: 40px; width: auto; object-fit: contain;">
                    <span style="font-weight: 500;">Professional Solar Design Suite</span>
                </div>
                <span>Page 1 of 3</span>
            </div>
        `);
        
        // Slide 2: 3D Views Simulation (2x2 Grid)
        const slide2 = createSlide(`
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(51, 65, 85, 1); padding-bottom: 12px;">
                <div style="font-size: 1.25rem; font-weight: bold; color: rgba(16, 185, 129, 1);">3D 擬真視角與方位模擬 (3D Simulation)</div>
                <div style="font-size: 1.15rem; color: rgba(148, 163, 184, 1); font-weight: 500;">${state.siteName}</div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px 20px; margin-top: 14px; flex: 1; min-height: 0;">
                <!-- Row 1, Col 1: 放大圖 -->
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; min-height: 0;">
                    <div style="font-weight: bold; color: rgba(56, 189, 248, 1); font-size: 0.95rem; text-align: center;">放大圖</div>
                    <div style="width: 100%; height: 232px; background: rgba(2, 6, 23, 1); border: 1.5px solid rgba(51, 65, 85, 1); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); position: relative;">
                        <img src="${localTopViewImg}" style="width: 100%; height: 100%; object-fit: contain; display: block;">
                    </div>
                </div>
                
                <!-- Row 1, Col 2: 透視圖 -->
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; min-height: 0;">
                    <div style="font-weight: bold; color: rgba(56, 189, 248, 1); font-size: 0.95rem; text-align: center;">透視圖</div>
                    <div style="width: 100%; height: 232px; background: rgba(2, 6, 23, 1); border: 1.5px solid rgba(51, 65, 85, 1); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); position: relative;">
                        <img src="${homeViewImg}" style="width: 100%; height: 100%; object-fit: contain; display: block;">
                    </div>
                </div>
                
                <!-- Row 2, Col 1: 上視圖 -->
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; min-height: 0;">
                    <div style="font-weight: bold; color: rgba(56, 189, 248, 1); font-size: 0.95rem; text-align: center;">上視圖</div>
                    <div style="width: 100%; height: 232px; background: rgba(2, 6, 23, 1); border: 1.5px solid rgba(51, 65, 85, 1); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); position: relative;">
                        <img src="${topViewImg}" style="width: 100%; height: 100%; object-fit: contain; display: block;">
                        ${getCompassSVG(0)}
                    </div>
                </div>
                
                <!-- Row 2, Col 2: 側視圖 -->
                <div style="display: flex; flex-direction: column; gap: 6px; align-items: center; min-height: 0;">
                    <div style="font-weight: bold; color: rgba(56, 189, 248, 1); font-size: 0.95rem; text-align: center;">側視圖 (平行投影)</div>
                    <div style="width: 100%; height: 232px; background: rgba(2, 6, 23, 1); border: 1.5px solid rgba(51, 65, 85, 1); border-radius: 8px; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); position: relative;">
                        <img src="${sideViewImg}" style="width: 100%; height: 198px; object-fit: contain; display: block;">
                        <!-- 顏色標示圖例 (模組、支架組件、建物、地面) -->
                        <div style="width: 100%; display: flex; gap: 10px; justify-content: center; align-items: center; padding: 4px 6px; background: rgba(15, 23, 42, 0.90); font-size: 0.70rem; color: #cbd5e1; border-top: 1px solid rgba(51, 65, 85, 0.6); box-sizing: border-box;">
                            <span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display:inline-block; width:8px; height:8px; background:#1d4ed8; border:1px solid #60a5fa; border-radius:2px;"></span>模組</span>
                            <span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display:inline-block; width:8px; height:8px; background:#f59e0b; border:1px solid #fbbf24; border-radius:2px;"></span>支架組件</span>
                            ${state.siteType !== 'ground' ? '<span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display:inline-block; width:8px; height:8px; background:#94a3b8; border:1px solid #cbd5e1; border-radius:2px;"></span>建物</span>' : ''}
                            <span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display:inline-block; width:8px; height:8px; background:#22c55e; border:1px solid #4ade80; border-radius:2px;"></span>地面</span>
                        </div>
                    </div>
                </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(51, 65, 85, 1); padding-top: 12px; font-size: 0.9rem; color: rgba(100, 116, 139, 1); margin-top: 10px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${logoBase64}" style="height: 44px; width: auto; object-fit: contain;">
                    <span style="font-weight: 500;">Professional Solar Design Suite</span>
                </div>
                <span>Page 2 of 3</span>
            </div>
        `);
        
        // Slide 3: Map View Slide
        const slide3 = createSlide(`
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid rgba(51, 65, 85, 1); padding-bottom: 15px;">
                <div style="font-size: 1.25rem; font-weight: bold; color: rgba(16, 185, 129, 1);">衛星地圖案場定位與覆蓋 (Satellite Map Overlay)</div>
                <div style="font-size: 1.15rem; color: rgba(148, 163, 184, 1); font-weight: 500;">${state.siteName}</div>
            </div>
            
            <div style="display: flex; gap: 40px; margin-top: 25px; flex: 1; min-height: 0; align-items: center; justify-content: center;">
                <!-- Left Side: Map Capture Image (1:1 square ratio, 3/5 width) -->
                <div style="display: flex; flex-direction: column; gap: 8px; min-height: 0; align-items: center;">
                    <div style="font-weight: bold; color: rgba(56, 189, 248, 1); font-size: 1rem; text-align: center;">案場航照圖定位</div>
                    <div style="width: ${mapDisplayW}px; height: ${mapDisplayH}px; background: rgba(2, 6, 23, 1); border: 1.5px solid rgba(51, 65, 85, 1); border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); position: relative;">
                        <img src="${mapImg}" style="width: 100%; height: 100%; display: block;">
                        ${getCompassSVG(0)}
                    </div>
                </div>
                
                <!-- Right Side: Address & Coordinates Card (2/5 width, matching map height) -->
                <div style="width: 380px; height: 570px; display: flex; flex-direction: column; gap: 15px; justify-content: center; flex-shrink: 0; box-sizing: border-box; margin-top: 28px;">
                    <div style="font-weight: bold; color: rgba(16, 185, 129, 1); font-size: 1.05rem; text-align: center; border-bottom: 1px dashed rgba(51, 65, 85, 1); padding-bottom: 8px; margin-bottom: 6px;">案場地理座標資訊</div>
                    
                    <div style="background: rgba(30, 41, 59, 0.6); border: 1.5px solid rgba(51, 65, 85, 1); border-radius: 12px; padding: 25px 30px; display: flex; flex-direction: column; gap: 22px; box-shadow: 0 4px 12px rgba(0,0,0,0.2); flex: 1; justify-content: center;">
                        <div>
                            <div style="font-size: 0.9rem; color: rgba(148, 163, 184, 1); margin-bottom: 8px; font-weight: 500;">案場中心經緯度</div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: rgba(255, 255, 255, 1); line-height: 1.455;">
                                緯度 (Lat): <span style="color: rgba(56, 189, 248, 1); font-family: monospace;">${state.lat.toFixed(6)}° N</span><br>
                                經度 (Lng): <span style="color: rgba(56, 189, 248, 1); font-family: monospace;">${state.lng.toFixed(6)}° E</span>
                            </div>
                        </div>
                        
                        <div>
                            <div style="font-size: 0.9rem; color: rgba(148, 163, 184, 1); margin-bottom: 8px; font-weight: 500;">案場地址</div>
                            <div style="font-size: 1.25rem; font-weight: bold; color: rgba(16, 185, 129, 1); line-height: 1.5; word-break: break-all;">
                                ${shortAddressStr}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(51, 65, 85, 1); padding-top: 15px; font-size: 0.9rem; color: rgba(100, 116, 139, 1); margin-top: 15px;">
                <div style="display: flex; align-items: center; gap: 12px;">
                    <img src="${logoBase64}" style="height: 44px; width: auto; object-fit: contain;">
                    <span style="font-weight: 500;">Professional Solar Design Suite</span>
                </div>
                <span>Page 3 of 3</span>
            </div>
        `);
        
        // 4. Render HTML slides to canvas and build the PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });
        
        if (title) title.innerText = '正在輸出 A4 簡報頁面 (高畫質渲染中)...';
        
        // Parallel capturing of all 3 slides simultaneously using Promise.all & optimized 2.0x scale (3.5x -> 2.0x saves 67% pixels & runs 4x faster)
        const [canvas1, canvas2, canvas3] = await Promise.all([
            html2canvas(slide1, { scale: 2.0, logging: false }),
            html2canvas(slide2, { scale: 2.0, logging: false }),
            html2canvas(slide3, { scale: 2.0, logging: false })
        ]);
        
        // Build PDF document
        const imgData1 = canvas1.toDataURL('image/jpeg', 0.88);
        pdf.addImage(imgData1, 'JPEG', 0, 0, 297, 210);
        
        pdf.addPage();
        const imgData2 = canvas2.toDataURL('image/jpeg', 0.88);
        pdf.addImage(imgData2, 'JPEG', 0, 0, 297, 210);
        
        pdf.addPage();
        const imgData3 = canvas3.toDataURL('image/jpeg', 0.88);
        pdf.addImage(imgData3, 'JPEG', 0, 0, 297, 210);
        
        // Save PDF using saveFileWithPicker
        const siteNameClean = (state && state.siteName) ? state.siteName.trim() : '太陽能案場';
        const now = new Date();
        const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const hhmmss = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        const defaultFilename = siteNameClean + "_" + yyyymmdd + "_" + hhmmss + ".pdf";
        
            if (title) title.innerText = "\u8f09\u5165\u4e2d...";
        const pdfBlob = pdf.output('blob');
        await saveFileWithPicker(pdfBlob, defaultFilename, 'application/pdf');
        
        // Clean up temporary DOM elements
        document.body.removeChild(slideWrapper);
        
    } catch (error) {
        console.error('Error exporting presentation PDF:', error);
        alert("\u7c21\u5831\u532f\u51fa\u5931\u6557\uff1a" + error.message);
    } finally {
        if (loader) {
            loader.classList.remove('active');
            const title = loader.querySelector('.loading-title') || loader;
            if (title) title.innerText = "\u8f09\u5165\u4e2d...";
        }
    }
}
