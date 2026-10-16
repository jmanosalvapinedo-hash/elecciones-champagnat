const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_FILE = path.join(DATA_DIR, 'election_config.json');
const CANDIDATES_FILE = path.join(DATA_DIR, 'candidates.json');
const PADRON_FILE = path.join(DATA_DIR, 'padron.json');
const VOTES_FILE = path.join(DATA_DIR, 'votes.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Atomic file write to prevent corruption during sudden power drops
function atomicWriteJson(filePath, data) {
  const tmpFile = `${filePath}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpFile, filePath);
}

function readJson(filePath, defaultFallback = []) {
  try {
    if (!fs.existsSync(filePath)) {
      atomicWriteJson(filePath, defaultFallback);
      return defaultFallback;
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultFallback;
  }
}

// DB Interface
const db = {
  // Config
  getConfig() {
    return readJson(CONFIG_FILE, {
      electionTitle: "Elecciones del Municipio Escolar 2026 - 2027",
      schoolName: "I.E. San Marcelino Champagnat",
      status: "open",
      adminPassword: "admin",
      allowBlank: true,
      allowNull: true
    });
  },

  updateConfig(patch) {
    const current = this.getConfig();
    const updated = { ...current, ...patch };
    atomicWriteJson(CONFIG_FILE, updated);
    return updated;
  },

  // Candidates
  getCandidates() {
    return readJson(CANDIDATES_FILE, []);
  },

  // Electoral Roll (Padrón)
  getPadron() {
    return readJson(PADRON_FILE, []);
  },

  findVoterByCode(code) {
    if (!code) return null;
    const cleanCode = String(code).trim().toUpperCase();
    const padron = this.getPadron();
    return padron.find(v => String(v.code).trim().toUpperCase() === cleanCode) || null;
  },

  markVoterAsVoted(code) {
    const cleanCode = String(code).trim().toUpperCase();
    const padron = this.getPadron();
    const idx = padron.findIndex(v => String(v.code).trim().toUpperCase() === cleanCode);
    if (idx === -1) return false;
    
    padron[idx].hasVoted = true;
    padron[idx].votedAt = new Date().toISOString();
    atomicWriteJson(PADRON_FILE, padron);
    return padron[idx];
  },

  addVoter(voterData) {
    const padron = this.getPadron();
    const cleanCode = String(voterData.code).trim().toUpperCase();
    
    const existing = padron.find(v => String(v.code).trim().toUpperCase() === cleanCode);
    if (existing) {
      throw new Error(`El código o DNI ${cleanCode} ya está registrado en el padrón electoral.`);
    }

    const newVoter = {
      id: crypto.randomUUID(),
      code: cleanCode,
      name: voterData.name.trim(),
      grade: voterData.grade.trim(),
      section: voterData.section.trim(),
      hasVoted: false,
      votedAt: null
    };

    padron.push(newVoter);
    atomicWriteJson(PADRON_FILE, padron);
    return newVoter;
  },

  deleteVoter(id) {
    let padron = this.getPadron();
    const initialLen = padron.length;
    padron = padron.filter(v => v.id !== id && v.code !== id);
    if (padron.length !== initialLen) {
      atomicWriteJson(PADRON_FILE, padron);
      return true;
    }
    return false;
  },

  // Bulk add demo voters
  generateDemoVoters(count = 20) {
    const padron = this.getPadron();
    const names = [
      "Alonso", "Camila", "Franco", "Lucía", "Renato", "Flavia", "Matías", "Fabiana",
      "Gael", "Adriana", "Ignacio", "Ariana", "Joaquín", "Bianca", "Leonardo", "Kiara"
    ];
    const lastNames = [
      "Quispe", "Flores", "Sánchez", "García", "Rodríguez", "Huamán", "Rojas", "Díaz",
      "Torres", "López", "Gonzales", "Pérez", "Castillo", "Mamani", "Chávez", "Ramos"
    ];
    const grades = ["1ro", "2do", "3ro", "4to", "5to"];
    const sections = ["A", "B", "C"];

    let added = 0;
    let baseCode = 71000000 + Math.floor(Math.random() * 800000);

    for (let i = 0; i < count; i++) {
      const code = String(baseCode + i);
      if (!padron.some(v => v.code === code)) {
        const name = `${names[Math.floor(Math.random() * names.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]} ${lastNames[Math.floor(Math.random() * lastNames.length)]}`;
        const grade = `${grades[Math.floor(Math.random() * grades.length)]} de Secundaria`;
        const section = sections[Math.floor(Math.random() * sections.length)];
        
        padron.push({
          id: crypto.randomUUID(),
          code,
          name,
          grade,
          section,
          hasVoted: false,
          votedAt: null
        });
        added++;
      }
    }

    atomicWriteJson(PADRON_FILE, padron);
    return added;
  },

  // Votes
  getVotes() {
    return readJson(VOTES_FILE, []);
  },

  recordVote(candidateId, terminalIp = '127.0.0.1') {
    const votes = this.getVotes();
    const newVote = {
      id: crypto.randomUUID(),
      candidateId,
      timestamp: new Date().toISOString(),
      terminalIp
    };
    votes.push(newVote);
    atomicWriteJson(VOTES_FILE, votes);
    return newVote;
  },

  // Full Election Reset
  resetElection() {
    // Clear votes
    atomicWriteJson(VOTES_FILE, []);
    
    // Reset padron hasVoted flags
    const padron = this.getPadron().map(v => ({
      ...v,
      hasVoted: false,
      votedAt: null
    }));
    atomicWriteJson(PADRON_FILE, padron);
    return true;
  },

  // Complete Stats calculation
  getStats() {
    const config = this.getConfig();
    const candidates = this.getCandidates();
    const padron = this.getPadron();
    const votes = this.getVotes();

    const totalPadron = padron.length;
    const totalVotes = votes.length;
    const pendingVoters = Math.max(0, totalPadron - totalVotes);
    const participationRate = totalPadron > 0 ? ((totalVotes / totalPadron) * 100).toFixed(1) : 0;

    // Count votes per candidate
    const voteCounts = {};
    candidates.forEach(c => {
      voteCounts[c.id] = 0;
    });
    voteCounts['BLANCO'] = 0;
    voteCounts['NULO'] = 0;

    votes.forEach(v => {
      if (voteCounts[v.candidateId] !== undefined) {
        voteCounts[v.candidateId]++;
      } else {
        voteCounts['NULO'] = (voteCounts['NULO'] || 0) + 1;
      }
    });

    const candidateResults = candidates.map(c => {
      const count = voteCounts[c.id] || 0;
      const percentage = totalVotes > 0 ? ((count / totalVotes) * 100).toFixed(1) : "0.0";
      return {
        id: c.id,
        number: c.number,
        name: c.name,
        slogan: c.slogan,
        color: c.color,
        badge: c.badge,
        alcalde: c.alcalde,
        teniente: c.teniente,
        votes: count,
        percentage: Number(percentage)
      };
    });

    // Special votes
    const blankVotes = voteCounts['BLANCO'] || 0;
    const nullVotes = voteCounts['NULO'] || 0;
    const validVotes = totalVotes - blankVotes - nullVotes;

    const blankPercentage = totalVotes > 0 ? ((blankVotes / totalVotes) * 100).toFixed(1) : "0.0";
    const nullPercentage = totalVotes > 0 ? ((nullVotes / totalVotes) * 100).toFixed(1) : "0.0";
    const validPercentage = totalVotes > 0 ? ((validVotes / totalVotes) * 100).toFixed(1) : "0.0";

    // Recent activity feed (last 15 votes - keeping ballot secret, displaying terminal + timestamp)
    const recentActivity = votes
      .slice(-15)
      .reverse()
      .map(v => ({
        id: v.id,
        timestamp: v.timestamp,
        terminalIp: v.terminalIp
      }));

    return {
      config,
      totalPadron,
      totalVotes,
      pendingVoters,
      participationRate: Number(participationRate),
      validVotes,
      validPercentage: Number(validPercentage),
      blankVotes,
      blankPercentage: Number(blankPercentage),
      nullVotes,
      nullPercentage: Number(nullPercentage),
      candidateResults,
      recentActivity
    };
  }
};

module.exports = db;
