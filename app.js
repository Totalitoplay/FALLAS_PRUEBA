let inventarioMap = new Map();
let resultadosActuales = []; 
let ordenAscendente = true;

window.onload = async function() {
    const indicador = document.getElementById('inventarioStatus');
    try {
        indicador.textContent = "⏳ Cargando inventario...";
        const respuesta = await fetch('inventario.csv?v=' + Date.now());
        const contenido = await respuesta.text();
        const lineas = contenido.split(/\r?\n/);
        
        lineas.forEach(l => {
            if (!l.trim()) return;
            let sep = l.includes(';') ? ';' : ',';
            let columnas = l.split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
            if (columnas[7]) {
                let cuentaLimpia = columnas[7].replace(/^0+/, '');
                inventarioMap.set(cuentaLimpia, columnas);
            }
        });

        indicador.textContent = `✅ Inventario listo — ${inventarioMap.size.toLocaleString()} registros`;
        indicador.style.color = "#16a34a";
    } catch (e) { 
        indicador.textContent = "❌ Error al cargar el inventario. Recarga la página.";
        indicador.style.color = "#be123c";
        console.error("Error al cargar el CSV:", e); 
    }
};

async function procesarBusqueda() {
    const fileInput = document.getElementById('clientCsvFile');
    const textArea = document.getElementById('reportInput');
    const btn = document.getElementById('btnBuscar');
    
    btn.innerText = "Procesando...";
    btn.disabled = true;

    if (fileInput && fileInput.files.length > 0) {
        const archivo = fileInput.files[0];
        const lector = new FileReader();
        lector.onload = function(e) {
            ejecutarLocalizacion(e.target.result);
            btn.innerHTML = "🔍 Localizar QRs";
            btn.disabled = false;
        };
        lector.readAsText(archivo);
    } else if (textArea && textArea.value.trim() !== "") {
        ejecutarLocalizacion(textArea.value);
        btn.innerHTML = "🔍 Localizar QRs";
        btn.disabled = false;
    } else {
        alert("Por favor, sube un archivo o pega el reporte de clientes.");
        btn.innerHTML = "🔍 Localizar QRs";
        btn.disabled = false;
    }
}

function ejecutarLocalizacion(textoBruto) {
    const regex = /\d{10}/g; 
    const encontrados = textoBruto.match(regex);
    const cuentasUnicas = encontrados ? [...new Set(encontrados)] : [];
    
    if (cuentasUnicas.length === 0) return alert("No se encontraron cuentas.");

    resultadosActuales = [];
    let conteoQR = {};

    cuentasUnicas.forEach(cuentaBuscada => {
        const buscar = cuentaBuscada.replace(/^0+/, '');
        const fila = inventarioMap.get(buscar);

        if (fila) {
            const qr = (fila[6] || "SIN QR").trim().toUpperCase();
            resultadosActuales.push({
                cuenta: cuentaBuscada,
                qr: qr,
                lat: (fila[16] || "").replace(/"/g, "").trim(),
                lon: (fila[17] || "").replace(/"/g, "").trim(),
                encontrado: true
            });
            conteoQR[qr] = (conteoQR[qr] || 0) + 1;
        } else {
            resultadosActuales.push({
                cuenta: cuentaBuscada,
                qr: "ZZ_NO_ENCONTRADA",
                lat: "", lon: "", encontrado: false
            });
        }
    });

    // Contador de resultados
    const encontradas = resultadosActuales.filter(r => r.encontrado).length;
    const noEncontradas = resultadosActuales.length - encontradas;
    const contador = document.getElementById('resultCounter');
    contador.style.display = "block";
    contador.innerHTML = `
        <span style="color:#16a34a; font-weight:700;">✅ Encontradas: ${encontradas}</span>
        &nbsp;&nbsp;
        <span style="color:#be123c; font-weight:700;">❌ No encontradas: ${noEncontradas}</span>
        &nbsp;&nbsp;
        <span style="color:#64748b;">Total: ${resultadosActuales.length}</span>
    `;

    mostrarResumen(conteoQR);

    resultadosActuales.sort((a, b) => a.qr.localeCompare(b.qr, undefined, {numeric: true}));
    renderizarTabla(resultadosActuales);
}

function mostrarResumen(conteo) {
    const contenedorStats = document.getElementById('summaryStats');
    const contenido = document.getElementById('statsContent');
    
    const ordenados = Object.entries(conteo).sort((a, b) => b[1] - a[1]);

    if (ordenados.length > 0) {
        contenedorStats.style.display = "block";
        
        contenido.innerHTML = ordenados.map(([qr, total]) => {
            const datoCualquiera = resultadosActuales.find(r => r.qr === qr && r.encontrado);
            const linkMapa = datoCualquiera 
                ? `https://www.google.com/maps/search/?api=1&query=${datoCualquiera.lat},${datoCualquiera.lon}`
                : "#";

            return `
                <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; border-left: 4px solid #2563eb; position: relative;">
                    <a href="${linkMapa}" target="_blank" style="text-decoration: none; display: block;">
                        <span style="font-size: 10px; font-weight: bold; color: #2563eb; display: block; margin-bottom: 4px;">
                            📍 ABRIR MAPA
                        </span>
                        <span style="font-size: 12px; font-weight: bold; color: #1e293b; display: block; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px; margin-bottom: 4px;">
                            ${qr}
                        </span>
                        <div style="font-size: 20px; font-weight: 700; color: #1e293b;">
                            ${total} <small style="font-size: 10px; color: #64748b;">ctes</small>
                        </div>
                    </a>
                </div>
            `;
        }).join('');
    } else {
        contenedorStats.style.display = "none";
    }
}

function renderizarTabla(datos) {
    const tbody = document.querySelector("#resultTable tbody");

    if (datos.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding: 40px; color: #64748b; font-size: 15px;">
                    😕 Sin resultados para mostrar
                </td>
            </tr>`;
        return;
    }

    let html = "";
    datos.forEach(res => {
        if (res.encontrado) {
            const urlMaps = `https://www.google.com/maps/search/?api=1&query=${res.lat},${res.lon}`;
            html += `
                <tr>
                    <td data-label="ESTADO"><span style="font-size:16px;" title="Encontrada">✅</span></td>
                    <td data-label="CUENTA"><b>${res.cuenta}</b></td>
                    <td data-label="QR">
                        <span class="qr-badge" 
                              onclick="copiarQR('${res.qr}', this)" 
                              title="Tap para copiar" 
                              style="cursor:pointer;">
                            ${res.qr}
                        </span>
                    </td>
                    <td data-label="COORD" style="font-size:10px;">${res.lat}, ${res.lon}</td>
                    <td data-label="ACCIÓN"><a href="${urlMaps}" target="_blank" class="btn-mapa">📍 Mapa</a></td>
                </tr>`;
        } else {
            html += `
                <tr class="no-encontrada">
                    <td data-label="ESTADO"><span style="font-size:16px;" title="No encontrada">❌</span></td>
                    <td data-label="CUENTA">${res.cuenta}</td>
                    <td colspan="3">No encontrada en Inventario</td>
                </tr>`;
        }
    });
    tbody.innerHTML = html;
}

function copiarQR(texto, elemento) {
    navigator.clipboard.writeText(texto).then(() => {
        const original = elemento.textContent;
        elemento.textContent = "✅ Copiado";
        elemento.style.background = "#dcfce7";
        elemento.style.color = "#16a34a";
        setTimeout(() => {
            elemento.textContent = original;
            elemento.style.background = "";
            elemento.style.color = "";
        }, 1500);
    });
}

function ordenarTabla(columnaIndex) {
    if (resultadosActuales.length === 0) return;
    ordenAscendente = !ordenAscendente;
    resultadosActuales.sort((a, b) => {
        // Columna 0 = estado (encontrado primero), 1 = cuenta, 2 = qr
        if (columnaIndex === 0) {
            return ordenAscendente
                ? Number(b.encontrado) - Number(a.encontrado)
                : Number(a.encontrado) - Number(b.encontrado);
        }
        let valA = columnaIndex === 1 ? a.cuenta : a.qr;
        let valB = columnaIndex === 1 ? b.cuenta : b.qr;
        return ordenAscendente
            ? valA.localeCompare(valB, undefined, {numeric: true})
            : valB.localeCompare(valA, undefined, {numeric: true});
    });
    renderizarTabla(resultadosActuales);
}

function limpiarTodo() {
    document.getElementById('reportInput').value = "";
    document.getElementById('clientCsvFile').value = "";
    document.getElementById('summaryStats').style.display = "none";
    document.getElementById('resultCounter').style.display = "none";
    document.querySelector("#resultTable tbody").innerHTML = "";
    resultadosActuales = [];
}
