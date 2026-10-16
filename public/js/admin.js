// Admin Control Panel Logic (Panel de Control y Monitoreo del Servidor)

let socket = null;
let adminPassword = sessionStorage.getItem('adminAuth') || '';
let candidatesChart = null;
let distributionChart = null;
let currentStats = null;
let padronList = [];

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initSocket();
  setupTabs();
  setupEventListeners();
  fetchNetworkInfo();
});

// Authentication check
function checkAuth() {
  const loginModal = document.getElementById('admin-login-modal');
  if (adminPassword) {
    loginModal.classList.add('hidden');
    loadInitialStats();
    loadPadron();
  } else {
    loginModal.classList.remove('hidden');
  }
}

// Socket.io Real-time Setup
function initSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('[Socket] Conectado al servidor principal');
  });

  socket.on('initial_state', (data) => {
    if (data.stats) {
      updateDashboard(data.stats);
    }
  });

  socket.on('vote_registered', (data) => {
    if (data.stats) {
      updateDashboard(data.stats);
    }
    if (data.activity) {
      prependActivity(data.activity);
    }
  });

  socket.on('election_status_changed', (data) => {
    updateStatusBadge(data.status);
  });

  socket.on('election_reset', (data) => {
    if (data.stats) {
      updateDashboard(data.stats);
    }
    loadPadron();
    document.getElementById('activity-table-body').innerHTML = '';
  });

  socket.on('padron_updated', (data) => {
    if (data.stats) {
      updateDashboard(data.stats);
    }
    loadPadron();
  });
}

// Fetch server LAN IP
async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/admin/network-info');
    const data = await res.json();
    const lanEl = document.getElementById('server-lan-ip');
    
    if (data.addresses && data.addresses.length > 0) {
      const primaryIp = data.addresses[0].address;
      const port = window.location.port ? `:${window.location.port}` : '';
      const fullUrl = `http://${primaryIp}${port}`;
      lanEl.textContent = fullUrl;
      lanEl.setAttribute('data-url', fullUrl);
    } else {
      lanEl.textContent = window.location.origin;
      lanEl.setAttribute('data-url', window.location.origin);
    }
  } catch (err) {
    console.error('Error fetching network info:', err);
  }
}

// Initial stats fetch
async function loadInitialStats() {
  try {
    const res = await fetch('/api/admin/stats');
    const data = await res.json();
    if (data.success && data.stats) {
      document.getElementById('admin-school-name').textContent = `${data.stats.config.schoolName} • ${data.stats.config.electionTitle}`;
      updateDashboard(data.stats);
    }
  } catch (err) {
    console.error('Error loading stats:', err);
  }
}

// Update complete dashboard
function updateDashboard(stats) {
  currentStats = stats;

  // Update Status Badge
  updateStatusBadge(stats.config.status);

  // Update KPI Cards
  document.getElementById('stat-total-padron').textContent = stats.totalPadron;
  document.getElementById('stat-total-votes').textContent = stats.totalVotes;
  document.getElementById('stat-participation').textContent = `${stats.participationRate}%`;
  document.getElementById('bar-participation').style.width = `${Math.min(stats.participationRate, 100)}%`;
  document.getElementById('stat-pending').textContent = stats.pendingVoters;

  // Distribution texts
  document.getElementById('dist-valid').textContent = `${stats.validVotes} (${stats.validPercentage}%)`;
  document.getElementById('dist-blank').textContent = `${stats.blankVotes} (${stats.blankPercentage}%)`;
  document.getElementById('dist-null').textContent = `${stats.nullVotes} (${stats.nullPercentage}%)`;
  document.getElementById('lbl-valid-total').textContent = `${stats.validVotes} votos`;

  // Update Charts
  updateCharts(stats);

  // Update Detailed Results Cards
  renderDetailedResults(stats);

  // Update Activity feed if available
  if (stats.recentActivity) {
    renderRecentActivity(stats.recentActivity);
  }
}

// Status Badge & Button helper
function updateStatusBadge(status) {
  const badge = document.getElementById('badge-status');
  const badgeText = document.getElementById('badge-status-text');
  const toggleBtnText = document.getElementById('btn-toggle-lock-text');

  if (status === 'open') {
    badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1';
    badgeText.textContent = 'EN CURSO';
    toggleBtnText.textContent = 'Pausar Votaciones';
  } else {
    badge.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-500/20 text-red-400 border border-red-500/40 flex items-center space-x-1';
    badgeText.textContent = 'PAUSADA';
    toggleBtnText.textContent = 'Reanudar Votaciones';
  }
}

// Chart.js rendering & updating
function updateCharts(stats) {
  const candidateLabels = stats.candidateResults.map(c => `Lista ${c.number}: ${c.name}`);
  const candidateVotes = stats.candidateResults.map(c => c.votes);
  const candidateColors = stats.candidateResults.map(c => c.color || '#3b82f6');

  // Bar Chart
  const ctxCandidates = document.getElementById('chart-candidates').getContext('2d');
  if (!candidatesChart) {
    candidatesChart = new Chart(ctxCandidates, {
      type: 'bar',
      data: {
        labels: candidateLabels,
        datasets: [{
          label: 'Votos Obtenidos',
          data: candidateVotes,
          backgroundColor: candidateColors,
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.raw} votos`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: '#94a3b8',
              stepSize: 1
            },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          x: {
            ticks: { color: '#cbd5e1', font: { weight: 'bold' } },
            grid: { display: false }
          }
        }
      }
    });
  } else {
    candidatesChart.data.labels = candidateLabels;
    candidatesChart.data.datasets[0].data = candidateVotes;
    candidatesChart.data.datasets[0].backgroundColor = candidateColors;
    candidatesChart.update();
  }

  // Doughnut Chart (Distribution)
  const ctxDist = document.getElementById('chart-distribution').getContext('2d');
  const distData = [stats.validVotes, stats.blankVotes, stats.nullVotes];
  const distLabels = ['Votos Válidos', 'Votos en Blanco', 'Votos Nulos'];
  const distColors = ['#10b981', '#94a3b8', '#ef4444'];

  if (!distributionChart) {
    distributionChart = new Chart(ctxDist, {
      type: 'doughnut',
      data: {
        labels: distLabels,
        datasets: [{
          data: distData,
          backgroundColor: distColors,
          borderWidth: 2,
          borderColor: '#1e293b'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: { display: false }
        }
      }
    });
  } else {
    distributionChart.data.datasets[0].data = distData;
    distributionChart.update();
  }
}

// Render Candidate Detailed Cards in Tab 1
function renderDetailedResults(stats) {
  const container = document.getElementById('detailed-candidates-list');
  container.innerHTML = '';

  // Sort candidates by votes descending
  const sorted = [...stats.candidateResults].sort((a, b) => b.votes - a.votes);

  sorted.forEach((c, index) => {
    const isLeader = index === 0 && c.votes > 0;
    const card = document.createElement('div');
    card.className = `p-4 rounded-2xl bg-slate-900/60 border ${isLeader ? 'border-amber-400/60 bg-amber-950/20' : 'border-slate-700/60'} flex flex-col md:flex-row items-center justify-between gap-4`;

    card.innerHTML = `
      <div class="flex items-center space-x-4 w-full md:w-auto">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center font-black text-xl text-white shadow flex-shrink-0" style="background-color: ${c.color}">
          ${c.number}
        </div>
        <div>
          <div class="flex items-center space-x-2">
            <h5 class="font-extrabold text-white text-base">${c.name}</h5>
            ${isLeader ? '<span class="px-2 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider">Liderando</span>' : ''}
          </div>
          <p class="text-xs text-slate-400">
            Alcalde(sa): <strong class="text-slate-200">${c.alcalde.name}</strong> • Teniente: ${c.teniente.name}
          </p>
        </div>
      </div>

      <div class="w-full md:w-64 flex items-center space-x-3">
        <div class="flex-1">
          <div class="flex justify-between text-xs font-bold mb-1">
            <span class="text-slate-400">${c.percentage}%</span>
            <span class="text-white">${c.votes} votos</span>
          </div>
          <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div class="h-full rounded-full transition-all duration-500" style="width: ${c.percentage}%; background-color: ${c.color}"></div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Render Recent Activity Feed
function renderRecentActivity(activities) {
  const tbody = document.getElementById('activity-table-body');
  tbody.innerHTML = '';
  document.getElementById('activity-badge-count').textContent = activities.length;

  activities.forEach(item => {
    appendActivityRow(tbody, item);
  });
}

function prependActivity(item) {
  const tbody = document.getElementById('activity-table-body');
  appendActivityRow(tbody, item, true);
  
  const badge = document.getElementById('activity-badge-count');
  badge.textContent = Number(badge.textContent || 0) + 1;
}

function appendActivityRow(tbody, item, prepend = false) {
  const tr = document.createElement('tr');
  tr.className = 'hover:bg-slate-800/40 transition';

  const timeFormatted = item.timestamp ? new Date(item.timestamp).toLocaleTimeString('es-PE') : '--:--:--';
  const shortId = item.id ? item.id.substring(0, 8) : 'AUTO';
  const gradeText = item.grade ? `${item.grade} (${item.section})` : 'Secundaria';

  tr.innerHTML = `
    <td class="py-3 px-4 text-slate-300 font-bold">${timeFormatted}</td>
    <td class="py-3 px-4 text-blue-400 font-mono">${item.terminalIp || '127.0.0.1'}</td>
    <td class="py-3 px-4 text-slate-300">${gradeText}</td>
    <td class="py-3 px-4">
      <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        EMITIDO Y VALIDADO
      </span>
    </td>
    <td class="py-3 px-4 text-slate-500 font-mono text-[11px]">${shortId}</td>
  `;

  if (prepend && tbody.firstChild) {
    tbody.insertBefore(tr, tbody.firstChild);
  } else {
    tbody.appendChild(tr);
  }
}

// Load Padrón Electoral
async function loadPadron() {
  const search = document.getElementById('padron-search-input').value;
  const filter = document.getElementById('padron-filter-select').value;

  try {
    const res = await fetch(`/api/admin/voters?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}`);
    const data = await res.json();
    if (data.success) {
      padronList = data.voters;
      renderPadronTable(padronList);
    }
  } catch (err) {
    console.error('Error loading padron:', err);
  }
}

function renderPadronTable(voters) {
  const tbody = document.getElementById('voters-table-body');
  tbody.innerHTML = '';
  document.getElementById('padron-count-shown').textContent = voters.length;

  if (voters.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-6 text-slate-500">
          No se encontraron estudiantes con los criterios de búsqueda.
        </td>
      </tr>
    `;
    return;
  }

  voters.forEach(v => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-800/40 transition';

    const statusBadge = v.hasVoted 
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">SUFRAGÓ</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">PENDIENTE</span>';

    const timeText = v.votedAt ? new Date(v.votedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : '-';

    tr.innerHTML = `
      <td class="py-3 px-4 font-mono font-bold text-amber-300">${v.code}</td>
      <td class="py-3 px-4 text-white font-medium">${v.name}</td>
      <td class="py-3 px-4 text-slate-300">${v.grade} - "${v.section}"</td>
      <td class="py-3 px-4">${statusBadge}</td>
      <td class="py-3 px-4 text-slate-400 font-mono text-xs">${timeText}</td>
      <td class="py-3 px-4 text-right">
        <button class="btn-delete-voter text-red-400 hover:text-red-300 p-1 text-xs" data-id="${v.id}" title="Eliminar">
          ✕
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach delete events
  document.querySelectorAll('.btn-delete-voter').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      if (confirm('¿Deseas eliminar a este estudiante del padrón?')) {
        await fetch(`/api/admin/voters/${id}`, { method: 'DELETE' });
        loadPadron();
      }
    });
  });
}

// Tab navigation setup
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      // Update button styling
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('border-blue-500', 'text-blue-400');
        b.classList.add('border-transparent', 'text-slate-400');
      });
      btn.classList.add('border-blue-500', 'text-blue-400');
      btn.classList.remove('border-transparent', 'text-slate-400');

      // Update contents
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      document.getElementById(targetId).classList.remove('hidden');

      // Refresh padron if opening padron tab
      if (targetId === 'tab-padron') {
        loadPadron();
      }
    });
  });
}

// Event Listeners setup
function setupEventListeners() {
  // Login button
  document.getElementById('btn-login').addEventListener('click', handleLogin);
  document.getElementById('admin-pass-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Copy IP button
  document.getElementById('btn-copy-ip').addEventListener('click', () => {
    const url = document.getElementById('server-lan-ip').getAttribute('data-url');
    if (url) {
      navigator.clipboard.writeText(url).then(() => {
        alert(`¡URL copiada al portapapeles!\n\n${url}\n\nAbre esta dirección en las PCs de los alumnos.`);
      });
    }
  });

  // Emergency lock/unlock toggle
  document.getElementById('btn-toggle-lock').addEventListener('click', handleToggleLock);

  // Search and filter padrón
  document.getElementById('padron-search-input').addEventListener('input', debounce(loadPadron, 300));
  document.getElementById('padron-filter-select').addEventListener('change', loadPadron);

  // Add voter modal
  document.getElementById('btn-open-add-voter').addEventListener('click', () => {
    document.getElementById('modal-add-voter').classList.remove('hidden');
  });
  document.getElementById('btn-close-add-voter').addEventListener('click', () => {
    document.getElementById('modal-add-voter').classList.add('hidden');
  });
  document.getElementById('btn-cancel-add-voter').addEventListener('click', () => {
    document.getElementById('modal-add-voter').classList.add('hidden');
  });
  document.getElementById('btn-submit-add-voter').addEventListener('click', handleAddVoter);

  // Generate 20 demo voters
  document.getElementById('btn-gen-demo-voters').addEventListener('click', async () => {
    await fetch('/api/admin/voters/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: 20 })
    });
    loadPadron();
  });

  // Reset Election Modal Triggers
  const openResetModal = () => {
    document.getElementById('modal-reset').classList.remove('hidden');
    const input = document.getElementById('reset-pass-input');
    input.value = adminPassword || 'admin';
    input.focus();
    input.select();
  };

  const quickResetBtn = document.getElementById('btn-quick-reset');
  if (quickResetBtn) {
    quickResetBtn.addEventListener('click', openResetModal);
  }

  const dangerResetBtn = document.getElementById('btn-open-reset-modal');
  if (dangerResetBtn) {
    dangerResetBtn.addEventListener('click', openResetModal);
  }

  document.getElementById('btn-cancel-reset').addEventListener('click', () => {
    document.getElementById('modal-reset').classList.add('hidden');
  });
  document.getElementById('btn-confirm-reset').addEventListener('click', handleResetElection);
  document.getElementById('reset-pass-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleResetElection();
  });
}

// Handle Admin Login
async function handleLogin() {
  const pass = document.getElementById('admin-pass-input').value;
  const errorBox = document.getElementById('login-error-box');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      adminPassword = pass;
      sessionStorage.setItem('adminAuth', pass);
      document.getElementById('admin-login-modal').classList.add('hidden');
      loadInitialStats();
      loadPadron();
    } else {
      errorBox.classList.remove('hidden');
    }
  } catch (err) {
    console.error('Login error:', err);
    errorBox.classList.remove('hidden');
  }
}

// Emergency Lock Toggle
async function handleToggleLock() {
  try {
    const res = await fetch('/api/admin/toggle-lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword })
    });

    const data = await res.json();
    if (data.success) {
      updateStatusBadge(data.status);
    } else {
      alert(data.message || 'Error al cambiar el estado.');
    }
  } catch (err) {
    console.error('Error toggling lock:', err);
  }
}

// Add Voter Form Submission
async function handleAddVoter() {
  const code = document.getElementById('add-code').value.trim();
  const name = document.getElementById('add-name').value.trim();
  const grade = document.getElementById('add-grade').value.trim();
  const section = document.getElementById('add-section').value.trim();

  if (!code || !name || !grade) {
    alert('Por favor completa todos los campos requeridos.');
    return;
  }

  try {
    const res = await fetch('/api/admin/voters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, name, grade, section })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('modal-add-voter').classList.add('hidden');
      document.getElementById('add-code').value = '';
      document.getElementById('add-name').value = '';
      document.getElementById('add-grade').value = '';
      document.getElementById('add-section').value = 'A';
      loadPadron();
    } else {
      alert(data.message || 'Error al agregar estudiante.');
    }
  } catch (err) {
    console.error('Error adding voter:', err);
  }
}

// Reset Election to 0
async function handleResetElection() {
  const pass = document.getElementById('reset-pass-input').value.trim() || adminPassword || 'admin';

  try {
    const res = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('modal-reset').classList.add('hidden');
      alert('¡Elección reiniciada exitosamente! Los votos han vuelto a 0.');
      updateDashboard(data.stats);
      loadPadron();
    } else {
      alert(data.message || 'Contraseña incorrecta.');
    }
  } catch (err) {
    console.error('Error resetting election:', err);
    alert('Error al conectar con el servidor.');
  }
}

// Utility debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
