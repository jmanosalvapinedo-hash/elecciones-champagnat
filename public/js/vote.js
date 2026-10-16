// Client logic for Student Voting Terminal (Pantalla de Votación)

let currentVoter = null;
let currentSelectedOption = null;
let candidateLists = [];
let countdownInterval = null;
let socket = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initClock();
  initSocket();
  initKeypad();
  fetchInitialData();
  setupEventListeners();
});

// Live clock in header
function initClock() {
  const clockEl = document.getElementById('live-clock');
  function updateTime() {
    const now = new Date();
    clockEl.textContent = now.toLocaleTimeString('es-PE', { hour12: false });
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// Socket.io Real-Time Connection
function initSocket() {
  socket = io();

  const dot = document.getElementById('socket-status-dot');
  const text = document.getElementById('socket-status-text');

  socket.on('connect', () => {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block';
    text.textContent = 'En línea';
  });

  socket.on('disconnect', () => {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 inline-block';
    text.textContent = 'Desconectado';
  });

  socket.on('initial_state', (data) => {
    handleElectionStatus(data.status);
  });

  socket.on('election_status_changed', (data) => {
    handleElectionStatus(data.status);
  });

  socket.on('election_reset', () => {
    resetVotingFlow();
  });
}

function handleElectionStatus(status) {
  const overlay = document.getElementById('overlay-locked');
  if (status === 'paused' || status === 'closed') {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// Touch Numpad & Keyboard Setup
function initKeypad() {
  const input = document.getElementById('voter-code-input');
  
  document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const key = btn.getAttribute('data-key');
      if (key === 'clear') {
        input.value = '';
      } else if (key === 'backspace') {
        input.value = input.value.slice(0, -1);
      } else {
        if (input.value.length < 15) {
          input.value += key;
        }
      }
      input.focus();
    });
  });

  // Enter key submits code
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('btn-validate-voter').click();
    }
  });
}

// Fetch Candidates and metadata
async function fetchInitialData() {
  try {
    const [statusRes, candidatesRes] = await Promise.all([
      fetch('/api/status'),
      fetch('/api/candidates')
    ]);

    const statusData = await statusRes.json();
    if (statusData.success) {
      document.getElementById('header-school-name').textContent = statusData.schoolName;
      document.getElementById('header-election-title').textContent = statusData.electionTitle;
      handleElectionStatus(statusData.status);
    }

    const candidatesData = await candidatesRes.json();
    if (candidatesData.success) {
      candidateLists = candidatesData.candidates;
      renderCandidates(candidateLists);
    }
  } catch (err) {
    console.error('Error fetching initial data:', err);
  }
}

// Render Candidate Cards Grid
function renderCandidates(candidates) {
  const grid = document.getElementById('candidates-grid');
  grid.innerHTML = '';

  candidates.forEach(c => {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-3xl border-2 hover:border-blue-500 shadow-md hover:shadow-xl transition-card flex flex-col justify-between overflow-hidden relative group';
    card.style.borderColor = c.border || '#cbd5e1';

    card.innerHTML = `
      <!-- Top Colored Stripe -->
      <div class="h-3 w-full" style="background-color: ${c.color}"></div>

      <div class="p-6 flex-1 flex flex-col">
        <!-- Badge & List Number -->
        <div class="flex items-center justify-between mb-4">
          <span class="px-3 py-1 text-xs font-black rounded-full uppercase tracking-wider text-white shadow-sm" style="background-color: ${c.color}">
            ${c.badge}
          </span>
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow" style="background-color: ${c.color}">
            ${c.number}
          </div>
        </div>

        <!-- Candidate Photo & Party Name -->
        <div class="text-center my-2">
          <div class="w-28 h-28 mx-auto rounded-full p-1.5 shadow-lg mb-3" style="background: linear-gradient(135deg, ${c.color}, #f8fafc)">
            <img src="${c.alcalde.photo}" alt="${c.alcalde.name}" class="w-full h-full rounded-full object-cover bg-white">
          </div>
          <h3 class="text-xl font-black text-slate-900 tracking-tight leading-snug">
            ${c.name}
          </h3>
          <p class="text-xs text-slate-500 italic mt-1 line-clamp-2 px-2">
            "${c.slogan}"
          </p>
        </div>

        <!-- Candidate Details -->
        <div class="mt-4 pt-3 border-t border-slate-100 text-xs space-y-1.5 text-slate-700 bg-slate-50/80 p-3 rounded-2xl">
          <div>
            <span class="text-slate-400 font-bold uppercase block text-[10px]">Candidato a Alcalde(sa):</span>
            <span class="font-extrabold text-slate-900 text-sm">${c.alcalde.name}</span>
            <span class="text-slate-500 text-[11px] block">(${c.alcalde.grade})</span>
          </div>
          <div class="pt-1">
            <span class="text-slate-400 font-bold uppercase block text-[10px]">Teniente Alcalde(sa):</span>
            <span class="font-bold text-slate-800">${c.teniente.name}</span>
          </div>
        </div>

        <!-- View Proposals Button -->
        <button 
          type="button" 
          class="btn-view-proposals mt-3 text-xs font-bold text-blue-600 hover:text-blue-800 py-1.5 px-3 rounded-lg hover:bg-blue-50 transition flex items-center justify-center space-x-1"
          data-id="${c.id}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>Ver Plan y Propuestas</span>
        </button>

      </div>

      <!-- Action Button -->
      <div class="p-6 pt-0">
        <button 
          type="button" 
          class="btn-vote-candidate w-full py-4 px-6 text-white text-base font-black rounded-2xl shadow-lg transition active:scale-[0.98] flex items-center justify-center space-x-2 cursor-pointer"
          style="background-color: ${c.color}"
          data-id="${c.id}"
          data-name="${c.name}"
          data-slogan="${c.slogan}"
          data-number="${c.number}"
          data-badge="${c.badge}"
          data-candidatename="${c.alcalde.name}"
          data-photo="${c.alcalde.photo}"
          data-color="${c.color}"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
          </svg>
          <span>Votar por ${c.badge}</span>
        </button>
      </div>
    `;

    grid.appendChild(card);
  });

  // Attach event listeners to candidate buttons
  document.querySelectorAll('.btn-vote-candidate').forEach(btn => {
    btn.addEventListener('click', () => {
      const option = {
        id: btn.getAttribute('data-id'),
        name: btn.getAttribute('data-name'),
        slogan: btn.getAttribute('data-slogan'),
        number: btn.getAttribute('data-number'),
        badge: btn.getAttribute('data-badge'),
        candidateName: btn.getAttribute('data-candidatename'),
        photo: btn.getAttribute('data-photo'),
        color: btn.getAttribute('data-color')
      };
      openConfirmModal(option);
    });
  });

  // Attach event listeners to proposals buttons
  document.querySelectorAll('.btn-view-proposals').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-id');
      const candidate = candidateLists.find(c => c.id === id);
      if (candidate) {
        openProposalsModal(candidate);
      }
    });
  });
}

// Event Listeners setup
function setupEventListeners() {
  // Validate student voter
  document.getElementById('btn-validate-voter').addEventListener('click', handleValidateVoter);

  // Welcome screen buttons
  document.getElementById('btn-cancel-welcome').addEventListener('click', resetVotingFlow);
  document.getElementById('btn-go-to-ballot').addEventListener('click', () => {
    showScreen('ballot');
  });

  // Special vote buttons (Blanco / Nulo)
  document.querySelectorAll('.btn-vote-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const option = {
        id: btn.getAttribute('data-id'),
        name: btn.getAttribute('data-name'),
        slogan: btn.getAttribute('data-slogan'),
        number: btn.getAttribute('data-number'),
        badge: btn.getAttribute('data-name').toUpperCase(),
        candidateName: 'Voto Especial',
        photo: btn.getAttribute('data-photo'),
        color: btn.getAttribute('data-id') === 'BLANCO' ? '#64748b' : '#ef4444'
      };
      openConfirmModal(option);
    });
  });

  // Modal confirm buttons
  document.getElementById('btn-modal-cancel').addEventListener('click', closeConfirmModal);
  document.getElementById('btn-modal-confirm').addEventListener('click', handleConfirmVote);

  // Proposals modal close
  document.getElementById('btn-close-proposals').addEventListener('click', closeProposalsModal);
  document.getElementById('btn-select-from-proposals').addEventListener('click', () => {
    closeProposalsModal();
    if (activeProposalCandidate) {
      const c = activeProposalCandidate;
      openConfirmModal({
        id: c.id,
        name: c.name,
        slogan: c.slogan,
        number: c.number,
        badge: c.badge,
        candidateName: c.alcalde.name,
        photo: c.alcalde.photo,
        color: c.color
      });
    }
  });

  // Next voter / reset button on success screen
  document.getElementById('btn-next-voter').addEventListener('click', resetVotingFlow);
}

// Validate Voter Code via API
async function handleValidateVoter() {
  const codeInput = document.getElementById('voter-code-input');
  const code = codeInput.value.trim();
  const errorBox = document.getElementById('auth-error-box');
  const errorMsg = document.getElementById('auth-error-msg');

  errorBox.classList.add('hidden');

  if (!code) {
    errorMsg.textContent = 'Por favor, ingresa tu Código de Estudiante o DNI.';
    errorBox.classList.remove('hidden');
    codeInput.focus();
    return;
  }

  const validateBtn = document.getElementById('btn-validate-voter');
  validateBtn.disabled = true;
  validateBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    Verificando Padrón...
  `;

  try {
    const res = await fetch('/api/auth/validate-voter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      errorMsg.textContent = data.message || 'Error al validar el elector.';
      errorBox.classList.remove('hidden');
      codeInput.focus();
      return;
    }

    // Success: store student and transition to welcome screen
    currentVoter = data.voter;
    document.getElementById('welcome-student-name').textContent = `¡Hola, ${currentVoter.name}!`;
    document.getElementById('welcome-student-grade').textContent = `${currentVoter.grade} - Sección "${currentVoter.section}"`;

    document.getElementById('ballot-voter-name').textContent = currentVoter.name;
    document.getElementById('ballot-voter-grade').textContent = `${currentVoter.grade} • Sec. "${currentVoter.section}"`;

    showScreen('welcome');

  } catch (err) {
    console.error('Error validating voter:', err);
    errorMsg.textContent = 'Error de conexión con el servidor principal. Verifica el cable de red.';
    errorBox.classList.remove('hidden');
  } finally {
    validateBtn.disabled = false;
    validateBtn.innerHTML = `
      <span>Ingresar para Votar</span>
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
      </svg>
    `;
  }
}

// Confirm Modal Logic
function openConfirmModal(option) {
  currentSelectedOption = option;

  document.getElementById('confirm-avatar').src = option.photo;
  document.getElementById('confirm-badge').textContent = option.badge;
  document.getElementById('confirm-badge').style.backgroundColor = option.color;
  document.getElementById('confirm-name').textContent = option.name;
  document.getElementById('confirm-candidate-name').textContent = option.candidateName;
  document.getElementById('confirm-slogan').textContent = `"${option.slogan}"`;

  const previewBox = document.getElementById('confirm-preview-box');
  previewBox.style.borderColor = option.color;

  const modal = document.getElementById('modal-confirm');
  modal.classList.remove('hidden');
}

function closeConfirmModal() {
  const modal = document.getElementById('modal-confirm');
  modal.classList.add('hidden');
  currentSelectedOption = null;
}

// Proposal Modal Logic
let activeProposalCandidate = null;
function openProposalsModal(candidate) {
  activeProposalCandidate = candidate;

  document.getElementById('prop-badge').textContent = candidate.badge;
  document.getElementById('prop-badge').style.backgroundColor = candidate.color;
  document.getElementById('prop-title').textContent = candidate.name;

  const teamContainer = document.getElementById('prop-team');
  let teamHtml = `
    <div class="font-bold text-slate-800">Alcalde(sa): <span class="text-blue-700">${candidate.alcalde.name}</span> (${candidate.alcalde.grade})</div>
    <div class="font-bold text-slate-800">Teniente Alcalde: <span class="text-blue-700">${candidate.teniente.name}</span> (${candidate.teniente.grade})</div>
  `;
  if (candidate.regidores && candidate.regidores.length > 0) {
    teamHtml += '<div class="text-[11px] text-slate-500 font-semibold pt-1">Regidores: ' + candidate.regidores.map(r => `${r.cargo}: ${r.name}`).join(' • ') + '</div>';
  }
  teamContainer.innerHTML = teamHtml;

  const listContainer = document.getElementById('prop-list');
  listContainer.innerHTML = candidate.proposals.map(p => `
    <li class="flex items-start space-x-2">
      <span class="text-emerald-500 font-bold">✔</span>
      <span>${p}</span>
    </li>
  `).join('');

  document.getElementById('btn-select-from-proposals').style.backgroundColor = candidate.color;
  document.getElementById('modal-proposals').classList.remove('hidden');
}

function closeProposalsModal() {
  document.getElementById('modal-proposals').classList.add('hidden');
  activeProposalCandidate = null;
}

// Submit Vote to API
async function handleConfirmVote() {
  if (!currentVoter || !currentSelectedOption) return;

  const confirmBtn = document.getElementById('btn-modal-confirm');
  confirmBtn.disabled = true;
  confirmBtn.innerHTML = `
    <svg class="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
    </svg>
    Guardando Voto Secreto...
  `;

  try {
    const res = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        voterCode: currentVoter.code,
        candidateId: currentSelectedOption.id
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || 'No se pudo registrar el voto.');
      closeConfirmModal();
      return;
    }

    // Success! Close modal and show Success screen
    closeConfirmModal();
    showScreen('success');
    triggerConfetti();
    startCountdown();

  } catch (err) {
    console.error('Error casting vote:', err);
    alert('Error al conectar con el servidor principal. No desconecte el equipo y avise al profesor.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.innerHTML = `
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
      </svg>
      <span>Sí, Emitir Voto</span>
    `;
  }
}

// Confetti shower
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
    });
  }
}

// 5-second automatic countdown timer
function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);

  let seconds = 5;
  const timerEl = document.getElementById('countdown-timer');
  const progressEl = document.getElementById('countdown-progress');

  timerEl.textContent = seconds;
  progressEl.style.width = '100%';

  countdownInterval = setInterval(() => {
    seconds--;
    timerEl.textContent = seconds;
    progressEl.style.width = `${(seconds / 5) * 100}%`;

    if (seconds <= 0) {
      clearInterval(countdownInterval);
      resetVotingFlow();
    }
  }, 1000);
}

// Reset flow for the next student
function resetVotingFlow() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }

  currentVoter = null;
  currentSelectedOption = null;

  const codeInput = document.getElementById('voter-code-input');
  codeInput.value = '';
  document.getElementById('auth-error-box').classList.add('hidden');

  closeConfirmModal();
  closeProposalsModal();
  showScreen('auth');

  setTimeout(() => {
    codeInput.focus();
  }, 100);
}

// Screen Switcher
function showScreen(screenId) {
  document.getElementById('screen-auth').classList.add('hidden');
  document.getElementById('screen-welcome').classList.add('hidden');
  document.getElementById('screen-ballot').classList.add('hidden');
  document.getElementById('screen-success').classList.add('hidden');

  const target = document.getElementById(`screen-${screenId}`);
  if (target) {
    target.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
