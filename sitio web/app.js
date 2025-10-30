// ===== CONFIGURACIÓN DE SUPABASE =====
// IMPORTANTE: Reemplaza con tus credenciales reales
const SUPABASE_URL = 'https://ymzzzssjzqwyboqxhyoi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inltenp6c3NqenF3eWJvcXhoeW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2OTczNTEsImV4cCI6MjA3NzI3MzM1MX0.dbdGkJqL5Oxd0BY8EpOt_IdZ0Ma0u0MGRiBml_IvV9o';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== VARIABLES GLOBALES =====
let currentUser = null;
let catalogData = { propertyTypes: [], transactionTypes: [], statusTypes: [] };
let caracteristicas = [];

// ===== FUNCIONES DE CONSOLA =====
function logConsole(message, type = 'info') {
    const consoleEl = document.getElementById('console');
    const line = document.createElement('div');
    line.className = `console-line console-${type}`;
    const timestamp = new Date().toLocaleTimeString();
    line.textContent = `[${timestamp}] ${message}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

// ===== AUTENTICACIÓN =====
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    logConsole('Intentando iniciar sesión...', 'info');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) throw error;

        currentUser = data.user;
        document.getElementById('userEmail').textContent = email;

        logConsole(`✅ Login exitoso: ${email}`, 'success');

        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');

        await loadCatalogs();
        await loadProperties();
    } catch (error) {
        logConsole(`❌ Error login: ${error.message}`, 'error');
        alert('Error al iniciar sesión: ' + error.message);
    }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
    try {
        await supabase.auth.signOut();
        currentUser = null;

        logConsole('👋 Sesión cerrada correctamente', 'info');

        document.getElementById('adminDashboard').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('loginForm').reset();
        document.getElementById('console').innerHTML = '<div class="console-line console-info">[Sistema] Consola reiniciada...</div>';
    } catch (error) {
        logConsole(`❌ Error al cerrar sesión: ${error.message}`, 'error');
    }
});

// ===== HELPERS =====


// ===== CARGAR CATÁLOGOS =====
async function loadCatalogs() {
    try {
        logConsole('Cargando catálogos...', 'info');

        const [propTypes, transTypes, statTypes] = await Promise.all([
            supabase.from('property_type').select('*').order('name'),
            supabase.from('transaction_type').select('*').order('name'),
            supabase.from('status_type').select('*').order('name')
        ]);

        if (propTypes.error) throw propTypes.error;
        if (transTypes.error) throw transTypes.error;
        if (statTypes.error) throw statTypes.error;

        catalogData.propertyTypes = propTypes.data || [];
        catalogData.transactionTypes = transTypes.data || [];
        catalogData.statusTypes = statTypes.data || [];

        populateSelects();
        logConsole('✅ Catálogos cargados correctamente', 'success');
    } catch (error) {
        logConsole(`❌ Error cargando catálogos: ${error.message}`, 'error');
    }
}

function populateSelects() {
    const propTypeSelect = document.getElementById('propType');
    const transSelect = document.getElementById('propTransaction');
    const statusSelect = document.getElementById('propStatus');

    propTypeSelect.innerHTML = catalogData.propertyTypes.map(t =>
        `<option value="${t.id}">${t.name}</option>`
    ).join('');

    transSelect.innerHTML = catalogData.transactionTypes.map(t =>
        `<option value="${t.id}">${t.name}</option>`
    ).join('');

    statusSelect.innerHTML = catalogData.statusTypes.map(t =>
        `<option value="${t.id}">${t.name}</option>`
    ).join('');
}

// ===== CARGAR PROPIEDADES =====
async function loadProperties() {
    const container = document.getElementById('propertiesList');
    container.innerHTML = '<div class="loading">⏳ Cargando propiedades...</div>';

    try {
        logConsole('Cargando lista de propiedades...', 'info');

        // 1) Trae SOLO properties (sin embebidos)
        const { data: props, error } = await supabase
            .from('property')
            .select(`
                id,nombre,precio,property_type_id,transaction_type_id,status_type_id,
                estrato,area_m2,habitaciones,banos,parqueadero,caracteristicas,created_at
                `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!props || props.length === 0) {
            container.innerHTML = `
                        <div class="empty-state">
                            <h3>📭 No hay propiedades</h3>
                            <p>Crea una nueva propiedad para comenzar</p>
                        </div>
                    `;
            logConsole('⚠️ No se encontraron propiedades', 'warning');
            return;
        }

        // 2) Cargar catálogos para mostrar nombres
        const [pt, tt, st] = await Promise.all([
            supabase.from('property_type').select('id,name'),
            supabase.from('transaction_type').select('id,name'),
            supabase.from('status_type').select('id,name')
        ]);
        const toMap = (arr) => Object.fromEntries((arr.data || []).map(x => [x.id, x.name]));
        const PT = toMap(pt), TT = toMap(tt), ST = toMap(st);

        // 3) Traer locations y media en consultas separadas
        const ids = props.map(p => p.id);
        const [{ data: locs }, { data: med }] = await Promise.all([
            supabase.from('location').select('*').in('property_id', ids),
            supabase.from('media').select('*').in('property_id', ids)
                .order('is_primary', { ascending: false })
                .order('sort_order', { ascending: true })
        ]);
        const locByPid = {};
        (locs || []).forEach(l => { locByPid[l.property_id] = l; });
        const mediaByPid = {};
        (med || []).forEach(m => {
            (mediaByPid[m.property_id] ||= []).push(m);
        });

        container.innerHTML = props.map(prop => {
            const location = locByPid[prop.id] || {};
            const images = mediaByPid[prop.id] || [];
            const imageCount = images.length;

            return `
                        <div class="property-card">
                            <h3>${prop.nombre}</h3>
                            <div class="property-info">
                                <div class="property-info-item"><strong>Tipo:</strong> ${PT[prop.property_type_id] || 'N/A'}</div>
                                <div class="property-info-item"><strong>Transacción:</strong> ${TT[prop.transaction_type_id] || 'N/A'}</div>
                                <div class="property-info-item"><strong>Estado:</strong> ${ST[prop.status_type_id] || 'N/A'}</div>
                                <div class="property-info-item"><strong>Precio:</strong> ${prop.precio?.toLocaleString() || 0}</div>
                                <div class="property-info-item"><strong>Área:</strong> ${prop.area_m2 || 'N/A'} m²</div>
                                <div class="property-info-item"><strong>Habitaciones:</strong> ${prop.habitaciones || 0}</div>
                                <div class="property-info-item"><strong>Baños:</strong> ${prop.banos || 0}</div>
                                <div class="property-info-item"><strong>Estrato:</strong> ${prop.estrato || 'N/A'}</div>
                                <div class="property-info-item"><strong>Municipio:</strong> ${location.municipio || 'N/A'}</div>
                                <div class="property-info-item"><strong>Sector:</strong> ${location.sector || 'N/A'}</div>
                                <div class="property-info-item"><strong>Dirección:</strong> ${location.direccion || 'N/A'}</div>
                                <div class="property-info-item"><strong>Parqueadero:</strong> ${prop.parqueadero ? 'Sí' : 'No'}</div>
                                <div class="property-info-item"><strong>Galería:</strong> ${imageCount}</div>
                            </div>
                            <div class="property-actions">
                                <button class="btn btn-primary btn-small" onclick="editProperty(${prop.id})">✏️ Editar</button>
                                <button class="btn btn-success btn-small" onclick="manageGallery(${prop.id}, '${prop.nombre.replace(/'/g, "\\'")}')">🖼️ Galería</button>
                                <button class="btn btn-danger btn-small" onclick="deleteProperty(${prop.id}, '${prop.nombre.replace(/'/g, "\\'")}')">🗑️ Eliminar</button>
                            </div>
                        </div>
                    `;
        }).join('');

        logConsole(`✅ ${props.length} propiedad(es) cargada(s)`, 'success');
    } catch (error) {
        logConsole(`❌ Error cargando propiedades: ${error.message}`, 'error');
        container.innerHTML = `
                    <div class="empty-state">
                        <h3>❌ Error al cargar propiedades</h3>
                        <p>${error.message}</p>
                    </div>
                `;
    }
}

// ===== NUEVA PROPIEDAD =====
document.getElementById('btnNewProperty').addEventListener('click', () => {
    document.getElementById('modalTitle').textContent = 'Nueva Propiedad';
    document.getElementById('propertyForm').reset();
    document.getElementById('editPropertyId').value = '';
    caracteristicas = [];
    updateCaracteristicasList();
    document.getElementById('propertyModal').classList.remove('hidden');
    logConsole('📝 Abriendo formulario para nueva propiedad', 'info');
});

// ===== EDITAR PROPIEDAD =====
async function editProperty(id) {
    try {
        logConsole(`Cargando datos de propiedad ID: ${id}...`, 'info');

        const { data, error } = await supabase
            .from('property')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const { data: loc } = await supabase
            .from('location')
            .select('*')
            .eq('property_id', id)
            .maybeSingle();

        document.getElementById('modalTitle').textContent = 'Editar Propiedad';
        document.getElementById('editPropertyId').value = data.id;
        document.getElementById('propNombre').value = data.nombre;
        document.getElementById('propType').value = data.property_type_id;
        document.getElementById('propTransaction').value = data.transaction_type_id;
        document.getElementById('propPrecio').value = data.precio;
        document.getElementById('propStatus').value = data.status_type_id;
        document.getElementById('propEstrato').value = data.estrato || '';
        document.getElementById('propArea').value = data.area_m2 || '';
        document.getElementById('propHabitaciones').value = data.habitaciones || '';
        document.getElementById('propBanos').value = data.banos || '';
        document.getElementById('propParqueadero').checked = data.parqueadero;
        document.getElementById('propDescripcion').value = data.descripcion || '';

        // USAR el resultado de la consulta separada a `location`
        const location = loc || {};
        document.getElementById('propMunicipio').value = location.municipio || '';
        document.getElementById('propSector').value = location.sector || '';
        document.getElementById('propDireccion').value = location.direccion || '';

        caracteristicas = Array.isArray(data.caracteristicas) ? data.caracteristicas : [];
        updateCaracteristicasList();

        document.getElementById('propertyModal').classList.remove('hidden');
        logConsole(`✅ Editando propiedad: ${data.nombre}`, 'success');
    } catch (error) {
        logConsole(`❌ Error cargando propiedad: ${error.message}`, 'error');
        alert('Error al cargar la propiedad: ' + error.message);
    }
}

// ===== GUARDAR PROPIEDAD =====
document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const propertyId = document.getElementById('editPropertyId').value;
    const isEdit = !!propertyId;

    const propertyData = {
        nombre: document.getElementById('propNombre').value,
        property_type_id: parseInt(document.getElementById('propType').value),
        transaction_type_id: parseInt(document.getElementById('propTransaction').value),
        precio: parseFloat(document.getElementById('propPrecio').value),
        status_type_id: parseInt(document.getElementById('propStatus').value),
        estrato: document.getElementById('propEstrato').value ? parseInt(document.getElementById('propEstrato').value) : null,
        area_m2: document.getElementById('propArea').value ? parseFloat(document.getElementById('propArea').value) : null,
        habitaciones: document.getElementById('propHabitaciones').value ? parseInt(document.getElementById('propHabitaciones').value) : null,
        banos: document.getElementById('propBanos').value ? parseInt(document.getElementById('propBanos').value) : null,
        parqueadero: document.getElementById('propParqueadero').checked,
        descripcion: document.getElementById('propDescripcion').value || null,
        caracteristicas: caracteristicas
    };

    const locationData = {
        municipio: document.getElementById('propMunicipio').value,
        sector: document.getElementById('propSector').value || null,
        direccion: document.getElementById('propDireccion').value || null
    };

    try {
        logConsole(`${isEdit ? 'Actualizando' : 'Creando'} propiedad...`, 'info');

        if (isEdit) {
            // Actualizar propiedad existente
            const { error: propError } = await supabase
                .from('property')
                .update(propertyData)
                .eq('id', propertyId);

            if (propError) throw propError;

            // Actualizar location, crear si no existe, actualizar si existe
            const { error: locError } = await supabase
                .from('location')
                .upsert(
                    { property_id: Number(propertyId), ...locationData },
                    { onConflict: 'property_id' }
                );

            if (locError) throw locError;

            logConsole(`✅ Propiedad actualizada exitosamente: ${propertyData.nombre}`, 'success');
        } else {
            // Crear nueva propiedad
            const { data: newProp, error: propError } = await supabase
                .from('property')
                .insert(propertyData)
                .select()
                .single();

            if (propError) throw propError;

            // Crear location
            locationData.property_id = newProp.id;
            const { error: locError } = await supabase
                .from('location')
                .insert(locationData);

            if (locError) throw locError;

            logConsole(`✅ Propiedad creada exitosamente: ${propertyData.nombre}`, 'success');
        }

        closePropertyModal();
        await loadProperties();
    } catch (error) {
        logConsole(`❌ Error guardando propiedad: ${error.message}`, 'error');
        alert('Error al guardar: ' + error.message);
    }
});

// ===== ELIMINAR PROPIEDAD =====
async function deleteProperty(id, name) {
    if (!confirm(`¿Seguro que deseas eliminar la propiedad "${name}"?\n\nEsto también eliminará:\n- Ubicación asociada\n- Todas las imágenes\n- Registros en la base de datos\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    try {
        logConsole(`Eliminando propiedad: ${name}...`, 'info');

        // Obtener y eliminar imágenes del storage
        const { data: mediaData } = await supabase
            .from('media')
            .select('storage_key')
            .eq('property_id', id);

        if (mediaData && mediaData.length > 0) {
            const filePaths = mediaData.map(m => m.storage_key);
            const { error: storageError } = await supabase.storage
                .from('properties')
                .remove(filePaths);

            if (storageError) {
                logConsole(`⚠️ Advertencia eliminando archivos del storage: ${storageError.message}`, 'warning');
            } else {
                logConsole(`✅ ${filePaths.length} imagen(es) eliminada(s) del storage`, 'success');
            }
        }

        // Eliminar propiedad (cascade eliminará location y media automáticamente)
        const { error } = await supabase
            .from('property')
            .delete()
            .eq('id', id);

        if (error) throw error;

        logConsole(`✅ Propiedad eliminada exitosamente: ${name}`, 'success');
        await loadProperties();
    } catch (error) {
        logConsole(`❌ Error eliminando propiedad: ${error.message}`, 'error');
        alert('Error al eliminar: ' + error.message);
    }
}

// ===== CARACTERÍSTICAS =====
function addCaracteristica() {
    const input = document.getElementById('caracteristicaInput');
    const value = input.value.trim();

    if (!value) {
        alert('Por favor ingresa una característica');
        return;
    }

    if (caracteristicas.includes(value)) {
        alert('Esta característica ya fue agregada');
        return;
    }

    caracteristicas.push(value);
    updateCaracteristicasList();
    input.value = '';
    input.focus();
    logConsole(`Característica agregada: ${value}`, 'info');
}

function removeCaracteristica(index) {
    const removed = caracteristicas[index];
    caracteristicas.splice(index, 1);
    updateCaracteristicasList();
    logConsole(`Característica eliminada: ${removed}`, 'info');
}

function updateCaracteristicasList() {
    const list = document.getElementById('caracteristicasList');
    if (caracteristicas.length === 0) {
        list.innerHTML = '<p style="color: #999; font-size: 13px;">No hay características agregadas</p>';
        return;
    }
    list.innerHTML = caracteristicas.map((c, i) => `
                <div class="caracteristica-tag">
                    ${c}
                    <button onclick="removeCaracteristica(${i})" type="button">&times;</button>
                </div>
            `).join('');
}

document.getElementById('caracteristicaInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        addCaracteristica();
    }
});

// ===== GESTIÓN DE GALERÍA =====
async function manageGallery(propertyId, propertyName) {
    document.getElementById('galleryPropertyId').value = propertyId;
    document.getElementById('galleryPropertyName').textContent = propertyName;
    document.getElementById('galleryModal').classList.remove('hidden');

    logConsole(`🖼️ Abriendo galería de: ${propertyName}`, 'info');
    await loadGallery(propertyId);
}

async function loadGallery(propertyId) {
    const grid = document.getElementById('galleryGrid');
    grid.innerHTML = '<div class="loading">⏳ Cargando galería...</div>';

    try {
        const { data, error } = await supabase
            .from('media')
            .select('*')
            .eq('property_id', propertyId)
            .order('is_primary', { ascending: false })
            .order('sort_order', { ascending: true });

        if (error) throw error;

        if (!data || data.length === 0) {
            grid.innerHTML = `
                        <div class="empty-state">
                            <p>📭 No hay imágenes para esta propiedad</p>
                        </div>
                    `;
            logConsole('⚠️ No se encontraron imágenes', 'warning');
            return;
        }

        // Reconstruir URL pública (ignoramos columna url)
        const withUrls = data.map(m => {
            const { data: pub } = supabase.storage.from('properties').getPublicUrl(m.storage_key);
            return { ...m, publicUrl: pub.publicUrl };
        });

        grid.innerHTML = withUrls.map(m => {
            const mediaTag = (m.kind === 'VIDEO')
                ? `<video src="${m.publicUrl}" controls playsinline preload="metadata"></video>`
                : `<img src="${m.publicUrl}" alt="${m.alt_text || 'Imagen de propiedad'}">`;
            return `
                <div class="gallery-item ${m.is_primary ? 'primary' : ''}">
       ${mediaTag}
       ${m.is_primary ? '<span class="primary-badge">Principal</span>' : ''}
       <button class="delete-img" onclick="deleteMedia(${m.id}, ${propertyId})">🗑️ Eliminar</button>
        </div>
         `;
        }).join('');


        logConsole(`✅ ${data.length} imagen(es) cargada(s)`, 'success');
    } catch (error) {
        logConsole(`❌ Error cargando galería: ${error.message}`, 'error');
        grid.innerHTML = `
                    <div class="empty-state">
                        <p>❌ Error al cargar imágenes</p>
                    </div>
                `;
    }
}

// ===== SUBIR IMAGEN PRINCIPAL =====
document.getElementById('primaryImageInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const propertyId = document.getElementById('galleryPropertyId').value;
    await uploadMedia(file, propertyId, { kind: 'IMAGE', isPrimary: true });
    e.target.value = '';
});

// ===== SUBIR IMÁGENES ADICIONALES =====
document.getElementById('additionalImagesInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const propertyId = document.getElementById('galleryPropertyId').value;

    logConsole(`📤 Subiendo ${files.length} imagen(es) adicional(es)...`, 'info');

    for (let i = 0; i < files.length; i++) {
        await uploadMedia(files[i], propertyId, { kind: 'IMAGE', isPrimary: false });
    }

    e.target.value = '';
});

// ===== SUBIR VIDEOS =====
document.getElementById('videosInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const propertyId = document.getElementById('galleryPropertyId').value;

    logConsole(`📤 Subiendo ${files.length} video(s)...`, 'info');

    for (let i = 0; i < files.length; i++) {
        await uploadMedia(files[i], propertyId, { kind: 'VIDEO', isPrimary: false });
    }

    e.target.value = '';
});


async function uploadMedia(file, propertyId, { kind = 'IMAGE', isPrimary = false } = {}) {
    try {
        // Validaciones por tipo
        if (kind === 'IMAGE') {
            if (!file.type.startsWith('image/')) throw new Error('El archivo debe ser una imagen válida');
            if (file.size > 5 * 1024 * 1024) throw new Error('La imagen no debe superar los 5MB');
        } else if (kind === 'VIDEO') {
            if (!file.type.startsWith('video/')) throw new Error('El archivo debe ser un video válido');
            // Límite sugerido para video: 200MB (ajústalo si tu bucket permite más)
            if (file.size > 200 * 1024 * 1024) throw new Error('El video no debe superar los 200MB');
        } else {
            throw new Error('Tipo de medio no soportado');
        }

        logConsole(`📤 Subiendo: ${file.name} (${(file.size / 1024).toFixed(2)} KB) como ${kind}...`, 'info');

        // Nombre único
        const fileExt = (file.name.split('.').pop() || '').toLowerCase();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(7);
        const fileName = `${currentUser.id}/${propertyId}/${timestamp}_${random}.${fileExt}`;

        // Subir a Storage
        const { error: uploadError } = await supabase.storage
            .from('properties')
            .upload(fileName, file);
        if (uploadError) throw uploadError;

        // Si marcas una principal y es IMAGEN, desmarcar otras
        if (isPrimary && kind === 'IMAGE') {
            await supabase.from('media').update({ is_primary: false }).eq('property_id', propertyId);
            logConsole('Desmarcando imágenes principales anteriores...', 'info');
        }

        // Insert en media
        const { error: mediaError } = await supabase.from('media').insert({
            property_id: propertyId,
            kind,                    // 'IMAGE' | 'VIDEO'
            storage_key: fileName,
            // url: opcional; NO dependemos de ella para mostrar
            is_primary: isPrimary && kind === 'IMAGE',
            sort_order: isPrimary && kind === 'IMAGE' ? 0 : 999
        });
        if (mediaError) throw mediaError;

        logConsole(`✅ ${kind === 'IMAGE' ? 'Imagen' : 'Video'} subido exitosamente${isPrimary ? ' (PRINCIPAL)' : ''}: ${file.name}`, 'success');
        await loadGallery(propertyId);

    } catch (error) {
        logConsole(`❌ Error subiendo ${kind === 'IMAGE' ? 'imagen' : 'video'} ${file.name}: ${error.message}`, 'error');
        alert(`Error al subir ${kind === 'IMAGE' ? 'imagen' : 'video'}: ${error.message}`);
    }
}


// ===== ELIMINAR IMAGEN =====
async function deleteMedia(mediaId, propertyId) {
    if (!confirm('¿Eliminar este elemento de la galería permanentemente?')) return;

    try {
        logConsole(`Eliminando media ID: ${mediaId}...`, 'info');

        // Obtener información de la imagen
        const { data: mediaData, error: fetchError } = await supabase
            .from('media')
            .select('storage_key, is_primary, kind')
            .eq('id', mediaId)
            .single();

        if (fetchError) throw fetchError;

        // Eliminar archivo del storage
        const { error: storageError } = await supabase.storage
            .from('properties')
            .remove([mediaData.storage_key]);

        if (storageError) throw storageError;

        // Eliminar registro de la base de datos
        const { error: deleteError } = await supabase
            .from('media')
            .delete()
            .eq('id', mediaId);

        if (deleteError) throw deleteError;

        logConsole(`✅ ${mediaData.kind === 'VIDEO' ? 'Video' : 'Imagen'} eliminado correctamente${mediaData.is_primary ? ' (era principal)' : ''}`, 'success');
        await loadGallery(propertyId);

    } catch (error) {
        logConsole(`❌ Error eliminando media: ${error.message}`, 'error');
        alert('Error al eliminar: ' + error.message);
    }
}

// ===== CERRAR MODALES =====
function closePropertyModal() {
    document.getElementById('propertyModal').classList.add('hidden');
    logConsole('Modal de propiedad cerrado', 'info');
}

function closeGalleryModal() {
    document.getElementById('galleryModal').classList.add('hidden');
    logConsole('Modal de galería cerrado', 'info');
}

// ===== BOTONES DEL SIDEBAR =====
document.getElementById('btnViewAll').addEventListener('click', async () => {
    logConsole('🔄 Recargando lista de propiedades...', 'info');
    await loadProperties();
});

document.getElementById('btnRefresh').addEventListener('click', async () => {
    logConsole('🔄 Actualizando datos...', 'info');
    await loadProperties();
});

// ===== CERRAR MODALES AL HACER CLIC FUERA =====
window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        if (e.target.id === 'propertyModal') {
            closePropertyModal();
        }
        if (e.target.id === 'galleryModal') {
            closeGalleryModal();
        }
    }
});

// ===== MENSAJE INICIAL =====
logConsole('🚀 Sistema de gestión de propiedades iniciado', 'success');
logConsole('👤 Por favor inicia sesión para continuar', 'info');

