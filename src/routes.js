const express = require('express');
const os = require('os');
const db = require('./db');

function createRouter(io) {
  const router = express.Router();

  // Helper to extract client IP
  function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress || '127.0.0.1';
  }

  // Helper to get local network IPv4 addresses
  function getLocalIpAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push({ interface: name, address: iface.address });
        }
      }
    }
    return addresses;
  }

  // --- PUBLIC / STUDENT ENDPOINTS ---

  // Get current election status & metadata
  router.get('/status', (req, res) => {
    const config = db.getConfig();
    res.json({
      success: true,
      electionTitle: config.electionTitle,
      schoolName: config.schoolName,
      status: config.status,
      isOpen: config.status === 'open'
    });
  });

  // Get candidate lists for the ballot
  router.get('/candidates', (req, res) => {
    const candidates = db.getCandidates();
    const config = db.getConfig();
    res.json({
      success: true,
      candidates,
      allowBlank: config.allowBlank !== false,
      allowNull: config.allowNull !== false
    });
  });

  // Validate student voter code before displaying ballot
  router.post('/auth/validate-voter', (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Por favor, ingresa tu Código de Estudiante o DNI.'
      });
    }

    const config = db.getConfig();
    if (config.status !== 'open') {
      return res.status(403).json({
        success: false,
        message: 'Las votaciones se encuentran actualmente pausadas o cerradas por el Comité Electoral.'
      });
    }

    const voter = db.findVoterByCode(code);
    if (!voter) {
      return res.status(404).json({
        success: false,
        message: 'Código o DNI no encontrado en el Padrón Electoral. Acércate a los miembros de mesa.'
      });
    }

    if (voter.hasVoted) {
      const timeStr = voter.votedAt ? new Date(voter.votedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' }) : 'horas de la mañana';
      return res.status(409).json({
        success: false,
        alreadyVoted: true,
        message: `El estudiante ${voter.name} (${voter.grade}) ya emitió su voto a las ${timeStr}. No es posible votar dos veces.`
      });
    }

    res.json({
      success: true,
      voter: {
        code: voter.code,
        name: voter.name,
        grade: voter.grade,
        section: voter.section
      }
    });
  });

  // Cast anonymous vote
  router.post('/vote', (req, res) => {
    const { voterCode, candidateId } = req.body;
    const clientIp = getClientIp(req);

    if (!voterCode || !candidateId) {
      return res.status(400).json({
        success: false,
        message: 'Faltan datos de votación requeridos.'
      });
    }

    const config = db.getConfig();
    if (config.status !== 'open') {
      return res.status(403).json({
        success: false,
        message: 'El sistema de votación no está disponible en este momento.'
      });
    }

    // Verify voter in padrón
    const voter = db.findVoterByCode(voterCode);
    if (!voter) {
      return res.status(404).json({
        success: false,
        message: 'Credencial de elector no válida.'
      });
    }

    if (voter.hasVoted) {
      return res.status(409).json({
        success: false,
        message: 'Este elector ya ha sufragado previamente.'
      });
    }

    // Verify valid candidate option
    const candidates = db.getCandidates();
    const isValidCandidate = candidates.some(c => c.id === candidateId) || candidateId === 'BLANCO' || candidateId === 'NULO';
    if (!isValidCandidate) {
      return res.status(400).json({
        success: false,
        message: 'Opción de voto no válida.'
      });
    }

    // Mark voter as voted in padrón (invalidating the code)
    db.markVoterAsVoted(voterCode);

    // Save vote anonymously (secret ballot)
    const newVote = db.recordVote(candidateId, clientIp);

    // Calculate updated stats and broadcast real-time update to all connected screens/dashboards
    const updatedStats = db.getStats();
    io.emit('vote_registered', {
      stats: updatedStats,
      activity: {
        id: newVote.id,
        timestamp: newVote.timestamp,
        terminalIp: clientIp,
        grade: voter.grade,
        section: voter.section
      }
    });

    res.json({
      success: true,
      message: '¡Tu voto ha sido registrado con éxito!'
    });
  });

  // --- ADMIN & COMMITTEE ENDPOINTS ---

  // Admin login check
  router.post('/admin/login', (req, res) => {
    const { password } = req.body;
    const config = db.getConfig();

    if (password === config.adminPassword) {
      res.json({ success: true, message: 'Autenticación exitosa.' });
    } else {
      res.status(401).json({ success: false, message: 'Contraseña de administrador incorrecta.' });
    }
  });

  // Full real-time election statistics
  router.get('/admin/stats', (req, res) => {
    const stats = db.getStats();
    res.json({
      success: true,
      stats
    });
  });

  // Toggle election lock (open / paused)
  router.post('/admin/toggle-lock', (req, res) => {
    const { password } = req.body;
    const config = db.getConfig();

    if (password !== config.adminPassword) {
      return res.status(401).json({ success: false, message: 'No autorizado.' });
    }

    const newStatus = config.status === 'open' ? 'paused' : 'open';
    const updated = db.updateConfig({ status: newStatus });

    // Broadcast lock/unlock to all terminals instantly
    io.emit('election_status_changed', {
      status: newStatus,
      isOpen: newStatus === 'open'
    });

    res.json({
      success: true,
      status: newStatus,
      message: newStatus === 'open' ? 'Votaciones reanudadas.' : 'Votaciones pausadas.'
    });
  });

  // Reset entire election (clear votes, reset padrón)
  router.post('/admin/reset', (req, res) => {
    const { password } = req.body;
    const config = db.getConfig();

    if (password !== config.adminPassword) {
      return res.status(401).json({ success: false, message: 'Contraseña de seguridad incorrecta.' });
    }

    db.resetElection();
    const freshStats = db.getStats();

    // Broadcast reset event to all clients
    io.emit('election_reset', { stats: freshStats });

    res.json({
      success: true,
      message: 'Elección reiniciada exitosamente. Todos los votos han sido borrados a 0.',
      stats: freshStats
    });
  });

  // Padrón: list voters
  router.get('/admin/voters', (req, res) => {
    const { search = '', filter = 'all' } = req.query;
    let voters = db.getPadron();

    if (filter === 'voted') {
      voters = voters.filter(v => v.hasVoted);
    } else if (filter === 'pending') {
      voters = voters.filter(v => !v.hasVoted);
    }

    if (search) {
      const q = search.toLowerCase();
      voters = voters.filter(v => 
        v.code.toLowerCase().includes(q) || 
        v.name.toLowerCase().includes(q) ||
        v.grade.toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      total: voters.length,
      voters
    });
  });

  // Padrón: add a voter
  router.post('/admin/voters', (req, res) => {
    const { code, name, grade, section } = req.body;
    if (!code || !name || !grade) {
      return res.status(400).json({
        success: false,
        message: 'Código, nombre y grado son obligatorios.'
      });
    }

    try {
      const voter = db.addVoter({ code, name, grade, section: section || 'A' });
      // Broadcast stats update
      io.emit('padron_updated', { stats: db.getStats() });
      res.json({ success: true, voter, message: 'Estudiante agregado al padrón.' });
    } catch (err) {
      res.status(400).json({ success: false, message: err.message });
    }
  });

  // Padrón: generate demo voters
  router.post('/admin/voters/demo', (req, res) => {
    const count = Number(req.body.count) || 20;
    const added = db.generateDemoVoters(count);
    io.emit('padron_updated', { stats: db.getStats() });
    res.json({
      success: true,
      message: `Se generaron ${added} estudiantes de prueba en el padrón.`
    });
  });

  // Padrón: delete a voter
  router.delete('/admin/voters/:id', (req, res) => {
    const { id } = req.params;
    const deleted = db.deleteVoter(id);
    if (deleted) {
      io.emit('padron_updated', { stats: db.getStats() });
      res.json({ success: true, message: 'Estudiante eliminado del padrón.' });
    } else {
      res.status(404).json({ success: false, message: 'Estudiante no encontrado.' });
    }
  });

  // Network info for easy LAN configuration
  router.get('/admin/network-info', (req, res) => {
    const addresses = getLocalIpAddresses();
    res.json({
      success: true,
      addresses,
      hostname: os.hostname(),
      platform: os.platform()
    });
  });

  // Export results to CSV
  router.get('/admin/export/csv', (req, res) => {
    const stats = db.getStats();
    let csv = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    csv += 'RESULTADOS OFICIALES - ELECCIONES DEL MUNICIPIO ESCOLAR\n';
    csv += `Institución Educativa:;${stats.config.schoolName}\n`;
    csv += `Proceso:;${stats.config.electionTitle}\n`;
    csv += `Fecha de Cierre:;${new Date().toLocaleString('es-PE')}\n\n`;

    csv += 'RESUMEN GENERAL;\n';
    csv += `Padrón Electoral Total:;${stats.totalPadron}\n`;
    csv += `Total Votos Emitidos:;${stats.totalVotes}\n`;
    csv += `Porcentaje de Participación:;${stats.participationRate}%\n`;
    csv += `Ausentismo / Pendientes:;${stats.pendingVoters}\n\n`;

    csv += 'DETALLE POR LISTA / CANDIDATURA;\n';
    csv += 'Lista / Opción;Número;Candidato a Alcalde;Votos;Porcentaje\n';
    stats.candidateResults.forEach(c => {
      csv += `"${c.name}";${c.number};"${c.alcalde.name}";${c.votes};${c.percentage}%\n`;
    });
    csv += `"Votos en Blanco";-;--;${stats.blankVotes};${stats.blankPercentage}%\n`;
    csv += `"Votos Nulos";-;--;${stats.nullVotes};${stats.nullPercentage}%\n`;
    csv += `Total Válidos;--;--;${stats.validVotes};${stats.validPercentage}%\n`;

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`Resultados_Municipio_Escolar_${Date.now()}.csv`);
    res.send(csv);
  });

  // Export padrón / attendance to CSV
  router.get('/admin/export/voters-csv', (req, res) => {
    const padron = db.getPadron();
    let csv = '\uFEFF';
    csv += 'PADRÓN ELECTORAL Y REGISTRO DE ASISTENCIA\n';
    csv += `Fecha de Reporte:;${new Date().toLocaleString('es-PE')}\n\n`;
    csv += 'DNI / Código;Apellidos y Nombres;Grado;Sección;Estado;Hora de Sufragio\n';

    padron.forEach(v => {
      const estado = v.hasVoted ? 'SUFRAGÓ' : 'NO SUFRAGÓ';
      const hora = v.votedAt ? new Date(v.votedAt).toLocaleString('es-PE') : '-';
      csv += `"${v.code}";"${v.name}";"${v.grade}";"${v.section}";${estado};"${hora}"\n`;
    });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment(`Padron_Asistencia_${Date.now()}.csv`);
    res.send(csv);
  });

  return router;
}

module.exports = createRouter;
