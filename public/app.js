const formVenta = document.getElementById('formVenta');

if (formVenta) {
  formVenta.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tipo = document.getElementById('tipo').value;
    const cantidad = document.getElementById('cantidad').value;
    const monto = document.getElementById('monto').value;
    const mensaje = document.getElementById('mensaje');

    try {
      const res = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cantidad, monto, tipo })
      });

      const data = await res.json();

      if (res.ok) {
        mensaje.textContent = tipo === 'salida'
          ? '✅ Salida de dinero registrada correctamente'
          : '✅ Entrada de dinero registrada correctamente';
        mensaje.className = 'mensaje exito';
        formVenta.reset();
        document.getElementById('cantidad').focus();
      } else {
        mensaje.textContent = '❌ ' + (data.error || 'Error al registrar');
        mensaje.className = 'mensaje error';
      }
    } catch (err) {
      mensaje.textContent = '❌ Error de conexión';
      mensaje.className = 'mensaje error';
    }
  });
}

// --- Lógica para la página de ventas totales (ventas.html) ---
const cuerpoTabla = document.getElementById('cuerpoTabla');
let grafica = null;

if (cuerpoTabla) {
  cargarTotales();
  cargarVentas();
}

async function cargarTotales() {
  const res = await fetch('/api/totales');
  const data = await res.json();

  document.getElementById('totalEntradas').textContent =
    '$' + Number(data.totalEntradas).toFixed(2);
  document.getElementById('totalSalidas').textContent =
    '$' + Number(data.totalSalidas).toFixed(2);
  document.getElementById('totalMonto').textContent =
    '$' + Number(data.totalMonto).toFixed(2);
  document.getElementById('totalCantidad').textContent = data.totalCantidad;
  document.getElementById('totalVentas').textContent = data.totalVentas;
}

async function cargarVentas() {
  const res = await fetch('/api/ventas');
  const ventas = await res.json();

  cuerpoTabla.innerHTML = '';

  ventas.forEach((venta) => {
    const fila = document.createElement('tr');
    const fecha = new Date(venta.fecha);
    const fechaTexto = fecha.toLocaleDateString('es-MX') + ' ' + fecha.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

    const esSalida = venta.tipo === 'salida';
    const etiquetaTipo = esSalida ? 'Salida' : 'Entrada';
    const claseBadge = esSalida ? 'badge-salida' : 'badge-entrada';
    const claseMonto = esSalida ? 'monto-salida' : 'monto-entrada';
    const signo = esSalida ? '-' : '+';

    fila.innerHTML = `
      <td>${fechaTexto}</td>
      <td><span class="badge ${claseBadge}">${etiquetaTipo}</span></td>
      <td>${venta.cantidad}</td>
      <td class="${claseMonto}">${signo}$${Number(venta.monto).toFixed(2)}</td>
      <td><button class="btn-borrar" data-id="${venta.id}">Borrar</button></td>
    `;

    cuerpoTabla.appendChild(fila);
  });

  document.querySelectorAll('.btn-borrar').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      if (confirm('¿Borrar este movimiento?')) {
        await fetch('/api/ventas/' + id, { method: 'DELETE' });
        cargarTotales();
        cargarVentas();
      }
    });
  });

  dibujarGrafica(ventas);
}

function dibujarGrafica(ventas) {
  const canvas = document.getElementById('graficaMovimientos');
  if (!canvas || typeof Chart === 'undefined') return;

  // Agrupar entradas y salidas por fecha (día)
  const porDia = {};
  ventas.forEach((venta) => {
    const dia = new Date(venta.fecha).toLocaleDateString('es-MX');
    if (!porDia[dia]) porDia[dia] = { entradas: 0, salidas: 0 };
    if (venta.tipo === 'salida') {
      porDia[dia].salidas += Number(venta.monto);
    } else {
      porDia[dia].entradas += Number(venta.monto);
    }
  });

  // Ordenar por fecha (más antiguo primero para la gráfica)
  const dias = Object.keys(porDia).sort((a, b) => {
    const [dA, mA, yA] = a.split('/');
    const [dB, mB, yB] = b.split('/');
    return new Date(`${yA}-${mA}-${dA}`) - new Date(`${yB}-${mB}-${dB}`);
  });

  const dataEntradas = dias.map((d) => porDia[d].entradas);
  const dataSalidas = dias.map((d) => porDia[d].salidas);

  if (grafica) {
    grafica.destroy();
  }

  grafica = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: dias,
      datasets: [
        {
          label: 'Entradas',
          data: dataEntradas,
          backgroundColor: '#28a745'
        },
        {
          label: 'Salidas',
          data: dataSalidas,
          backgroundColor: '#dc3545'
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top' }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (valor) => '$' + valor
          }
        }
      }
    }
  });
}
